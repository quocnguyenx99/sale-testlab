import { EVALUATION_RUBRIC, EVALUATOR_VERSION, EvaluationCriterionKey } from "../evaluation/evaluationDomain";
import {
  EligibleProgressEvaluation,
  ProgressCriterionSample,
  ProgressEvaluationSample,
  ProgressOverallMetrics,
  ProgressScoreSample,
  ProgressSessionCounts,
  ProgressSessionSample,
  ProgressSkillAnalytics,
  ProgressSkillInsights,
  ProgressTrainingFrequency,
  ProgressTrend,
  ProgressTrendPoint,
  RecentEvaluatedSessionProjection
} from "./progressDomain";

const RECENT_SAMPLE_LIMIT = 3;
const TREND_WINDOW_LIMIT = 3;
const TREND_THRESHOLD = 3;
const TREND_POINT_LIMIT = 12;
const RECENT_SESSION_LIMIT = 10;
export const PROGRESS_FREQUENCY_WINDOW_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1_000;

export const PROGRESS_CRITERIA = EVALUATION_RUBRIC.map(({ key, label }) => ({ key, label })) as ReadonlyArray<{
  key: EvaluationCriterionKey;
  label: string;
}>;

const criterionKeys = new Set<EvaluationCriterionKey>(PROGRESS_CRITERIA.map((criterion) => criterion.key));
const rubricOrder = new Map(PROGRESS_CRITERIA.map((criterion, index) => [criterion.key, index]));

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundOne(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function chronological<T extends { id: string; evaluatedAt: string }>(left: T, right: T): number {
  return Date.parse(left.evaluatedAt) - Date.parse(right.evaluatedAt) || compareText(left.id, right.id);
}

function reverseChronological<T extends { id: string; evaluatedAt: string }>(left: T, right: T): number {
  return Date.parse(right.evaluatedAt) - Date.parse(left.evaluatedAt) || compareText(left.id, right.id);
}

function isCriterionKey(value: unknown): value is EvaluationCriterionKey {
  return typeof value === "string" && criterionKeys.has(value as EvaluationCriterionKey);
}

function criterionValue(value: unknown): ProgressCriterionSample | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as ProgressCriterionSample
    : null;
}

export function toEligibleProgressEvaluation(sample: ProgressEvaluationSample): EligibleProgressEvaluation | null {
  const evaluatedAt = timestamp(sample.evaluatedAt);
  if (
    sample.status !== "COMPLETED"
    || sample.evaluatorVersion !== EVALUATOR_VERSION
    || !validScore(sample.overallScore)
    || evaluatedAt === null
    || !sample.evaluationId.trim()
    || !sample.sessionId.trim()
  ) return null;

  return {
    evaluationId: sample.evaluationId,
    sessionId: sample.sessionId,
    overallScore: sample.overallScore,
    evaluatedAt: new Date(evaluatedAt).toISOString(),
    criteria: Array.isArray(sample.criteria) ? sample.criteria : []
  };
}

export function eligibleProgressEvaluations(samples: readonly ProgressEvaluationSample[]): EligibleProgressEvaluation[] {
  return samples
    .map(toEligibleProgressEvaluation)
    .filter((sample): sample is EligibleProgressEvaluation => sample !== null)
    .sort((left, right) => chronological(
      { id: left.evaluationId, evaluatedAt: left.evaluatedAt },
      { id: right.evaluationId, evaluatedAt: right.evaluatedAt }
    ));
}

export function calculateTrend(samples: readonly ProgressScoreSample[]): ProgressTrend {
  const ordered = samples
    .filter((sample) => validScore(sample.score) && timestamp(sample.evaluatedAt) !== null)
    .map((sample) => ({ ...sample, evaluatedAt: new Date(timestamp(sample.evaluatedAt)!).toISOString() }))
    .sort(chronological);
  const sampleCount = ordered.length;
  if (sampleCount === 0) return { state: "NO_DATA", delta: null, sampleCount, comparisonWindowSize: 0 };
  if (sampleCount === 1) return { state: "BASELINE_ONLY", delta: null, sampleCount, comparisonWindowSize: 0 };
  if (sampleCount <= 3) return { state: "LIMITED_DATA", delta: null, sampleCount, comparisonWindowSize: 0 };

  const comparisonWindowSize = Math.min(TREND_WINDOW_LIMIT, Math.floor(sampleCount / 2));
  const recent = ordered.slice(-comparisonWindowSize).map((sample) => sample.score);
  const previous = ordered.slice(-comparisonWindowSize * 2, -comparisonWindowSize).map((sample) => sample.score);
  const rawDelta = average(recent) - average(previous);
  const state = rawDelta >= TREND_THRESHOLD
    ? "IMPROVING"
    : rawDelta <= -TREND_THRESHOLD
      ? "DECLINING"
      : "STABLE";
  return { state, delta: roundOne(rawDelta), sampleCount, comparisonWindowSize };
}

export function calculateOverallMetrics(samples: readonly ProgressEvaluationSample[]): ProgressOverallMetrics {
  const eligible = eligibleProgressEvaluations(samples);
  const scores = eligible.map((sample) => sample.overallScore);
  const recentScores = eligible.slice(-RECENT_SAMPLE_LIMIT).map((sample) => sample.overallScore);
  const trendSamples = eligible.map((sample) => ({ id: sample.evaluationId, evaluatedAt: sample.evaluatedAt, score: sample.overallScore }));
  return {
    evaluatedSessions: eligible.length,
    averageOverallScore: scores.length ? roundOne(average(scores)) : null,
    recentAverageScore: recentScores.length ? roundOne(average(recentScores)) : null,
    trend: calculateTrend(trendSamples)
  };
}

export function calculateSessionCounts(samples: readonly ProgressSessionSample[]): ProgressSessionCounts {
  return {
    totalSessions: samples.length,
    completedSessions: samples.filter((sample) => sample.status === "COMPLETED").length
  };
}

export function calculateTrainingFrequency(samples: readonly ProgressSessionSample[], referenceTime: string): ProgressTrainingFrequency {
  const reference = timestamp(referenceTime);
  if (reference === null) throw new Error("INVALID_REFERENCE_TIME");
  const lowerBoundary = reference - PROGRESS_FREQUENCY_WINDOW_DAYS * DAY_MS;
  const completedSessions = samples.filter((sample) => {
    if (sample.status !== "COMPLETED") return false;
    const completedAt = timestamp(sample.completedAt);
    return completedAt !== null && completedAt >= lowerBoundary && completedAt <= reference;
  }).length;
  return {
    windowDays: PROGRESS_FREQUENCY_WINDOW_DAYS,
    completedSessions,
    averagePerWeek: roundOne(completedSessions / 4)
  };
}

interface SkillCalculation {
  result: ProgressSkillAnalytics;
  rawAverage: number | null;
  rawRecent: number | null;
}

function skillSamples(evaluations: readonly EligibleProgressEvaluation[]): Map<EvaluationCriterionKey, ProgressScoreSample[]> {
  const samples = new Map(PROGRESS_CRITERIA.map((criterion) => [criterion.key, [] as ProgressScoreSample[]]));
  for (const evaluation of evaluations) {
    const validByKey = new Map<EvaluationCriterionKey, number[]>();
    for (const rawCriterion of evaluation.criteria) {
      const criterion = criterionValue(rawCriterion);
      if (!criterion || !isCriterionKey(criterion.key) || criterion.applicability !== "APPLICABLE" || !validScore(criterion.score)) continue;
      const scores = validByKey.get(criterion.key) ?? [];
      scores.push(criterion.score);
      validByKey.set(criterion.key, scores);
    }
    for (const [key, scores] of validByKey) {
      if (scores.length !== 1) continue;
      samples.get(key)!.push({ id: evaluation.evaluationId, evaluatedAt: evaluation.evaluatedAt, score: scores[0] });
    }
  }
  return samples;
}

function calculateSkills(evaluations: readonly EligibleProgressEvaluation[]): SkillCalculation[] {
  const samplesByKey = skillSamples(evaluations);
  return PROGRESS_CRITERIA.map((criterion) => {
    const samples = samplesByKey.get(criterion.key)!.slice().sort(chronological);
    const scores = samples.map((sample) => sample.score);
    const recentScores = samples.slice(-RECENT_SAMPLE_LIMIT).map((sample) => sample.score);
    const rawAverage = scores.length ? average(scores) : null;
    const rawRecent = recentScores.length ? average(recentScores) : null;
    return {
      rawAverage,
      rawRecent,
      result: {
        criterionKey: criterion.key,
        label: criterion.label,
        averageScore: rawAverage === null ? null : roundOne(rawAverage),
        recentScore: rawRecent === null ? null : roundOne(rawRecent),
        sampleCount: scores.length,
        trend: calculateTrend(samples)
      }
    };
  });
}

function orderOf(key: EvaluationCriterionKey): number {
  return rubricOrder.get(key) ?? Number.MAX_SAFE_INTEGER;
}

export function calculateSkillInsights(samples: readonly ProgressEvaluationSample[]): ProgressSkillInsights {
  const calculations = calculateSkills(eligibleProgressEvaluations(samples));
  const highlightCandidates = calculations.filter((skill) => skill.result.sampleCount >= 2 && skill.rawAverage !== null && skill.rawRecent !== null);
  const strongest = highlightCandidates.slice().sort((left, right) =>
    right.rawAverage! - left.rawAverage!
    || right.rawRecent! - left.rawRecent!
    || orderOf(left.result.criterionKey) - orderOf(right.result.criterionKey)
  )[0] ?? null;
  const needsAttention = highlightCandidates.filter((skill) => skill !== strongest).sort((left, right) =>
    left.rawAverage! - right.rawAverage!
    || left.rawRecent! - right.rawRecent!
    || orderOf(left.result.criterionKey) - orderOf(right.result.criterionKey)
  )[0] ?? null;
  return {
    skills: calculations.map((skill) => skill.result),
    strongestSkillKey: strongest?.result.criterionKey ?? null,
    needsAttentionSkillKey: needsAttention?.result.criterionKey ?? null
  };
}

export function buildOverallTrendPoints(samples: readonly ProgressEvaluationSample[]): ProgressTrendPoint[] {
  return eligibleProgressEvaluations(samples).slice(-TREND_POINT_LIMIT).map((sample) => ({
    sessionId: sample.sessionId,
    evaluatedAt: sample.evaluatedAt,
    score: roundOne(sample.overallScore)
  }));
}

export function selectRecentEvaluatedSessions(samples: readonly ProgressEvaluationSample[]): RecentEvaluatedSessionProjection[] {
  return eligibleProgressEvaluations(samples)
    .slice()
    .sort((left, right) => reverseChronological(
      { id: left.evaluationId, evaluatedAt: left.evaluatedAt },
      { id: right.evaluationId, evaluatedAt: right.evaluatedAt }
    ))
    .slice(0, RECENT_SESSION_LIMIT)
    .map((sample) => ({
      evaluationId: sample.evaluationId,
      sessionId: sample.sessionId,
      evaluatedAt: sample.evaluatedAt,
      score: roundOne(sample.overallScore)
    }));
}
