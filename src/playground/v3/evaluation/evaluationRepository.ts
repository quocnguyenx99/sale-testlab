import { SessionEvaluationRecord } from "./evaluationDomain";

export interface EvaluationRepository {
  findBySessionAndVersion(sessionId: string, evaluatorVersion: string): Promise<SessionEvaluationRecord | null>;
  saveCompleted(evaluation: SessionEvaluationRecord): Promise<SessionEvaluationRecord>;
  saveFailure(input: { id: string; sessionId: string; evaluatorVersion: string; failureCode: string; now: string }): Promise<void>;
}
