import {
  ProgressEvaluationSample,
  ProgressSessionCounts,
  ProgressSessionSample
} from "./progressDomain";

export type ProgressTrainingMode = "CUSTOMER_FIRST" | "SALE_FIRST";

export interface ProgressEvaluationRepositorySample extends ProgressEvaluationSample {
  mode: ProgressTrainingMode;
  personaDisplayName: string;
}

export interface ProgressRepository {
  getSessionCounts(userId: string): Promise<ProgressSessionCounts>;
  getCompletedSessionsInWindow(userId: string, from: Date, to: Date): Promise<ProgressSessionSample[]>;
  getEvaluationSamples(userId: string): Promise<ProgressEvaluationRepositorySample[]>;
}
