import { SessionEvaluationRecord } from "../evaluation/evaluationDomain";
import { SimulationSession } from "../simulationSession";
import { CoachingProviderInput, CoachingSelection, MAX_COACH_TRANSCRIPT_CHARS, MAX_COACH_TURN_CHARS, MAX_COACH_TURNS } from "./coachingDomain";

export class CoachingInputError extends Error {
  constructor(public readonly code: "INVALID_EVALUATION_EVIDENCE") { super(code); }
}

export function buildCoachingProviderInput(session: SimulationSession, evaluation: SessionEvaluationRecord, selection: CoachingSelection): CoachingProviderInput {
  const indexed = new Map(session.messages.map((message, index) => [index + 1, { sequence: index + 1, sender: message.sender, content: message.content }]));
  const criteria = new Map(evaluation.criteria.map((criterion) => [criterion.key, criterion]));
  const exactByCriterion = new Map<string, number[]>();
  const exactSequences = new Set<number>();
  for (const selected of selection.priorities) {
    const criterion = criteria.get(selected.criterionKey);
    if (!criterion) throw new CoachingInputError("INVALID_EVALUATION_EVIDENCE");
    const sequences = [...new Set(criterion.evidenceTurnSequences)].sort((a, b) => a - b);
    if (sequences.some((sequence) => !indexed.has(sequence))) throw new CoachingInputError("INVALID_EVALUATION_EVIDENCE");
    exactByCriterion.set(selected.criterionKey, sequences);
    sequences.forEach((sequence) => exactSequences.add(sequence));
  }
  if (exactSequences.size > MAX_COACH_TURNS) throw new CoachingInputError("INVALID_EVALUATION_EVIDENCE");

  const selectedTurns = new Map<number, { sequence: number; sender: "CUSTOMER" | "SALE"; content: string }>();
  const exact = [...exactSequences].sort((a, b) => a - b);
  const exactPerTurnBudget = exact.length > 0 ? Math.min(MAX_COACH_TURN_CHARS, Math.floor(MAX_COACH_TRANSCRIPT_CHARS / exact.length)) : MAX_COACH_TURN_CHARS;
  let usedChars = 0;
  for (const sequence of exact) {
    const turn = indexed.get(sequence)!;
    const content = turn.content.slice(0, exactPerTurnBudget);
    selectedTurns.set(sequence, { ...turn, content });
    usedChars += content.length;
  }

  const adjacent = new Set<number>();
  exact.forEach((sequence) => { if (indexed.has(sequence - 1) && !exactSequences.has(sequence - 1)) adjacent.add(sequence - 1); if (indexed.has(sequence + 1) && !exactSequences.has(sequence + 1)) adjacent.add(sequence + 1); });
  for (const sequence of [...adjacent].sort((a, b) => a - b)) {
    if (selectedTurns.size >= MAX_COACH_TURNS || usedChars >= MAX_COACH_TRANSCRIPT_CHARS) break;
    const turn = indexed.get(sequence)!;
    const available = MAX_COACH_TRANSCRIPT_CHARS - usedChars;
    const content = turn.content.slice(0, Math.min(MAX_COACH_TURN_CHARS, available));
    if (!content) break;
    selectedTurns.set(sequence, { ...turn, content });
    usedChars += content.length;
  }

  const allowedFor = (criterionKey: string): number[] => {
    const allowed = new Set<number>();
    for (const sequence of exactByCriterion.get(criterionKey) ?? []) {
      if (selectedTurns.has(sequence)) allowed.add(sequence);
      if (selectedTurns.has(sequence - 1)) allowed.add(sequence - 1);
      if (selectedTurns.has(sequence + 1)) allowed.add(sequence + 1);
    }
    return [...allowed].sort((a, b) => a - b);
  };

  const reinforcementCriterion = selection.reinforcementCriterionKey ? criteria.get(selection.reinforcementCriterionKey) : null;
  return {
    evaluationId: evaluation.id,
    evaluatorVersion: evaluation.evaluatorVersion,
    persona: { role: session.personaSnapshot.role, customerType: session.personaSnapshot.customerType },
    scenario: { title: session.scenarioSnapshot.title, description: session.scenarioSnapshot.description },
    mode: session.mode,
    priorities: selection.priorities.map((selected) => {
      const criterion = criteria.get(selected.criterionKey)!;
      return {
        criterionKey: criterion.key,
        criterionLabel: criterion.label,
        priorityKind: selected.kind,
        evaluationSummary: criterion.summary,
        improvementObservation: evaluation.improvementAreas.includes(criterion.summary) ? criterion.summary : null,
        evidenceTurnSequences: exactByCriterion.get(criterion.key) ?? [],
        allowedTurnSequences: allowedFor(criterion.key)
      };
    }),
    reinforcement: reinforcementCriterion ? {
      criterionKey: reinforcementCriterion.key,
      criterionLabel: reinforcementCriterion.label,
      evaluationSummary: reinforcementCriterion.summary,
      strengthObservation: evaluation.strengths.includes(reinforcementCriterion.summary) ? reinforcementCriterion.summary : null
    } : null,
    resolvedTopics: session.result?.resolvedTopics ?? [],
    missingTopics: session.result?.missingTopics ?? [],
    turns: [...selectedTurns.values()].sort((a, b) => a.sequence - b.sequence)
  };
}

export function coachingInputSize(input: CoachingProviderInput) {
  return { turns: input.turns.length, transcriptCharacters: input.turns.reduce((sum, turn) => sum + turn.content.length, 0), totalCharacters: JSON.stringify(input).length };
}
