import { strict as assert } from "assert";
import { EVALUATOR_VERSION, EvaluationCriterionKey } from "../evaluation/evaluationDomain";
import { ProgressEvaluationSample, ProgressScoreSample, ProgressSessionSample } from "./progressDomain";
import {
  buildOverallTrendPoints,
  calculateOverallMetrics,
  calculateSessionCounts,
  calculateSkillInsights,
  calculateTrainingFrequency,
  calculateTrend,
  eligibleProgressEvaluations,
  PROGRESS_CRITERIA,
  selectRecentEvaluatedSessions
} from "./progressMetrics";

const criterion = (key: unknown, score: unknown, applicability: unknown = "APPLICABLE") => ({ key, score, applicability });
const evaluatedAt = (day: number) => new Date(Date.UTC(2026, 7, day, 8)).toISOString();

function evaluation(
  index: number,
  overallScore: unknown,
  criteria: unknown = [],
  overrides: Partial<ProgressEvaluationSample> = {}
): ProgressEvaluationSample {
  return {
    evaluationId: `evaluation-${String(index).padStart(2, "0")}`,
    sessionId: `session-${String(index).padStart(2, "0")}`,
    evaluatorVersion: EVALUATOR_VERSION,
    status: "COMPLETED",
    overallScore,
    evaluatedAt: evaluatedAt(index),
    criteria,
    ...overrides
  };
}

function trendScores(scores: number[]): ProgressScoreSample[] {
  return scores.map((score, index) => ({ id: `score-${String(index).padStart(2, "0")}`, evaluatedAt: evaluatedAt(index + 1), score }));
}

function criteriaFor(scores: Partial<Record<EvaluationCriterionKey, number>>, applicability: Partial<Record<EvaluationCriterionKey, unknown>> = {}) {
  return PROGRESS_CRITERIA.filter((item) => scores[item.key] !== undefined).map((item) =>
    criterion(item.key, scores[item.key], applicability[item.key] ?? "APPLICABLE")
  );
}

function main() {
  const eligibility = [
    evaluation(1, 80),
    evaluation(2, 70, [], { status: "FAILED" }),
    evaluation(3, 70, [], { evaluatorVersion: "testlab-evaluator-v2" }),
    evaluation(4, null),
    evaluation(5, -1),
    evaluation(6, 101),
    evaluation(7, Number.NaN),
    evaluation(8, 75, [], { evaluatedAt: null })
  ];
  assert.deepEqual(eligibleProgressEvaluations(eligibility).map((sample) => sample.evaluationId), ["evaluation-01"]);

  const malformedCriterion = evaluation(1, 82, [
    criterion("COMMUNICATION", "invalid"),
    criterion("NEEDS_DISCOVERY", 74)
  ]);
  assert.equal(calculateOverallMetrics([malformedCriterion]).evaluatedSessions, 1, "malformed criterion must not invalidate overall score");
  const malformedSkills = calculateSkillInsights([malformedCriterion]).skills;
  assert.equal(malformedSkills.find((skill) => skill.criterionKey === "COMMUNICATION")?.sampleCount, 0);
  assert.equal(malformedSkills.find((skill) => skill.criterionKey === "NEEDS_DISCOVERY")?.sampleCount, 1);

  const notApplicable = evaluation(1, 50, [criterion("COMMUNICATION", 0, "NOT_APPLICABLE")]);
  const notApplicableSkill = calculateSkillInsights([notApplicable]).skills.find((skill) => skill.criterionKey === "COMMUNICATION")!;
  assert.equal(notApplicableSkill.sampleCount, 0);
  assert.equal(notApplicableSkill.averageScore, null);

  assert.deepEqual(calculateOverallMetrics([]), {
    evaluatedSessions: 0,
    averageOverallScore: null,
    recentAverageScore: null,
    trend: { state: "NO_DATA", delta: null, sampleCount: 0, comparisonWindowSize: 0 }
  });
  assert.equal(calculateOverallMetrics([evaluation(1, 77)]).averageOverallScore, 77);
  const averages = calculateOverallMetrics([evaluation(1, 80), evaluation(2, 81), evaluation(3, 80)]);
  assert.equal(averages.averageOverallScore, 80.3);
  assert.equal(averages.recentAverageScore, 80.3);
  assert.equal(calculateOverallMetrics([
    evaluation(1, 10), evaluation(2, 20), evaluation(3, 30), evaluation(4, 40)
  ]).recentAverageScore, 30, "recent average must use the latest three samples");
  assert.equal(calculateOverallMetrics([evaluation(1, 10), evaluation(2, 20)]).recentAverageScore, 15);

  assert.deepEqual(calculateTrend([]), { state: "NO_DATA", delta: null, sampleCount: 0, comparisonWindowSize: 0 });
  assert.equal(calculateTrend(trendScores([50])).state, "BASELINE_ONLY");
  assert.equal(calculateTrend(trendScores([50, 60])).state, "LIMITED_DATA");
  assert.equal(calculateTrend(trendScores([50, 60, 70])).state, "LIMITED_DATA");
  assert.deepEqual(calculateTrend(trendScores([50, 50, 53, 53])), { state: "IMPROVING", delta: 3, sampleCount: 4, comparisonWindowSize: 2 });
  assert.equal(calculateTrend(trendScores([50, 50, 52.9, 52.9])).state, "STABLE");
  assert.deepEqual(calculateTrend(trendScores([53, 53, 50, 50])), { state: "DECLINING", delta: -3, sampleCount: 4, comparisonWindowSize: 2 });
  assert.equal(calculateTrend(trendScores([50, 50, 47.1, 47.1])).state, "STABLE", "delta just above -3 must remain stable");
  const fiveSamples = calculateTrend(trendScores([100, 10, 10, 20, 20]));
  assert.equal(fiveSamples.comparisonWindowSize, 2);
  assert.equal(fiveSamples.delta, 10, "five-sample trend must compare the latest two windows and ignore the oldest remainder");
  assert.equal(calculateTrend(trendScores([10, 10, 10, 20, 20, 20])).comparisonWindowSize, 3);
  const sameTime = evaluatedAt(1);
  const tiedTrend = calculateTrend([
    { id: "d", evaluatedAt: sameTime, score: 90 },
    { id: "b", evaluatedAt: sameTime, score: 10 },
    { id: "c", evaluatedAt: sameTime, score: 90 },
    { id: "a", evaluatedAt: sameTime, score: 10 }
  ]);
  assert.equal(tiedTrend.state, "IMPROVING", "ID must provide a stable timestamp tie-break");

  const emptySkills = calculateSkillInsights([]);
  assert.deepEqual(emptySkills.skills.map((skill) => skill.criterionKey), PROGRESS_CRITERIA.map((criterion) => criterion.key));
  assert(emptySkills.skills.every((skill) => skill.sampleCount === 0 && skill.averageScore === null && skill.recentScore === null && skill.trend.state === "NO_DATA"));
  assert.equal(emptySkills.strongestSkillKey, null);
  assert.equal(emptySkills.needsAttentionSkillKey, null);

  const skillEvaluations = [
    evaluation(1, 70, [criterion("NEEDS_DISCOVERY", 70), criterion("UNKNOWN_SKILL", 100), criterion("COMMUNICATION", 100, "NOT_APPLICABLE")]),
    evaluation(2, 70, [criterion("NEEDS_DISCOVERY", 80), criterion("COMMUNICATION", "bad")]),
    evaluation(3, 70, [criterion("NEEDS_DISCOVERY", 90)]),
    evaluation(4, 70, [criterion("NEEDS_DISCOVERY", 100)])
  ];
  const needsDiscovery = calculateSkillInsights(skillEvaluations).skills.find((skill) => skill.criterionKey === "NEEDS_DISCOVERY")!;
  assert.equal(needsDiscovery.sampleCount, 4);
  assert.equal(needsDiscovery.averageScore, 85);
  assert.equal(needsDiscovery.recentScore, 90);
  assert.equal(needsDiscovery.trend.state, "IMPROVING");
  assert.equal(calculateSkillInsights(skillEvaluations).skills.find((skill) => skill.criterionKey === "COMMUNICATION")?.sampleCount, 0);

  const duplicateCriterion = evaluation(1, 70, [criterion("COMMUNICATION", 70), criterion("COMMUNICATION", 80)]);
  assert.equal(calculateSkillInsights([duplicateCriterion]).skills.find((skill) => skill.criterionKey === "COMMUNICATION")?.sampleCount, 0, "ambiguous duplicate criterion must be excluded from that skill");

  const highlightScores: Partial<Record<EvaluationCriterionKey, number>> = {
    TOPIC_COVERAGE: 90,
    NEEDS_DISCOVERY: 90,
    PRODUCT_CONSULTATION: 70,
    OBJECTION_HANDLING: 60,
    COMMUNICATION: 50,
    CLOSING: 50
  };
  const highlights = calculateSkillInsights([
    evaluation(1, 70, criteriaFor(highlightScores)),
    evaluation(2, 70, criteriaFor(highlightScores))
  ]);
  assert.equal(highlights.strongestSkillKey, "TOPIC_COVERAGE", "strongest tie must use rubric order");
  assert.equal(highlights.needsAttentionSkillKey, "COMMUNICATION", "attention tie must use rubric order");
  assert.notEqual(highlights.strongestSkillKey, highlights.needsAttentionSkillKey);

  const singleSampleHighlights = calculateSkillInsights([evaluation(1, 80, criteriaFor({ COMMUNICATION: 80 }))]);
  assert.equal(singleSampleHighlights.strongestSkillKey, null, "one sample cannot create a highlight");
  const oneEligibleSkill = calculateSkillInsights([
    evaluation(1, 80, criteriaFor({ COMMUNICATION: 80 })),
    evaluation(2, 90, criteriaFor({ COMMUNICATION: 90 }))
  ]);
  assert.equal(oneEligibleSkill.strongestSkillKey, "COMMUNICATION");
  assert.equal(oneEligibleSkill.needsAttentionSkillKey, null);

  const referenceTime = "2026-08-18T12:00:00.000Z";
  const sessions: ProgressSessionSample[] = [
    { sessionId: "boundary", status: "COMPLETED", completedAt: "2026-07-21T12:00:00.000Z" },
    { sessionId: "current", status: "COMPLETED", completedAt: referenceTime },
    { sessionId: "inside", status: "COMPLETED", completedAt: "2026-08-01T00:00:00.000Z" },
    { sessionId: "outside", status: "COMPLETED", completedAt: "2026-07-21T11:59:59.999Z" },
    { sessionId: "future", status: "COMPLETED", completedAt: "2026-08-18T12:00:00.001Z" },
    { sessionId: "running", status: "RUNNING", completedAt: referenceTime }
  ];
  assert.deepEqual(calculateTrainingFrequency([], referenceTime), { windowDays: 28, completedSessions: 0, averagePerWeek: 0 });
  assert.deepEqual(calculateTrainingFrequency(sessions, referenceTime), { windowDays: 28, completedSessions: 3, averagePerWeek: 0.8 });
  assert.deepEqual(calculateSessionCounts(sessions), { totalSessions: 6, completedSessions: 5 });
  assert.throws(() => calculateTrainingFrequency(sessions, "invalid"), /INVALID_REFERENCE_TIME/);

  const manyEvaluations = Array.from({ length: 14 }, (_, index) => evaluation(index + 1, index + 1));
  const points = buildOverallTrendPoints(manyEvaluations);
  assert.equal(points.length, 12);
  assert.deepEqual(points.map((point) => point.sessionId), manyEvaluations.slice(2).map((sample) => sample.sessionId));
  assert.deepEqual(points.map((point) => point.score), Array.from({ length: 12 }, (_, index) => index + 3));
  const recent = selectRecentEvaluatedSessions(manyEvaluations);
  assert.equal(recent.length, 10);
  assert.deepEqual(recent.map((item) => item.evaluationId), manyEvaluations.slice(4).reverse().map((sample) => sample.evaluationId));

  const tieRecent = selectRecentEvaluatedSessions([
    evaluation(1, 80, [], { evaluationId: "b", sessionId: "session-b", evaluatedAt: sameTime }),
    evaluation(2, 80, [], { evaluationId: "a", sessionId: "session-a", evaluatedAt: sameTime })
  ]);
  assert.deepEqual(tieRecent.map((item) => item.evaluationId), ["a", "b"]);

  console.log("Phase 9A progress analytics domain tests: PASS");
}

main();
