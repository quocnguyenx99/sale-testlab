import {
  EVALUATOR_VERSION,
  EVALUATION_RUBRIC,
  EvaluatedCriterion,
  EvaluationCriterionKey,
  EvaluationInput,
  QualitativeEvaluation,
  SessionEvaluationRecord
} from "./evaluationDomain";

const PRODUCT_TOPICS = new Set(["product_model", "configuration"]);
const SAFE_OBJECTION_PATTERN = /(?:nhưng|nhung|tuy nhiên|tuy nhien|đắt|dat|cao quá|cao qua|chưa phù hợp|chua phu hop|không chắc|khong chac|băn khoăn|ban khoan|lo ngại|lo ngai|so sánh|so sanh|cân nhắc|can nhac)/iu;

export function criterionApplicability(input: EvaluationInput): Record<EvaluationCriterionKey, boolean> {
  const saleTurns = input.turns.filter((turn) => turn.sender === "SALE").length;
  const productApplied = input.resolvedTopics.some((topic) => PRODUCT_TOPICS.has(topic)) || input.missingTopics.some((topic) => PRODUCT_TOPICS.has(topic));
  const objectionApplied = input.turns.some((turn) => turn.sender === "CUSTOMER" && SAFE_OBJECTION_PATTERN.test(turn.content));
  return {
    TOPIC_COVERAGE: true,
    NEEDS_DISCOVERY: saleTurns > 0,
    PRODUCT_CONSULTATION: productApplied,
    OBJECTION_HANDLING: objectionApplied,
    COMMUNICATION: saleTurns > 0,
    CLOSING: saleTurns >= 2
  };
}

export function deterministicTopicCoverage(input: EvaluationInput): number {
  const total = input.resolvedTopics.length + input.missingTopics.length;
  return total === 0 ? 0 : Math.round((input.resolvedTopics.length / total) * 100);
}

export function buildEvaluationCriteria(input: EvaluationInput, qualitative: QualitativeEvaluation): EvaluatedCriterion[] {
  const applicability = criterionApplicability(input);
  const qualitativeByKey = new Map(qualitative.criteria.map((criterion) => [criterion.key, criterion]));
  const applicableWeight = EVALUATION_RUBRIC.filter((criterion) => applicability[criterion.key]).reduce((sum, criterion) => sum + criterion.weight, 0);
  return EVALUATION_RUBRIC.map((definition) => {
    if (!applicability[definition.key]) {
      return { ...definition, score: null, effectiveWeight: 0, applicability: "NOT_APPLICABLE", summary: "Tiêu chí không phát sinh trong phiên này.", evidenceTurnSequences: [] };
    }
    if (definition.key === "TOPIC_COVERAGE") {
      const score = deterministicTopicCoverage(input);
      return { ...definition, score, effectiveWeight: roundWeight(definition.weight / applicableWeight * 100), applicability: "APPLICABLE", summary: `${input.resolvedTopics.length}/${input.resolvedTopics.length + input.missingTopics.length} chủ đề được ghi nhận đã giải quyết.`, evidenceTurnSequences: [] };
    }
    const result = qualitativeByKey.get(definition.key as Exclude<EvaluationCriterionKey, "TOPIC_COVERAGE">);
    if (!result) throw new Error(`MISSING_QUALITATIVE_CRITERION:${definition.key}`);
    const maxSequence = input.turns.at(-1)?.sequence ?? 0;
    if (result.evidenceTurnSequences.some((sequence) => sequence > maxSequence)) throw new Error(`INVALID_EVIDENCE_SEQUENCE:${definition.key}`);
    return { ...definition, score: result.score, effectiveWeight: roundWeight(definition.weight / applicableWeight * 100), applicability: "APPLICABLE", summary: result.summary, evidenceTurnSequences: [...new Set(result.evidenceTurnSequences)] };
  });
}

export function calculateOverallScore(criteria: EvaluatedCriterion[]): number {
  const applicable = criteria.filter((criterion) => criterion.applicability === "APPLICABLE" && criterion.score !== null);
  const weight = applicable.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (weight === 0) return 0;
  return Math.max(0, Math.min(100, Math.round(applicable.reduce((sum, criterion) => sum + criterion.score! * criterion.weight, 0) / weight)));
}

export function evaluationObservations(criteria: EvaluatedCriterion[]): { strengths: string[]; improvementAreas: string[] } {
  const applicable = criteria.filter((criterion) => criterion.applicability === "APPLICABLE" && criterion.score !== null);
  return {
    strengths: applicable.filter((criterion) => criterion.score! >= 70).sort((a, b) => b.score! - a.score!).slice(0, 3).map((criterion) => criterion.summary),
    improvementAreas: applicable.filter((criterion) => criterion.score! < 70).sort((a, b) => a.score! - b.score!).slice(0, 3).map((criterion) => criterion.summary)
  };
}

export function buildSessionEvaluation(input: { id: string; input: EvaluationInput; qualitative: QualitativeEvaluation; evaluatedAt: string }): SessionEvaluationRecord {
  const criteria = buildEvaluationCriteria(input.input, input.qualitative);
  const observations = evaluationObservations(criteria);
  return {
    id: input.id,
    sessionId: input.input.sessionId,
    evaluatorVersion: EVALUATOR_VERSION,
    status: "COMPLETED",
    overallScore: calculateOverallScore(criteria),
    criteria,
    strengths: observations.strengths,
    improvementAreas: observations.improvementAreas,
    failureCode: null,
    evaluatedAt: input.evaluatedAt,
    createdAt: input.evaluatedAt,
    updatedAt: input.evaluatedAt
  };
}

function roundWeight(value: number): number {
  return Math.round(value * 100) / 100;
}
