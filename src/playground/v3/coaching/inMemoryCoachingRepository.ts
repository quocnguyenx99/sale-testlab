import { CoachingRepository } from "./coachingRepository";
import { SessionCoachingFeedback } from "./coachingDomain";

export class InMemoryCoachingRepository implements CoachingRepository {
  private readonly records = new Map<string, SessionCoachingFeedback>();
  private key(evaluationId: string, coachVersion: string) { return `${evaluationId}:${coachVersion}`; }
  async findByEvaluationAndVersion(evaluationId: string, coachVersion: string) { return this.records.get(this.key(evaluationId, coachVersion)) ?? null; }
  async saveCompleted(feedback: SessionCoachingFeedback) {
    const key = this.key(feedback.evaluationId, feedback.coachVersion);
    const previous = this.records.get(key);
    const completed = { ...feedback, id: previous?.id ?? feedback.id, createdAt: previous?.createdAt ?? feedback.createdAt };
    this.records.set(key, completed);
    return completed;
  }
  async saveFailure(input: { id: string; evaluationId: string; evaluatorVersion: string; coachVersion: string; failureCode: string; now: string }) {
    const key = this.key(input.evaluationId, input.coachVersion);
    const previous = this.records.get(key);
    if (previous?.status === "COMPLETED") return previous;
    const failed: SessionCoachingFeedback = {
      id: previous?.id ?? input.id, evaluationId: input.evaluationId, evaluatorVersion: input.evaluatorVersion, coachVersion: input.coachVersion,
      status: "FAILED", summary: null, priorities: [], strengthReinforcement: null, nextPracticeFocus: [], failureCode: input.failureCode,
      coachedAt: null, createdAt: previous?.createdAt ?? input.now, updatedAt: input.now
    };
    this.records.set(key, failed);
    return failed;
  }
}
