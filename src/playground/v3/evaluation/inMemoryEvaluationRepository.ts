import { EvaluationRepository } from "./evaluationRepository";
import { SessionEvaluationRecord } from "./evaluationDomain";

export class InMemoryEvaluationRepository implements EvaluationRepository {
  private readonly records = new Map<string, SessionEvaluationRecord>();
  async findBySessionAndVersion(sessionId: string, evaluatorVersion: string) { return this.records.get(`${sessionId}:${evaluatorVersion}`) ?? null; }
  async saveCompleted(evaluation: SessionEvaluationRecord) { this.records.set(`${evaluation.sessionId}:${evaluation.evaluatorVersion}`, evaluation); return evaluation; }
  async saveFailure(input: { id: string; sessionId: string; evaluatorVersion: string; failureCode: string; now: string }) {
    const previous = await this.findBySessionAndVersion(input.sessionId, input.evaluatorVersion);
    this.records.set(`${input.sessionId}:${input.evaluatorVersion}`, {
      id: previous?.id ?? input.id, sessionId: input.sessionId, evaluatorVersion: input.evaluatorVersion, status: "FAILED",
      overallScore: null, criteria: [], strengths: [], improvementAreas: [], failureCode: input.failureCode,
      evaluatedAt: null, createdAt: previous?.createdAt ?? input.now, updatedAt: input.now
    });
  }
}
