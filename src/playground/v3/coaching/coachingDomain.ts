import { z } from "zod";
import { EvaluationCriterionKey } from "../evaluation/evaluationDomain";

export const COACH_VERSION = "testlab-coach-v1";
export const MAX_COACHING_PRIORITIES = 3;
export const MAX_COACH_TURNS = 36;
export const MAX_COACH_TURN_CHARS = 2_000;
export const MAX_COACH_TRANSCRIPT_CHARS = 48_000;

export type CoachingPriorityKind = "IMPROVEMENT" | "REFINEMENT";
export type CoachingStatus = "COMPLETED" | "FAILED";

export interface CoachingSelection {
  priorities: Array<{ criterionKey: EvaluationCriterionKey; kind: CoachingPriorityKind }>;
  reinforcementCriterionKey: EvaluationCriterionKey | null;
}

export interface CoachingProviderInput {
  evaluationId: string;
  evaluatorVersion: string;
  persona: { role: string; customerType: string };
  scenario: { title: string; description: string };
  mode: "CUSTOMER_FIRST" | "SALE_FIRST";
  priorities: Array<{
    criterionKey: EvaluationCriterionKey;
    criterionLabel: string;
    priorityKind: CoachingPriorityKind;
    evaluationSummary: string;
    improvementObservation: string | null;
    evidenceTurnSequences: number[];
    allowedTurnSequences: number[];
  }>;
  reinforcement: { criterionKey: EvaluationCriterionKey; criterionLabel: string; evaluationSummary: string; strengthObservation: string | null } | null;
  resolvedTopics: string[];
  missingTopics: string[];
  turns: Array<{ sequence: number; sender: "CUSTOMER" | "SALE"; content: string }>;
}

export interface CoachingPriority {
  criterionKey: EvaluationCriterionKey;
  priorityKind: CoachingPriorityKind;
  title: string;
  whyItMatters: string;
  observation: string;
  recommendedAction: string;
  suggestedPhrasing: string | null;
  evidenceTurnSequences: number[];
}

export interface StrengthReinforcement {
  criterionKey: EvaluationCriterionKey;
  message: string;
}

export interface SessionCoachingFeedback {
  id: string;
  evaluationId: string;
  evaluatorVersion: string;
  coachVersion: string;
  status: CoachingStatus;
  summary: string | null;
  priorities: CoachingPriority[];
  strengthReinforcement: StrengthReinforcement | null;
  nextPracticeFocus: string[];
  failureCode: string | null;
  coachedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const criterionKeySchema = z.enum(["TOPIC_COVERAGE", "NEEDS_DISCOVERY", "PRODUCT_CONSULTATION", "OBJECTION_HANDLING", "COMMUNICATION", "CLOSING"]);
const providerPrioritySchema = z.object({
  criterionKey: criterionKeySchema,
  priorityKind: z.enum(["IMPROVEMENT", "REFINEMENT"]),
  title: z.string().trim().min(1).max(80),
  whyItMatters: z.string().trim().min(1).max(240),
  observation: z.string().trim().min(1).max(280),
  recommendedAction: z.string().trim().min(1).max(280),
  suggestedPhrasing: z.string().trim().min(1).max(400).nullable(),
  evidenceTurnSequences: z.array(z.number().int().positive()).max(8)
}).strict();

export const coachingProviderOutputSchema = z.object({
  summary: z.string().trim().min(1).max(400),
  priorities: z.array(providerPrioritySchema).min(1).max(MAX_COACHING_PRIORITIES),
  strengthReinforcement: z.object({ criterionKey: criterionKeySchema, message: z.string().trim().min(1).max(240) }).strict().nullable(),
  nextPracticeFocus: z.array(z.string().trim().min(1).max(180)).min(1).max(2)
}).strict();

export type CoachingProviderOutput = z.infer<typeof coachingProviderOutputSchema>;
