import { randomUUID } from "crypto";
import { SessionRepository } from "../sessionRepository";
import { SimulationSession } from "../simulationSession";
import { buildEvaluationInput } from "./evaluationInputBuilder";
import { buildSessionEvaluation, criterionApplicability } from "./evaluationEngine";
import { EVALUATOR_VERSION, QUALITATIVE_CRITERION_KEYS, SessionEvaluationRecord, qualitativeEvaluationSchema } from "./evaluationDomain";
import { EvaluationProvider, EvaluationProviderError } from "./evaluationProvider";
import { EvaluationRepository } from "./evaluationRepository";

export type EvaluationErrorCode = "EVALUATION_SESSION_NOT_FOUND" | "SESSION_NOT_COMPLETED" | "EVALUATION_FAILED";
export class EvaluationServiceError extends Error {
  constructor(public readonly code: EvaluationErrorCode, message: string) { super(message); }
}

interface Dependencies { sessions: SessionRepository; evaluations: EvaluationRepository; provider: EvaluationProvider; now?: () => Date; createId?: () => string; }

export class EvaluationService {
  private readonly locks = new Map<string, Promise<SessionEvaluationRecord>>();
  private readonly now: () => Date;
  private readonly createId: () => string;
  constructor(private readonly dependencies: Dependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
  }

  async get(sessionId: string, userId: string) {
    await this.completedOwnedSession(sessionId, userId);
    return this.dependencies.evaluations.findBySessionAndVersion(sessionId, EVALUATOR_VERSION);
  }

  async evaluate(sessionId: string, userId: string): Promise<SessionEvaluationRecord> {
    const session = await this.completedOwnedSession(sessionId, userId);
    const key = `${sessionId}:${EVALUATOR_VERSION}`;
    const active = this.locks.get(key);
    if (active) return active;
    const operation = this.evaluateOnce(session).finally(() => { if (this.locks.get(key) === operation) this.locks.delete(key); });
    this.locks.set(key, operation);
    return operation;
  }

  private async evaluateOnce(session: SimulationSession) {
    const sessionId = session.id;
    const existing = await this.dependencies.evaluations.findBySessionAndVersion(sessionId, EVALUATOR_VERSION);
    if (existing?.status === "COMPLETED") return existing;
    const now = this.now().toISOString();
    try {
      const input = buildEvaluationInput(session);
      const qualitative = qualitativeEvaluationSchema.parse(await this.dependencies.provider.evaluate(input));
      const applicability = criterionApplicability(input);
      const required = QUALITATIVE_CRITERION_KEYS.filter((key) => applicability[key]);
      const actual = qualitative.criteria.map((criterion) => criterion.key);
      if (new Set(actual).size !== actual.length || required.length !== actual.length || required.some((key) => !actual.includes(key))) {
        throw new EvaluationProviderError("INVALID_PROVIDER_RESPONSE");
      }
      const evaluation = buildSessionEvaluation({ id: existing?.id ?? this.createId(), input, qualitative, evaluatedAt: now });
      return await this.dependencies.evaluations.saveCompleted(evaluation);
    } catch (error) {
      const failureCode = error instanceof EvaluationProviderError ? error.code : "INVALID_PROVIDER_RESPONSE";
      await this.dependencies.evaluations.saveFailure({ id: existing?.id ?? this.createId(), sessionId, evaluatorVersion: EVALUATOR_VERSION, failureCode, now });
      throw new EvaluationServiceError("EVALUATION_FAILED", "Khong the phan tich ket qua luc nay. Vui long thu lai.");
    }
  }

  private async completedOwnedSession(sessionId: string, userId: string) {
    const session = await this.dependencies.sessions.findById(sessionId);
    if (!session || session.userId !== userId) throw new EvaluationServiceError("EVALUATION_SESSION_NOT_FOUND", "Khong tim thay phien luyen tap.");
    if (session.status !== "COMPLETED" || !session.result) throw new EvaluationServiceError("SESSION_NOT_COMPLETED", "Chi co the phan tich phien da hoan thanh.");
    return session;
  }
}
