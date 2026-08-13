import { randomUUID } from "crypto";
import { EVALUATOR_VERSION, SessionEvaluationRecord } from "../evaluation/evaluationDomain";
import { EvaluationRepository } from "../evaluation/evaluationRepository";
import { SessionRepository } from "../sessionRepository";
import { SimulationSession } from "../simulationSession";
import { COACH_VERSION, SessionCoachingFeedback } from "./coachingDomain";
import { buildCoachingFeedback, selectCoachingPlan } from "./coachingEngine";
import { buildCoachingProviderInput, CoachingInputError } from "./coachingInputBuilder";
import { CoachingProvider, CoachingProviderError } from "./coachingProvider";
import { CoachingRepository } from "./coachingRepository";

export type CoachingState = "LOCKED_NEEDS_EVALUATION" | "NOT_GENERATED" | "COMPLETED" | "FAILED";
export type CoachingErrorCode = "COACHING_SESSION_NOT_FOUND" | "SESSION_NOT_COMPLETED" | "EVALUATION_REQUIRED" | "COACHING_FAILED";
export class CoachingServiceError extends Error { constructor(public readonly code: CoachingErrorCode, message: string) { super(message); } }

interface Dependencies { sessions: SessionRepository; evaluations: EvaluationRepository; coaching: CoachingRepository; provider: CoachingProvider; now?: () => Date; createId?: () => string; }

export class CoachingService {
  private readonly locks = new Map<string, Promise<SessionCoachingFeedback>>();
  private readonly now: () => Date;
  private readonly createId: () => string;
  constructor(private readonly dependencies: Dependencies) { this.now = dependencies.now ?? (() => new Date()); this.createId = dependencies.createId ?? randomUUID; }

  async get(sessionId: string, userId: string): Promise<{ state: CoachingState; coaching: SessionCoachingFeedback | null }> {
    await this.completedOwnedSession(sessionId, userId);
    const evaluation = await this.completedEvaluation(sessionId);
    if (!evaluation) return { state: "LOCKED_NEEDS_EVALUATION", coaching: null };
    const coaching = await this.dependencies.coaching.findByEvaluationAndVersion(evaluation.id, COACH_VERSION);
    return { state: coaching?.status ?? "NOT_GENERATED", coaching };
  }

  async generate(sessionId: string, userId: string): Promise<SessionCoachingFeedback> {
    const session = await this.completedOwnedSession(sessionId, userId);
    const evaluation = await this.completedEvaluation(sessionId);
    if (!evaluation) throw new CoachingServiceError("EVALUATION_REQUIRED", "Hãy phân tích kết quả trước khi nhận gợi ý từ AI Coach.");
    const key = `${evaluation.id}:${COACH_VERSION}`;
    const active = this.locks.get(key);
    if (active) return active;
    const operation = this.generateOnce(session, evaluation).finally(() => { if (this.locks.get(key) === operation) this.locks.delete(key); });
    this.locks.set(key, operation);
    return operation;
  }

  private async generateOnce(session: SimulationSession, evaluation: SessionEvaluationRecord) {
    const existing = await this.dependencies.coaching.findByEvaluationAndVersion(evaluation.id, COACH_VERSION);
    if (existing?.status === "COMPLETED") return existing;
    const id = existing?.id ?? this.createId();
    const now = this.now().toISOString();
    try {
      const selection = selectCoachingPlan(evaluation);
      const providerInput = buildCoachingProviderInput(session, evaluation, selection);
      const output = await this.dependencies.provider.coach(providerInput);
      const feedback = buildCoachingFeedback({ id, evaluation, providerInput, output, coachedAt: now });
      return await this.dependencies.coaching.saveCompleted(feedback);
    } catch (error) {
      const failureCode = error instanceof CoachingProviderError ? error.code : error instanceof CoachingInputError ? error.code : "INVALID_PROVIDER_RESPONSE";
      const persisted = await this.dependencies.coaching.saveFailure({ id, evaluationId: evaluation.id, evaluatorVersion: evaluation.evaluatorVersion, coachVersion: COACH_VERSION, failureCode, now });
      if (persisted.status === "COMPLETED") return persisted;
      throw new CoachingServiceError("COACHING_FAILED", "AI Coach chưa thể tạo gợi ý lúc này. Vui lòng thử lại.");
    }
  }

  private async completedOwnedSession(sessionId: string, userId: string): Promise<SimulationSession> {
    const session = await this.dependencies.sessions.findById(sessionId);
    if (!session || session.userId !== userId) throw new CoachingServiceError("COACHING_SESSION_NOT_FOUND", "Không tìm thấy phiên luyện tập.");
    if (session.status !== "COMPLETED" || !session.result) throw new CoachingServiceError("SESSION_NOT_COMPLETED", "Chỉ có thể nhận coaching cho phiên đã hoàn thành.");
    return session;
  }

  private async completedEvaluation(sessionId: string) {
    const evaluation = await this.dependencies.evaluations.findBySessionAndVersion(sessionId, EVALUATOR_VERSION);
    return evaluation?.status === "COMPLETED" ? evaluation : null;
  }
}
