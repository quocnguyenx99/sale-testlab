import { PrismaClient } from "@prisma/client";
import { ProgressSessionCounts, ProgressSessionSample } from "./progressDomain";
import {
  ProgressEvaluationRepositorySample,
  ProgressRepository
} from "./progressRepository";

const PERSONA_DISPLAY_NAME_FALLBACK = "Khách hàng";
const PERSONA_DISPLAY_NAME_MAX_CHARS = 160;

export class DatabaseProgressRepository implements ProgressRepository {
  constructor(private readonly client: PrismaClient) {}

  async getSessionCounts(userId: string): Promise<ProgressSessionCounts> {
    const [totalSessions, completedSessions] = await this.client.$transaction([
      this.client.simulationSession.count({ where: { userId } }),
      this.client.simulationSession.count({ where: { userId, status: "COMPLETED" } })
    ]);
    return { totalSessions, completedSessions };
  }

  async getCompletedSessionsInWindow(userId: string, from: Date, to: Date): Promise<ProgressSessionSample[]> {
    const sessions = await this.client.simulationSession.findMany({
      where: {
        userId,
        status: "COMPLETED",
        completedAt: { gte: from, lte: to }
      },
      select: { id: true, status: true, completedAt: true },
      orderBy: [{ completedAt: "asc" }, { id: "asc" }]
    });
    return sessions.map((session) => ({
      sessionId: session.id,
      status: session.status,
      completedAt: session.completedAt?.toISOString() ?? null
    }));
  }

  async getEvaluationSamples(userId: string): Promise<ProgressEvaluationRepositorySample[]> {
    const evaluations = await this.client.sessionEvaluation.findMany({
      where: { session: { userId } },
      select: {
        id: true,
        sessionId: true,
        evaluatorVersion: true,
        status: true,
        overallScore: true,
        criteria: true,
        evaluatedAt: true,
        session: {
          select: {
            mode: true,
            personaSnapshot: true
          }
        }
      },
      orderBy: [{ evaluatedAt: "asc" }, { id: "asc" }]
    });
    return evaluations.map((evaluation) => ({
      evaluationId: evaluation.id,
      sessionId: evaluation.sessionId,
      evaluatorVersion: evaluation.evaluatorVersion,
      status: evaluation.status,
      overallScore: evaluation.overallScore,
      criteria: evaluation.criteria,
      evaluatedAt: evaluation.evaluatedAt?.toISOString() ?? null,
      mode: evaluation.session.mode,
      personaDisplayName: personaDisplayName(evaluation.session.personaSnapshot)
    }));
  }
}

function personaDisplayName(snapshot: unknown): string {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) return PERSONA_DISPLAY_NAME_FALLBACK;
  const value = (snapshot as Record<string, unknown>).displayName;
  if (typeof value !== "string" || !value.trim()) return PERSONA_DISPLAY_NAME_FALLBACK;
  return value.trim().slice(0, PERSONA_DISPLAY_NAME_MAX_CHARS);
}
