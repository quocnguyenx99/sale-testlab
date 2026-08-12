export type SimulationMode = "CUSTOMER_FIRST" | "SALE_FIRST";
export type SimulationStatus = "RUNNING" | "COMPLETED";

export interface EnrichedPersonaSource {
  persona_id: string;
  display_name: string;
  buyer_role: string;
  organization_type: string;
  product_interest_categories: string[];
  purchase_context: string;
  difficulty: string;
}

export interface SimulationPersonaSnapshot {
  id: string;
  displayName: string;
  role: string;
  customerType: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  summary: string;
  interests: string[];
  scenarioContext: string;
}

export interface SimulationScenarioSnapshot {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface SimulationMessage {
  id: string;
  sender: "CUSTOMER" | "SALE";
  content: string;
  createdAt: string;
}

export interface SimulationRuntimeInsight {
  runtimeState: string;
  resolvedTopics: string[];
  missingTopics: string[];
  nextUnresolvedTopic: string | null;
  dealOutcome: string;
  trainingStatus: string;
  topicProgress: { resolved: number; total: number };
  activeProduct: { model: string; code: string } | null;
}

export interface SimulationResult {
  outcome: string;
  trainingStatus: string;
  turnCount: number;
  durationSeconds: number;
  resolvedTopics: string[];
  missingTopics: string[];
  signals: string[];
}

export interface SimulationSession {
  id: string;
  userId: string;
  runtimeSessionId: string;
  personaId: string;
  personaSnapshot: SimulationPersonaSnapshot;
  scenarioSnapshot: SimulationScenarioSnapshot;
  mode: SimulationMode;
  status: SimulationStatus;
  createdAt: string;
  completedAt: string | null;
  messages: SimulationMessage[];
  runtimeInsight: SimulationRuntimeInsight | null;
  runtimeSnapshot: RuntimeRecoverySnapshot | null;
  signals: string[];
  result?: SimulationResult;
}
import type { RuntimeRecoverySnapshot } from "./runtimeRecovery";
