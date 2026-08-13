import { EVALUATION_RUBRIC, EvaluatedCriterion, SessionEvaluationRecord } from "../evaluation/evaluationDomain";
import { COACH_VERSION, CoachingProviderInput, CoachingProviderOutput, CoachingSelection, MAX_COACHING_PRIORITIES, SessionCoachingFeedback, coachingProviderOutputSchema } from "./coachingDomain";

const rubricOrder = new Map(EVALUATION_RUBRIC.map((criterion, index) => [criterion.key, index]));
const falseWeaknessPattern = /(?:điểm yếu|kém|chưa đạt|cần khắc phục)/iu;

function validApplicable(evaluation: SessionEvaluationRecord): EvaluatedCriterion[] {
  return evaluation.criteria.filter((criterion) => criterion.applicability === "APPLICABLE" && criterion.score !== null);
}

export function selectCoachingPlan(evaluation: SessionEvaluationRecord): CoachingSelection {
  const applicable = validApplicable(evaluation);
  if (applicable.length === 0) throw new Error("NO_APPLICABLE_CRITERIA");
  const weak = applicable.filter((criterion) => criterion.score! < 70).sort(prioritySort);
  const priorities = weak.length > 0
    ? weak.slice(0, MAX_COACHING_PRIORITIES).map((criterion) => ({ criterionKey: criterion.key, kind: "IMPROVEMENT" as const }))
    : [applicable.slice().sort(prioritySort)[0]].map((criterion) => ({ criterionKey: criterion.key, kind: "REFINEMENT" as const }));
  const priorityKeys = new Set(priorities.map((priority) => priority.criterionKey));
  const reinforcement = applicable
    .filter((criterion) => criterion.score! >= 70 && !priorityKeys.has(criterion.key))
    .sort((left, right) => right.score! - left.score! || right.effectiveWeight - left.effectiveWeight || order(left) - order(right))[0];
  return { priorities, reinforcementCriterionKey: reinforcement?.key ?? null };
}

function prioritySort(left: EvaluatedCriterion, right: EvaluatedCriterion): number {
  return left.score! - right.score! || right.effectiveWeight - left.effectiveWeight || order(left) - order(right);
}

function order(criterion: EvaluatedCriterion): number { return rubricOrder.get(criterion.key) ?? Number.MAX_SAFE_INTEGER; }

export function buildCoachingFeedback(input: { id: string; evaluation: SessionEvaluationRecord; providerInput: CoachingProviderInput; output: unknown; coachedAt: string }): SessionCoachingFeedback {
  const output = coachingProviderOutputSchema.parse(input.output) as CoachingProviderOutput;
  const expected = input.providerInput.priorities;
  if (output.priorities.length !== expected.length) throw new Error("INVALID_PRIORITY_SET");
  const seen = new Set<string>();
  for (let index = 0; index < output.priorities.length; index += 1) {
    const priority = output.priorities[index];
    const selected = expected[index];
    if (seen.has(priority.criterionKey) || priority.criterionKey !== selected.criterionKey || priority.priorityKind !== selected.priorityKind) throw new Error("INVALID_PRIORITY_SET");
    seen.add(priority.criterionKey);
    const allowed = new Set(selected.allowedTurnSequences);
    if (priority.evidenceTurnSequences.some((sequence) => !allowed.has(sequence))) throw new Error("INVALID_COACH_EVIDENCE");
    if (priority.priorityKind === "REFINEMENT" && falseWeaknessPattern.test([priority.title, priority.whyItMatters, priority.observation, priority.recommendedAction].join(" "))) {
      throw new Error("INVALID_REFINEMENT_LANGUAGE");
    }
  }
  const expectedReinforcement = input.providerInput.reinforcement?.criterionKey ?? null;
  const actualReinforcement = output.strengthReinforcement?.criterionKey ?? null;
  if (expectedReinforcement !== actualReinforcement) throw new Error("INVALID_REINFORCEMENT");
  return {
    id: input.id,
    evaluationId: input.evaluation.id,
    evaluatorVersion: input.evaluation.evaluatorVersion,
    coachVersion: COACH_VERSION,
    status: "COMPLETED",
    summary: output.summary,
    priorities: output.priorities.map((priority) => ({ ...priority, evidenceTurnSequences: [...new Set(priority.evidenceTurnSequences)] })),
    strengthReinforcement: output.strengthReinforcement,
    nextPracticeFocus: output.nextPracticeFocus,
    failureCode: null,
    coachedAt: input.coachedAt,
    createdAt: input.coachedAt,
    updatedAt: input.coachedAt
  };
}
