import { Prisma, PrismaClient } from "@prisma/client";
import { SessionHistoryPage, SessionHistoryQuery, SessionRepository } from "./sessionRepository";
import { SimulationMessage, SimulationSession } from "./simulationSession";

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const nullableJson = (value: unknown | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  value === null || value === undefined ? Prisma.DbNull : json(value);

export class DatabaseSessionRepository implements SessionRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<SimulationSession | null> {
    const stored = await this.client.simulationSession.findUnique({
      where: { id },
      include: { turns: { orderBy: { sequence: "asc" } } }
    });
    if (!stored) return null;
    return {
      id: stored.id,
      userId: stored.userId,
      runtimeSessionId: stored.runtimeSessionId,
      personaId: stored.personaId,
      personaSnapshot: stored.personaSnapshot as unknown as SimulationSession["personaSnapshot"],
      scenarioSnapshot: stored.scenarioSnapshot as unknown as SimulationSession["scenarioSnapshot"],
      mode: stored.mode,
      status: stored.status,
      createdAt: stored.createdAt.toISOString(),
      completedAt: stored.completedAt?.toISOString() ?? null,
      messages: stored.turns.map((turn): SimulationMessage => ({
        id: turn.id,
        sender: turn.sender,
        content: turn.content,
        createdAt: turn.createdAt.toISOString()
      })),
      runtimeInsight: stored.runtimeInsight as unknown as SimulationSession["runtimeInsight"],
      runtimeSnapshot: stored.runtimeSnapshot as unknown as SimulationSession["runtimeSnapshot"],
      signals: stored.signals as unknown as string[],
      trainingAssignmentId: stored.trainingAssignmentId,
      trainingProgramItemId: stored.trainingProgramItemId,
      ...(stored.result ? { result: stored.result as unknown as NonNullable<SimulationSession["result"]> } : {})
    };
  }

  async findHistoryByUserId(userId: string, query: SessionHistoryQuery): Promise<SessionHistoryPage> {
    const where: Prisma.SimulationSessionWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.search ? {
        personaSnapshot: { path: "$.displayName", string_contains: query.search }
      } : {})
    };
    const [total, stored] = await this.client.$transaction([
      this.client.simulationSession.count({ where }),
      this.client.simulationSession.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          personaSnapshot: true,
          mode: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true,
          runtimeInsight: true,
          result: true,
          _count: { select: { turns: { where: { sender: "SALE" } } } }
        }
      })
    ]);
    const items = stored.map((session) => {
      const result = objectValue(session.result);
      const insight = objectValue(session.runtimeInsight);
      return {
        id: session.id,
        persona: session.personaSnapshot as unknown as SimulationSession["personaSnapshot"],
        mode: session.mode,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        completedAt: session.completedAt?.toISOString() ?? null,
        turnCount: session._count.turns,
        dealOutcome: stringValue(result, "outcome") ?? stringValue(insight, "dealOutcome"),
        trainingStatus: stringValue(result, "trainingStatus") ?? stringValue(insight, "trainingStatus")
      };
    });
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize)
    };
  }

  async save(session: SimulationSession): Promise<void> {
    const sessionData = {
      userId: session.userId,
      personaId: session.personaId,
      mode: session.mode,
      status: session.status,
      personaSnapshot: json(session.personaSnapshot),
      scenarioSnapshot: json(session.scenarioSnapshot),
      runtimeSessionId: session.runtimeSessionId,
      runtimeSnapshot: nullableJson(session.runtimeSnapshot),
      runtimeInsight: nullableJson(session.runtimeInsight),
      signals: json(session.signals),
      result: nullableJson(session.result),
      createdAt: new Date(session.createdAt),
      completedAt: session.completedAt ? new Date(session.completedAt) : null,
      trainingAssignmentId: session.trainingAssignmentId ?? null,
      trainingProgramItemId: session.trainingProgramItemId ?? null
    };
    await this.client.$transaction(async (transaction) => {
      await transaction.simulationSession.upsert({
        where: { id: session.id },
        create: { id: session.id, ...sessionData },
        update: { ...sessionData, version: { increment: 1 } }
      });
      if (session.messages.length > 0) {
        await transaction.conversationTurn.createMany({
          data: session.messages.map((message, sequence) => ({
            id: message.id,
            sessionId: session.id,
            sequence,
            sender: message.sender,
            content: message.content,
            createdAt: new Date(message.createdAt)
          })),
          skipDuplicates: true
        });
      }
    });
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: Record<string, unknown> | null, key: string): string | null {
  return value && typeof value[key] === "string" ? value[key] : null;
}
