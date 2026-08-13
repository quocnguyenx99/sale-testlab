import { Prisma, PrismaClient } from "@prisma/client";
import { CoachingRepository } from "./coachingRepository";
import { CoachingPriority, SessionCoachingFeedback, StrengthReinforcement } from "./coachingDomain";

export class DatabaseCoachingRepository implements CoachingRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByEvaluationAndVersion(evaluationId: string, coachVersion: string) {
    const stored = await this.client.sessionCoachingFeedback.findUnique({ where: { evaluationId_coachVersion: { evaluationId, coachVersion } }, include: { evaluation: { select: { evaluatorVersion: true } } } });
    return stored ? toRecord(stored) : null;
  }

  async saveCompleted(feedback: SessionCoachingFeedback): Promise<SessionCoachingFeedback> {
    const data = {
      status: "COMPLETED" as const, summary: feedback.summary,
      priorities: feedback.priorities as unknown as Prisma.InputJsonValue,
      strengthReinforcement: feedback.strengthReinforcement === null ? Prisma.JsonNull : feedback.strengthReinforcement as unknown as Prisma.InputJsonValue,
      nextPracticeFocus: feedback.nextPracticeFocus,
      failureCode: null, coachedAt: feedback.coachedAt ? new Date(feedback.coachedAt) : new Date()
    };
    const transitioned = await this.client.sessionCoachingFeedback.updateMany({
      where: { evaluationId: feedback.evaluationId, coachVersion: feedback.coachVersion, status: "FAILED" }, data
    });
    if (transitioned.count === 0) {
      try {
        await this.client.sessionCoachingFeedback.create({ data: { id: feedback.id, evaluationId: feedback.evaluationId, coachVersion: feedback.coachVersion, ...data } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    const stored = await this.findByEvaluationAndVersion(feedback.evaluationId, feedback.coachVersion);
    if (!stored) throw new Error("COACHING_PERSISTENCE_FAILED");
    return stored;
  }

  async saveFailure(input: { id: string; evaluationId: string; evaluatorVersion: string; coachVersion: string; failureCode: string; now: string }): Promise<SessionCoachingFeedback> {
    const updated = await this.client.sessionCoachingFeedback.updateMany({
      where: { evaluationId: input.evaluationId, coachVersion: input.coachVersion, status: "FAILED" },
      data: { summary: null, priorities: Prisma.DbNull, strengthReinforcement: Prisma.DbNull, nextPracticeFocus: Prisma.DbNull, failureCode: input.failureCode, coachedAt: null }
    });
    if (updated.count === 0) {
      try { await this.client.sessionCoachingFeedback.create({ data: { id: input.id, evaluationId: input.evaluationId, coachVersion: input.coachVersion, status: "FAILED", failureCode: input.failureCode } }); }
      catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error; }
    }
    const stored = await this.findByEvaluationAndVersion(input.evaluationId, input.coachVersion);
    if (!stored) throw new Error("COACHING_PERSISTENCE_FAILED");
    return stored;
  }
}

type Stored = { id: string; evaluationId: string; coachVersion: string; status: "COMPLETED" | "FAILED"; summary: string | null; priorities: unknown; strengthReinforcement: unknown; nextPracticeFocus: unknown; failureCode: string | null; coachedAt: Date | null; createdAt: Date; updatedAt: Date; evaluation: { evaluatorVersion: string } };
function toRecord(stored: Stored): SessionCoachingFeedback {
  return {
    id: stored.id, evaluationId: stored.evaluationId, evaluatorVersion: stored.evaluation.evaluatorVersion, coachVersion: stored.coachVersion, status: stored.status,
    summary: stored.summary, priorities: Array.isArray(stored.priorities) ? stored.priorities as CoachingPriority[] : [],
    strengthReinforcement: isObject(stored.strengthReinforcement) ? stored.strengthReinforcement as unknown as StrengthReinforcement : null,
    nextPracticeFocus: stringArray(stored.nextPracticeFocus), failureCode: stored.failureCode, coachedAt: stored.coachedAt?.toISOString() ?? null,
    createdAt: stored.createdAt.toISOString(), updatedAt: stored.updatedAt.toISOString()
  };
}
function isObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
