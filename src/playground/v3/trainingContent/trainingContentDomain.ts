import type { ProductScenario } from "../../../runtime/productScenarioCatalog";
import type { SimulationPersonaSnapshot, SimulationScenarioSnapshot } from "../simulationSession";

export type ContentDifficulty = "EASY" | "MEDIUM" | "HARD";
export type ContentVersionStatus = "DRAFT" | "PUBLISHED";

export interface PersonaAuthoringFields {
  displayName: string;
  buyerRole: string;
  organizationType: string;
  difficulty: ContentDifficulty;
  summary: string;
  productInterests: string[];
  purchaseContext: string;
  behaviorTraits: string[];
  commonObjections: string[];
  likelyQuestions: string[];
  trainingFocus: string[];
}

export interface ScenarioAuthoringFields {
  title: string;
  description: string;
  difficulty: ContentDifficulty;
  category: string;
  customerNeed: string;
  priorities: string[];
  trainingObjective: string;
  tags: string[];
  openingExamples: string[];
}

export interface PersonaRuntimeConfig {
  persona_id: string;
  name: string;
  display_name: string;
  buyer_role: string;
  organization_type: string;
  product_interest_categories: string[];
  purchase_context: string;
  salutation_style: string;
  name_is_synthetic: boolean;
  difficulty: string;
  role_prompt: string;
  behavior_rules: string[];
  opening_messages: string[];
  likely_questions: string[];
  objection_patterns: string[];
  closing_conditions: string[];
  sale_training_focus: string[];
  runtime_contexts: string[];
  allowed_states: string[];
  do_not_do: string[];
  evidence_summary: { source_count: number; dominant_contexts: string[]; core_behavior_patterns: string[]; confidence: number };
  risk_flags: string[];
}

export interface ScenarioRuntimeConfig extends ProductScenario {}

export interface RuntimeContentSelection {
  personaId: string;
  personaVersionId: string;
  scenarioId: string;
  scenarioVersionId: string;
  personaSnapshot: SimulationPersonaSnapshot;
  scenarioSnapshot: SimulationScenarioSnapshot;
  personaRuntime: PersonaRuntimeConfig;
  scenarioRuntime: ScenarioRuntimeConfig;
}

export interface PublicScenarioOption extends SimulationScenarioSnapshot {
  versionId: string;
  version: number;
  trainingObjective: string;
  isDefault: boolean;
}

export interface PublicPersonaOption extends SimulationPersonaSnapshot {
  versionId: string;
  version: number;
  scenarios: PublicScenarioOption[];
}

export interface ManagedVersionSummary {
  id: string;
  version: number;
  status: ContentVersionStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ManagedPersonaSummary {
  id: string;
  origin: "LEGACY_IMPORT" | "MANAGED";
  archivedAt: string | null;
  latestPublished: ManagedVersionSummary | null;
  draft: ManagedVersionSummary | null;
  displayName: string;
  linkedScenarioCount: number;
  hasUsableScenario: boolean;
  updatedAt: string;
}

export interface ManagedScenarioSummary {
  id: string;
  origin: "LEGACY_IMPORT" | "MANAGED";
  archivedAt: string | null;
  latestPublished: ManagedVersionSummary | null;
  draft: ManagedVersionSummary | null;
  title: string;
  linkedPersonaCount: number;
  updatedAt: string;
}

export interface ManagedPersonaDetail extends ManagedPersonaSummary {
  versions: ManagedVersionSummary[];
  currentVersion: ManagedVersionSummary & PersonaAuthoringFields;
  scenarioLinks: Array<{ scenarioId: string; title: string; isDefault: boolean; sortOrder: number; available: boolean }>;
}

export interface ManagedScenarioDetail extends ManagedScenarioSummary {
  versions: ManagedVersionSummary[];
  currentVersion: ManagedVersionSummary & ScenarioAuthoringFields;
  personaLinks: Array<{ personaId: string; displayName: string; isDefault: boolean }>;
}
