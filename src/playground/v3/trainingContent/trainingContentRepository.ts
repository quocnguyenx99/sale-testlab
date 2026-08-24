import type {
  ManagedPersonaDetail,
  ManagedPersonaSummary,
  ManagedScenarioDetail,
  ManagedScenarioSummary,
  PersonaAuthoringFields,
  PublicPersonaOption,
  RuntimeContentSelection,
  ScenarioAuthoringFields
} from "./trainingContentDomain";

export interface CreateVersionInput<T> {
  id: string;
  entityId: string;
  version: number;
  fields: T;
  runtimeConfig: unknown;
  contentHash: string;
  createdByUserId: string;
}

export interface TrainingContentRepository {
  listPublicCatalog(): Promise<PublicPersonaOption[]>;
  resolveCurrent(personaId: string, scenarioId?: string | null): Promise<RuntimeContentSelection | null>;
  resolvePinned(personaVersionId: string, scenarioVersionId: string): Promise<RuntimeContentSelection | null>;
  listManagedPersonas(): Promise<ManagedPersonaSummary[]>;
  listManagedScenarios(): Promise<ManagedScenarioSummary[]>;
  getManagedPersona(id: string, versionId?: string): Promise<ManagedPersonaDetail | null>;
  getManagedScenario(id: string, versionId?: string): Promise<ManagedScenarioDetail | null>;
  createPersona(input: CreateVersionInput<PersonaAuthoringFields>): Promise<void>;
  createScenario(input: CreateVersionInput<ScenarioAuthoringFields>): Promise<void>;
  updatePersonaDraft(versionId: string, expectedUpdatedAt: string, fields: PersonaAuthoringFields, runtimeConfig: unknown, hash: string): Promise<boolean>;
  updateScenarioDraft(versionId: string, expectedUpdatedAt: string, fields: ScenarioAuthoringFields, runtimeConfig: unknown, hash: string): Promise<boolean>;
  clonePersonaDraft(personaId: string, input: CreateVersionInput<PersonaAuthoringFields>): Promise<"CREATED" | "DRAFT_EXISTS" | "NOT_FOUND">;
  cloneScenarioDraft(scenarioId: string, input: CreateVersionInput<ScenarioAuthoringFields>): Promise<"CREATED" | "DRAFT_EXISTS" | "NOT_FOUND">;
  publishPersonaVersion(personaId: string, versionId: string, expectedUpdatedAt: string): Promise<boolean>;
  publishScenarioVersion(scenarioId: string, versionId: string, expectedUpdatedAt: string): Promise<boolean>;
  deletePersonaDraft(personaId: string, versionId: string): Promise<boolean>;
  deleteScenarioDraft(scenarioId: string, versionId: string): Promise<boolean>;
  archivePersona(personaId: string): Promise<"ARCHIVED" | "DRAFT_EXISTS" | "NOT_FOUND">;
  archiveScenario(scenarioId: string): Promise<"ARCHIVED" | "DRAFT_EXISTS" | "NOT_FOUND">;
  replacePersonaScenarioLinks(personaId: string, links: Array<{ scenarioId: string; isDefault: boolean; sortOrder: number }>): Promise<boolean>;
}
