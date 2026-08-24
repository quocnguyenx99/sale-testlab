import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { buildCustomerOpeningEnriched } from "../../../runtime/customerOpeningBuilder";
import { prisma } from "../prismaClient";
import { DatabaseTrainingContentRepository } from "./databaseTrainingContentRepository";
import type { PersonaRuntimeConfig } from "./trainingContentDomain";
import { scenarioForRuntimeExecution } from "./runtimeContentResolver";

const sourceFile = path.join(process.cwd(), "sale-testlab-data", "10d_training_personas_enriched", process.env.npm_config_month || "2026-03", "training_personas_enriched.jsonl");
const personas = fs.readFileSync(sourceFile, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as PersonaRuntimeConfig);
const privateKeys: Array<keyof PersonaRuntimeConfig> = ["persona_id", "name", "display_name", "buyer_role", "organization_type", "product_interest_categories", "purchase_context", "salutation_style", "name_is_synthetic", "difficulty", "role_prompt", "behavior_rules", "opening_messages", "likely_questions", "objection_patterns", "closing_conditions", "sale_training_focus", "runtime_contexts", "allowed_states", "do_not_do", "risk_flags"];

async function main(): Promise<void> {
  await prisma.$connect();
  try {
    const repository = new DatabaseTrainingContentRepository(prisma);
    const catalog = await repository.listPublicCatalog();
    assert.ok(catalog.length >= personas.length, "Managed catalog must retain every imported Persona");
    for (const legacy of personas) {
      const option = catalog.find((item) => item.id === legacy.persona_id); assert(option);
      const selection = await repository.resolveCurrent(legacy.persona_id); assert(selection);
      for (const key of privateKeys) assert.deepEqual(selection.personaRuntime[key], legacy[key], `Persona parity ${legacy.persona_id}:${String(key)}`);
    }
    for (const legacy of personas.slice(0, 8)) {
      const selection = await repository.resolveCurrent(legacy.persona_id); assert(selection);
      const before = buildCustomerOpeningEnriched(legacy);
      const after = buildCustomerOpeningEnriched(selection.personaRuntime, scenarioForRuntimeExecution(selection));
      assert.equal(after.text, before.text, `CUSTOMER_FIRST opening parity ${legacy.persona_id}`);
      assert.deepEqual(after.scenario_context, before.scenario_context, `Scenario parity ${legacy.persona_id}`);
    }

    const compatibilityItem = await prisma.trainingProgramItem.findFirst({
      where: { scenarioVersion: { scenarioId: { startsWith: "persona-" } } },
      select: { personaVersionId: true, scenarioVersionId: true }
    });
    assert(compatibilityItem?.personaVersionId && compatibilityItem.scenarioVersionId, "Expected migrated legacy ProgramItem");
    const compatibilitySelection = await repository.resolvePinned(
      compatibilityItem.personaVersionId,
      compatibilityItem.scenarioVersionId
    );
    assert(compatibilitySelection);
    assert.equal(scenarioForRuntimeExecution(compatibilitySelection), undefined);
    const legacyPersona = personas.find((item) => item.persona_id === compatibilitySelection.personaId); assert(legacyPersona);
    assert.deepEqual(
      buildCustomerOpeningEnriched(compatibilitySelection.personaRuntime, scenarioForRuntimeExecution(compatibilitySelection)),
      buildCustomerOpeningEnriched(legacyPersona),
      "Pre-Phase 11 Program compatibility must retain legacy Runtime scenario selection"
    );
    process.stdout.write("Phase 11 imported Runtime CUSTOMER_FIRST/SALE_FIRST configuration parity: PASS\n");
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
