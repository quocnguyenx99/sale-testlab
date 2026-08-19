import { EvaluationCriterionKey } from "../evaluation/evaluationDomain";

export type ProgressTrendState =
  | "NO_DATA"
  | "BASELINE_ONLY"
  | "LIMITED_DATA"
  | "IMPROVING"
  | "STABLE"
  | "DECLINING";

export interface ProgressCriterionSample {
  key: unknown;
  applicability: unknown;
  score: unknown;
}

export interface ProgressEvaluationSample {
  evaluationId: string;
  sessionId: string;
  evaluatorVersion: unknown;
  status: unknown;
  overallScore: unknown;
  evaluatedAt: unknown;
  criteria: unknown;
}

export interface EligibleProgressEvaluation {
  evaluationId: string;
  sessionId: string;
  overallScore: number;
  evaluatedAt: string;
  criteria: readonly unknown[];
}

export interface ProgressSessionSample {
  sessionId: string;
  status: unknown;
  completedAt: unknown;
}

export interface ProgressScoreSample {
  id: string;
  evaluatedAt: string;
  score: number;
}

export interface ProgressTrend {
  state: ProgressTrendState;
  delta: number | null;
  sampleCount: number;
  comparisonWindowSize: number;
}

export interface ProgressOverallMetrics {
  evaluatedSessions: number;
  averageOverallScore: number | null;
  recentAverageScore: number | null;
  trend: ProgressTrend;
}

export interface ProgressTrainingFrequency {
  windowDays: 28;
  completedSessions: number;
  averagePerWeek: number;
}

export interface ProgressSkillAnalytics {
  criterionKey: EvaluationCriterionKey;
  label: string;
  averageScore: number | null;
  recentScore: number | null;
  sampleCount: number;
  trend: ProgressTrend;
}

export interface ProgressSkillInsights {
  skills: ProgressSkillAnalytics[];
  strongestSkillKey: EvaluationCriterionKey | null;
  needsAttentionSkillKey: EvaluationCriterionKey | null;
}

export interface ProgressTrendPoint {
  sessionId: string;
  evaluatedAt: string;
  score: number;
}

export interface RecentEvaluatedSessionProjection extends ProgressTrendPoint {
  evaluationId: string;
}

export interface ProgressSessionCounts {
  totalSessions: number;
  completedSessions: number;
}
