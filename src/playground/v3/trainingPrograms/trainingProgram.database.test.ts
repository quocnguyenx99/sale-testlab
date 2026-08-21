import { strict as assert } from "assert";
import { randomUUID } from "crypto";
import { prisma } from "../prismaClient";
import { DatabaseTrainingProgramRepository } from "./databaseTrainingProgramRepository";

async function main(): Promise<void> {
  const userId = randomUUID();
  const programId = randomUUID();
  const disposableId = randomUUID();
  const repository = new DatabaseTrainingProgramRepository(prisma);
  try {
    await prisma.user.create({ data: {
      id: userId,
      email: `phase10b-${userId}@example.test`,
      passwordHash: "isolated-test-hash",
      displayName: "Phase 10B Manager",
      role: "MANAGER"
    } });

    const created = await repository.createProgram({
      id: programId,
      createdByUserId: userId,
      name: "DB Program",
      description: null,
      itemIds: [randomUUID(), randomUUID()],
      items: [
        { personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 },
        { personaId: "persona-b", scenarioId: "persona-persona-b", mode: "CUSTOMER_FIRST", sortOrder: 2 }
      ]
    });
    assert.equal(created.status, "DRAFT");
    assert.deepEqual(created.items.map((item) => item.sortOrder), [1, 2]);
    assert.equal(created.createdBy.id, userId);

    const updated = await repository.updateDraftProgram(programId, created.updatedAt, {
      name: "DB Program Updated",
      description: "Safe",
      itemIds: [randomUUID()],
      items: [{ personaId: "persona-b", scenarioId: "persona-persona-b", mode: "SALE_FIRST", sortOrder: 1 }]
    });
    assert(updated);
    assert.equal(updated.name, "DB Program Updated");
    assert.equal(updated.items.length, 1);
    assert.equal(await prisma.trainingProgramItem.count({ where: { programId } }), 1);

    await assert.rejects(repository.updateDraftProgram(programId, updated.updatedAt, {
      name: "Must Roll Back",
      description: "Must not persist",
      itemIds: [randomUUID(), randomUUID()],
      items: [
        { personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 },
        { personaId: "persona-b", scenarioId: "persona-persona-b", mode: "CUSTOMER_FIRST", sortOrder: 1 }
      ]
    }));
    const afterRollback = await repository.findById(programId);
    assert.equal(afterRollback?.name, "DB Program Updated");
    assert.deepEqual(afterRollback?.items.map((item) => item.personaId), ["persona-b"]);

    const published = await repository.transitionProgram(programId, "DRAFT", "PUBLISHED", updated.updatedAt);
    assert.equal(published?.status, "PUBLISHED");
    assert.equal(await repository.updateDraftProgram(programId, published!.updatedAt, {
      name: "Forbidden",
      description: null,
      itemIds: [],
      items: []
    }), null);
    const archived = await repository.transitionProgram(programId, "PUBLISHED", "ARCHIVED", published!.updatedAt);
    assert.equal(archived?.status, "ARCHIVED");
    assert.equal(await repository.deleteDraftProgram(programId), false);

    await repository.createProgram({
      id: disposableId,
      createdByUserId: userId,
      name: "Disposable",
      description: null,
      itemIds: [randomUUID()],
      items: [{ personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 }]
    });
    assert.equal(await repository.deleteDraftProgram(disposableId), true);
    assert.equal(await repository.findById(disposableId), null);
  } finally {
    for (const id of [programId, disposableId]) {
      const program = await prisma.trainingProgram.findUnique({ where: { id }, select: { id: true } });
      if (program) await prisma.trainingProgram.delete({ where: { id } });
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: userId } });
    assert.equal(await prisma.trainingProgram.count({ where: { id: { in: [programId, disposableId] } } }), 0);
    assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
    await prisma.$disconnect();
  }
  console.log("Phase 10B isolated TrainingProgram repository/database tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
