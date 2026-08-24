import type { TrainingContentRepository } from "./trainingContentRepository";
import type { RuntimeContentSelection, ScenarioRuntimeConfig } from "./trainingContentDomain";

/**
 * Program items created before Phase 11 used synthetic `persona-*` scenario IDs,
 * but Runtime intentionally ignored those IDs and selected its legacy scenario.
 * Preserve that behavior while canonical and managed scenarios remain explicit.
 */
export function scenarioForRuntimeExecution(
  selection: RuntimeContentSelection
): ScenarioRuntimeConfig | undefined {
  return selection.scenarioId.startsWith("persona-")
    ? undefined
    : selection.scenarioRuntime;
}

export class RuntimeContentResolver {
  constructor(private readonly repository: TrainingContentRepository) {}
  resolveCurrent(personaId: string, scenarioId?: string | null) { return this.repository.resolveCurrent(personaId, scenarioId); }
  resolvePinned(personaVersionId: string, scenarioVersionId: string) { return this.repository.resolvePinned(personaVersionId, scenarioVersionId); }
  listPublicCatalog() { return this.repository.listPublicCatalog(); }
}
