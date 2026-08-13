export type PublicTrainingMode = "CUSTOMER_FIRST" | "SALE_FIRST";
export type PublicSessionStatus = "RUNNING" | "COMPLETED";

export interface PublicEvaluationCriterion {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  effectiveWeight: number;
  source: "DETERMINISTIC" | "LLM" | "HYBRID";
  applicability: "APPLICABLE" | "NOT_APPLICABLE";
  summary: string;
  evidenceTurnSequences: number[];
}

export interface PublicSessionEvaluation {
  id: string;
  evaluatorVersion: string;
  status: "COMPLETED" | "FAILED";
  overallScore: number | null;
  criteria: PublicEvaluationCriterion[];
  strengths: string[];
  improvementAreas: string[];
  evaluatedAt: string | null;
}

export interface PublicScenario {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface PublicPersona {
  id: string;
  displayName: string;
  role: string;
  customerType: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  summary: string;
  interests: string[];
  scenarioContext: string;
  defaultScenario: PublicScenario;
}

export interface PublicChatMessage {
  id: string;
  sender: "CUSTOMER" | "SALE";
  content: string;
  createdAt: string;
}

export interface PublicRuntimeInsight {
  runtimeState: string;
  resolvedTopics: string[];
  missingTopics: string[];
  nextUnresolvedTopic: string | null;
  dealOutcome: string;
  trainingStatus: string;
  topicProgress: { resolved: number; total: number };
  activeProduct: { model: string; code: string } | null;
}

export interface PublicSessionResult {
  outcome: string;
  trainingStatus: string;
  turnCount: number;
  durationSeconds: number;
  resolvedTopics: string[];
  missingTopics: string[];
  signals: string[];
}

export interface PublicRecentSession {
  id: string;
  persona: Pick<PublicPersona, "id" | "displayName" | "role" | "customerType">;
  mode: PublicTrainingMode;
  status: PublicSessionStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  turnCount: number;
  dealOutcome: string | null;
  trainingStatus: string | null;
}

export interface PublicSession {
  id: string;
  persona: PublicPersona;
  scenario: PublicScenario;
  mode: PublicTrainingMode;
  status: PublicSessionStatus;
  createdAt: string;
  completedAt: string | null;
  messages: PublicChatMessage[];
  runtimeInsight: PublicRuntimeInsight | null;
  result?: PublicSessionResult;
}
