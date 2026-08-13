import { SessionCoachingFeedback } from "./coachingDomain";

export interface CoachingRepository {
  findByEvaluationAndVersion(evaluationId: string, coachVersion: string): Promise<SessionCoachingFeedback | null>;
  saveCompleted(feedback: SessionCoachingFeedback): Promise<SessionCoachingFeedback>;
  saveFailure(input: { id: string; evaluationId: string; evaluatorVersion: string; coachVersion: string; failureCode: string; now: string }): Promise<SessionCoachingFeedback>;
}
