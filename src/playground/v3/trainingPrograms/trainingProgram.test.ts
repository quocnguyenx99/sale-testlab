import { strict as assert } from "assert";
import { InMemoryTrainingProgramRepository } from "./inMemoryTrainingProgramRepository";
import type { TrainingProgramCatalog } from "./trainingProgramDomain";
import { TrainingProgramService, TrainingProgramServiceError } from "./trainingProgramService";

const catalog: TrainingProgramCatalog = {
  resolve: (personaId, scenarioId) => {
    const known: Record<string, string> = { "persona-a": "Khách hàng A", "persona-b": "Khách hàng B" };
    return known[personaId] && scenarioId === `persona-${personaId}`
      ? { personaId, personaLabel: known[personaId], scenarioId, scenarioLabel: `Tình huống ${known[personaId]}` }
      : null;
  }
};

let sequence = 0;
const service = new TrainingProgramService({
  repository: new InMemoryTrainingProgramRepository({ manager: "Manager" }),
  catalog,
  createId: () => `id-${++sequence}`
});

async function expectCode(operation: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => error instanceof TrainingProgramServiceError && error.code === code);
}

async function main(): Promise<void> {
  const empty = await service.create("manager", { name: "  Chương trình nháp  ", description: "  Mô tả  ", items: [] });
  assert.equal(empty.name, "Chương trình nháp");
  assert.equal(empty.description, "Mô tả");
  assert.equal(empty.status, "DRAFT");
  await expectCode(service.publish(empty.id), "TRAINING_PROGRAM_EMPTY");

  await expectCode(service.update(empty.id, {
    name: "Invalid",
    description: null,
    items: [{ personaId: "missing", scenarioId: "persona-missing", mode: "SALE_FIRST", sortOrder: 1 }]
  }), "INVALID_TRAINING_CONTENT_REFERENCE");

  await expectCode(service.update(empty.id, {
    name: "Invalid scenario",
    description: null,
    items: [{ personaId: "persona-a", scenarioId: "scenario-mismatch", mode: "SALE_FIRST", sortOrder: 1 }]
  }), "INVALID_TRAINING_CONTENT_REFERENCE");

  await expectCode(service.update(empty.id, {
    name: "Invalid mode",
    description: null,
    items: [{ personaId: "persona-a", scenarioId: "persona-persona-a", mode: "UNSUPPORTED", sortOrder: 1 }]
  }), "INVALID_TRAINING_PROGRAM_INPUT");

  await expectCode(service.update(empty.id, {
    name: "Invalid order",
    description: null,
    items: [
      { personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 },
      { personaId: "persona-b", scenarioId: "persona-persona-b", mode: "CUSTOMER_FIRST", sortOrder: 1 }
    ]
  }), "INVALID_TRAINING_PROGRAM_INPUT");

  const draft = await service.update(empty.id, {
    name: "Kỹ năng tư vấn",
    description: null,
    items: [
      { personaId: "persona-b", scenarioId: "persona-persona-b", mode: "CUSTOMER_FIRST", sortOrder: 20 },
      { personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 10 }
    ]
  });
  assert.deepEqual(draft.items.map((item) => [item.personaId, item.sortOrder]), [["persona-a", 1], ["persona-b", 2]]);

  const published = await service.publish(draft.id);
  assert.equal(published.status, "PUBLISHED");
  await expectCode(service.update(draft.id, { name: "Không được sửa", description: null, items: [] }), "TRAINING_PROGRAM_IMMUTABLE");
  await expectCode(service.publish(draft.id), "INVALID_TRAINING_PROGRAM_TRANSITION");
  await expectCode(service.deleteDraft(draft.id), "TRAINING_PROGRAM_IMMUTABLE");

  const archived = await service.archive(draft.id);
  assert.equal(archived.status, "ARCHIVED");
  await expectCode(service.update(draft.id, { name: "Không được sửa", description: null, items: [] }), "TRAINING_PROGRAM_IMMUTABLE");
  await expectCode(service.archive(draft.id), "INVALID_TRAINING_PROGRAM_TRANSITION");
  await expectCode(service.publish(draft.id), "INVALID_TRAINING_PROGRAM_TRANSITION");

  const disposable = await service.create("manager", { name: "Xóa an toàn", description: null, items: [] });
  await service.deleteDraft(disposable.id);
  await expectCode(service.get(disposable.id), "TRAINING_PROGRAM_NOT_FOUND");

  let referenceAvailable = true;
  const expiringReferenceService = new TrainingProgramService({
    repository: new InMemoryTrainingProgramRepository({ manager: "Manager" }),
    catalog: {
      resolve: (personaId, scenarioId) => referenceAvailable && personaId === "persona-a" && scenarioId === "persona-persona-a"
        ? { personaId, personaLabel: "Persona A", scenarioId, scenarioLabel: "Scenario A" }
        : null
    },
    createId: () => `expiring-${++sequence}`
  });
  const expiredReferenceDraft = await expiringReferenceService.create("manager", {
    name: "Reference expires before publish",
    description: null,
    items: [{ personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 }]
  });
  referenceAvailable = false;
  await expectCode(expiringReferenceService.publish(expiredReferenceDraft.id), "INVALID_TRAINING_CONTENT_REFERENCE");

  let latestVersion = 1;
  let currentContentAvailable = true;
  const versionedProgramService = new TrainingProgramService({
    repository: new InMemoryTrainingProgramRepository({ manager: "Manager" }),
    catalog: {
      resolve: (personaId, scenarioId, personaVersionId, scenarioVersionId) => {
        if (personaId !== "versioned-persona" || scenarioId !== "versioned-scenario") return null;
        const requestedVersion = personaVersionId && scenarioVersionId
          ? Number(personaVersionId.slice(-1))
          : currentContentAvailable ? latestVersion : 0;
        if (!requestedVersion || personaVersionId && scenarioVersionId && personaVersionId !== `persona-v${requestedVersion}`) return null;
        return {
          personaId, personaLabel: `Persona v${requestedVersion}`, scenarioId, scenarioLabel: `Scenario v${requestedVersion}`,
          personaVersionId: `persona-v${requestedVersion}`, personaVersion: requestedVersion,
          scenarioVersionId: `scenario-v${requestedVersion}`, scenarioVersion: requestedVersion
        };
      }
    },
    createId: () => `versioned-${++sequence}`
  });
  const v1Draft = await versionedProgramService.create("manager", {
    name: "Pinned v1", description: null,
    items: [{ personaId: "versioned-persona", scenarioId: "versioned-scenario", mode: "SALE_FIRST", sortOrder: 1 }]
  });
  assert.equal(v1Draft.items[0].personaVersionId, "persona-v1");
  assert.equal(v1Draft.items[0].scenarioVersionId, "scenario-v1");
  const v1Published = await versionedProgramService.publish(v1Draft.id);
  latestVersion = 2;
  assert.equal((await versionedProgramService.get(v1Published.id)).items[0].personaVersionId, "persona-v1", "Published Program must not auto-repin");
  const v2Draft = await versionedProgramService.create("manager", {
    name: "Latest v2", description: null,
    items: [{ personaId: "versioned-persona", scenarioId: "versioned-scenario", mode: "SALE_FIRST", sortOrder: 1 }]
  });
  assert.equal(v2Draft.items[0].personaVersionId, "persona-v2");
  assert.equal(v2Draft.items[0].scenarioVersionId, "scenario-v2");
  currentContentAvailable = false;
  assert.equal((await versionedProgramService.get(v1Published.id)).items[0].personaVersionId, "persona-v1", "Archived content must remain readable through an existing pin");
  await expectCode(versionedProgramService.create("manager", {
    name: "Archived unavailable", description: null,
    items: [{ personaId: "versioned-persona", scenarioId: "versioned-scenario", mode: "SALE_FIRST", sortOrder: 1 }]
  }), "INVALID_TRAINING_CONTENT_REFERENCE");

  assert.deepEqual((await service.list()).map((program) => program.id), [draft.id]);
  assert(!JSON.stringify(archived).match(/prompt|memory|runtimeSnapshot|tokenHash|passwordHash/i));
  console.log("Phase 10B TrainingProgram domain/service tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
