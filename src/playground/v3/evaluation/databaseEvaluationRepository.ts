import { Prisma, PrismaClient } from "@prisma/client";
import { EvaluationRepository } from "./evaluationRepository";
import { EvaluatedCriterion, SessionEvaluationRecord } from "./evaluationDomain";

export class DatabaseEvaluationRepository implements EvaluationRepository {
  constructor(private readonly client: PrismaClient) {}

  async findBySessionAndVersion(sessionId: string, evaluatorVersion: string): Promise<SessionEvaluationRecord | null> {
    const stored = await this.client.sessionEvaluation.findUnique({ where: { sessionId_evaluatorVersion: { sessionId, evaluatorVersion } } });
    return stored ? toRecord(stored) : null;
  }

  async saveCompleted(evaluation: SessionEvaluationRecord): Promise<SessionEvaluationRecord> {
    const stored = await this.client.sessionEvaluation.upsert({
      where: { sessionId_evaluatorVersion: { sessionId: evaluation.sessionId, evaluatorVersion: evaluation.evaluatorVersion } },
      create: {
        id: evaluation.id, sessionId: evaluation.sessionId, evaluatorVersion: evaluation.evaluatorVersion, status: "COMPLETED",
        overallScore: evaluation.overallScore, criteria: evaluation.criteria as unknown as Prisma.InputJsonValue,
        strengths: evaluation.strengths, improvementAreas: evaluation.improvementAreas, failureCode: null,
        evaluatedAt: evaluation.evaluatedAt ? new Date(evaluation.evaluatedAt) : new Date()
      },
      update: {
        status: "COMPLETED", overallScore: evaluation.overallScore, criteria: evaluation.criteria as unknown as Prisma.InputJsonValue,
        strengths: evaluation.strengths, improvementAreas: evaluation.improvementAreas, failureCode: null,
        evaluatedAt: evaluation.evaluatedAt ? new Date(evaluation.evaluatedAt) : new Date()
      }
    });
    return toRecord(stored);
  }

  async saveFailure(input: { id: string; sessionId: string; evaluatorVersion: string; failureCode: string; now: string }): Promise<void> {
    const updated = await this.client.sessionEvaluation.updateMany({
      where: { sessionId: input.sessionId, evaluatorVersion: input.evaluatorVersion, status: "FAILED" },
      data: { overallScore: null, criteria: Prisma.DbNull, strengths: Prisma.DbNull, improvementAreas: Prisma.DbNull, failureCode: input.failureCode, evaluatedAt: null }
    });
    if (updated.count > 0) return;
    try {
      await this.client.sessionEvaluation.create({ data: { id: input.id, sessionId: input.sessionId, evaluatorVersion: input.evaluatorVersion, status: "FAILED", failureCode: input.failureCode } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      // A concurrent successful evaluator owns the row; never downgrade COMPLETED to FAILED.
    }
  }
}

function toRecord(stored: { id: string; sessionId: string; evaluatorVersion: string; status: "COMPLETED" | "FAILED"; overallScore: number | null; criteria: unknown; strengths: unknown; improvementAreas: unknown; failureCode: string | null; evaluatedAt: Date | null; createdAt: Date; updatedAt: Date }): SessionEvaluationRecord {
  return {
    id: stored.id, sessionId: stored.sessionId, evaluatorVersion: stored.evaluatorVersion, status: stored.status,
    overallScore: stored.overallScore, criteria: Array.isArray(stored.criteria) ? stored.criteria as unknown as EvaluatedCriterion[] : [],
    strengths: stringArray(stored.strengths), improvementAreas: stringArray(stored.improvementAreas), failureCode: stored.failureCode,
    evaluatedAt: stored.evaluatedAt?.toISOString() ?? null, createdAt: stored.createdAt.toISOString(), updatedAt: stored.updatedAt.toISOString()
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
