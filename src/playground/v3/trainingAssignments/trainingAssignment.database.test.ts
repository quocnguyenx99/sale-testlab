import { strict as assert } from "assert";
import { randomUUID } from "crypto";
import { DatabaseSessionRepository } from "../databaseSessionRepository";
import { prisma } from "../prismaClient";
import { SimulationService } from "../simulationService";
import type { TrainingProgramCatalog } from "../trainingPrograms/trainingProgramDomain";
import { DatabaseTrainingAssignmentRepository } from "./databaseTrainingAssignmentRepository";
import { TrainingAssignmentService, TrainingAssignmentServiceError } from "./trainingAssignmentService";

async function main(): Promise<void> {
  const userIds = { manager: randomUUID(), sale: randomUUID(), disabled: randomUUID() };
  const programIds = { published: randomUUID(), draft: randomUUID(), archived: randomUUID() };
  const itemIds = { first: randomUUID(), second: randomUUID(), draft: randomUUID(), archived: randomUUID() };
  const assignmentIds: string[] = [];
  const sessionIds: string[] = [];
  const repository = new DatabaseTrainingAssignmentRepository(prisma);
  const sessionRepository = new DatabaseSessionRepository(prisma);
  const catalog: TrainingProgramCatalog = {
    resolve: (personaId, scenarioId) => scenarioId === `persona-${personaId}`
      ? { personaId, personaLabel: personaId, scenarioId, scenarioLabel: scenarioId }
      : null
  };
  const idQueue: string[] = [];
  const simulation = new SimulationService({
    sessions: sessionRepository,
    personas: ["a", "b"].map((id) => ({
      persona_id: `persona-${id}`,
      display_name: `Persona ${id}`,
      buyer_role: "Buyer",
      organization_type: "Business",
      product_interest_categories: ["solution"],
      purchase_context: "Safe",
      difficulty: "MEDIUM"
    })),
    orchestrator: { startCustomer: async () => { throw new Error("unused"); }, handleSaleMessage: async () => { throw new Error("unused"); } },
    createId: () => idQueue.shift() ?? randomUUID(),
    now: () => new Date("2026-08-21T05:00:00.000Z")
  });
  const service = new TrainingAssignmentService({
    repository,
    simulation,
    catalog,
    createId: () => {
      const id = randomUUID();
      assignmentIds.push(id);
      return id;
    },
    now: () => new Date("2026-08-21T05:30:00.000Z")
  });

  try {
    for (const [key, id] of Object.entries(userIds)) {
      await prisma.user.create({ data: {
        id,
        email: `phase10c-${key}-${id}@example.test`,
        passwordHash: "isolated-test-hash",
        displayName: `Phase 10C ${key}`,
        role: key === "manager" ? "MANAGER" : "SALE",
        status: key === "disabled" ? "DISABLED" : "ACTIVE"
      } });
    }
    await prisma.trainingProgram.create({ data: {
      id: programIds.published,
      name: "Published fixture",
      description: null,
      status: "PUBLISHED",
      createdByUserId: userIds.manager,
      items: { create: [
        { id: itemIds.first, personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 },
        { id: itemIds.second, personaId: "persona-b", scenarioId: "persona-persona-b", mode: "SALE_FIRST", sortOrder: 2 }
      ] }
    } });
    await prisma.trainingProgram.create({ data: {
      id: programIds.draft, name: "Draft fixture", description: null, status: "DRAFT", createdByUserId: userIds.manager,
      items: { create: { id: itemIds.draft, personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 } }
    } });
    await prisma.trainingProgram.create({ data: {
      id: programIds.archived, name: "Archived fixture", description: null, status: "ARCHIVED", createdByUserId: userIds.manager,
      items: { create: { id: itemIds.archived, personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 } }
    } });

    await assert.rejects(service.create(userIds.manager, { programId: programIds.draft, assignedToUserId: userIds.sale }), isCode("TRAINING_PROGRAM_NOT_ASSIGNABLE"));
    await assert.rejects(service.create(userIds.manager, { programId: programIds.archived, assignedToUserId: userIds.sale }), isCode("TRAINING_PROGRAM_NOT_ASSIGNABLE"));
    await assert.rejects(service.create(userIds.manager, { programId: programIds.published, assignedToUserId: userIds.disabled }), isCode("TRAINING_ASSIGNEE_NOT_ELIGIBLE"));

    const created = await service.create(userIds.manager, { programId: programIds.published, assignedToUserId: userIds.sale, dueAt: null });
    assert.equal(created.state, "ASSIGNED");
    assert.equal((await repository.listManagedAssignments()).some((value) => value.id === created.id), true);
    assert.equal((await repository.listAssignmentsForUser(userIds.sale)).length, 1);
    await assert.rejects(service.create(userIds.manager, { programId: programIds.published, assignedToUserId: userIds.sale }), isCode("TRAINING_ASSIGNMENT_DUPLICATE"));

    const ordinaryId = randomUUID();
    idQueue.push(ordinaryId);
    const ordinary = await simulation.createSession("persona-a", "SALE_FIRST", userIds.sale);
    sessionIds.push(ordinary.id);
    const ordinaryStored = await prisma.simulationSession.findUniqueOrThrow({ where: { id: ordinary.id } });
    assert.equal(ordinaryStored.trainingAssignmentId, null);
    assert.equal(ordinaryStored.trainingProgramItemId, null);

    const assignedSessionId = randomUUID();
    idQueue.push(assignedSessionId);
    const assignedSession = await service.startAssignedItem(created.id, itemIds.first, userIds.sale);
    sessionIds.push(assignedSession.id);
    const linked = await prisma.simulationSession.findUniqueOrThrow({ where: { id: assignedSession.id } });
    assert.equal(linked.userId, userIds.sale);
    assert.equal(linked.trainingAssignmentId, created.id);
    assert.equal(linked.trainingProgramItemId, itemIds.first);
    assert.equal((await service.getOwn(created.id, userIds.sale)).state, "IN_PROGRESS");
    await simulation.stopSession(assignedSession.id, userIds.sale);
    assert.equal((await service.getOwn(created.id, userIds.sale)).completedItems, 1);

    await prisma.trainingProgram.update({ where: { id: programIds.published }, data: { status: "ARCHIVED" } });
    await assert.rejects(service.create(userIds.manager, { programId: programIds.published, assignedToUserId: userIds.disabled }), isCode("TRAINING_PROGRAM_NOT_ASSIGNABLE"));
    const remainingSessionId = randomUUID();
    idQueue.push(remainingSessionId);
    const remaining = await service.startAssignedItem(created.id, itemIds.second, userIds.sale);
    sessionIds.push(remaining.id);
    assert.equal(remaining.trainingProgramItemId, itemIds.second);
    await simulation.stopSession(remaining.id, userIds.sale);
    assert.equal((await service.getOwn(created.id, userIds.sale)).state, "COMPLETED");
    await prisma.user.update({ where: { id: userIds.sale }, data: { status: "DISABLED" } });
    assert.equal((await service.getManaged(created.id)).assignedTo.id, userIds.sale);

    assert.equal((await repository.listAssignableSaleUsers()).some((value) => value.id === userIds.sale), false);
    assert.equal((await repository.listAssignableSaleUsers()).some((value) => value.id === userIds.disabled), false);
  } finally {
    for (const id of sessionIds) {
      if (await prisma.simulationSession.findUnique({ where: { id }, select: { id: true } })) {
        await prisma.simulationSession.delete({ where: { id } });
      }
    }
    for (const id of assignmentIds) {
      if (await prisma.trainingAssignment.findUnique({ where: { id }, select: { id: true } })) {
        await prisma.trainingAssignment.delete({ where: { id } });
      }
    }
    for (const id of Object.values(programIds)) {
      if (await prisma.trainingProgram.findUnique({ where: { id }, select: { id: true } })) {
        await prisma.trainingProgram.delete({ where: { id } });
      }
    }
    for (const id of Object.values(userIds)) {
      if (await prisma.user.findUnique({ where: { id }, select: { id: true } })) await prisma.user.delete({ where: { id } });
    }
    assert.equal(await prisma.trainingAssignment.count({ where: { id: { in: assignmentIds } } }), 0);
    assert.equal(await prisma.simulationSession.count({ where: { id: { in: sessionIds } } }), 0);
    await prisma.$disconnect();
  }
  console.log("Phase 10C isolated TrainingAssignment repository/database/session-link tests: PASS");
}

function isCode(code: string) {
  return (error: unknown) => error instanceof TrainingAssignmentServiceError && error.code === code;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
