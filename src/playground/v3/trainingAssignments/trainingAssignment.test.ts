import { strict as assert } from "assert";
import { InMemorySessionRepository } from "../inMemorySessionRepository";
import type { SessionHistoryPage, SessionHistoryQuery, SessionRepository } from "../sessionRepository";
import { SimulationService } from "../simulationService";
import type { SimulationSession } from "../simulationSession";
import type { TrainingProgramCatalog } from "../trainingPrograms/trainingProgramDomain";
import type { RuntimeContentSelection } from "../trainingContent/trainingContentDomain";
import type { RuntimeContentResolver } from "../trainingContent/runtimeContentResolver";
import type { AssignmentProgramRecord, TrainingAssigneeRecord } from "./trainingAssignmentDomain";
import { InMemoryTrainingAssignmentRepository } from "./inMemoryTrainingAssignmentRepository";
import { TrainingAssignmentService, TrainingAssignmentServiceError } from "./trainingAssignmentService";

const program = (id: string, status: AssignmentProgramRecord["status"] = "PUBLISHED"): AssignmentProgramRecord => ({
  id,
  name: `Program ${id}`,
  description: "Safe program",
  status,
  items: [
    { id: `${id}-item-1`, personaId: "persona-a", scenarioId: "persona-persona-a", personaVersionId: "persona-a-v1", scenarioVersionId: "persona-persona-a-v1", mode: "SALE_FIRST", sortOrder: 1 },
    { id: `${id}-item-2`, personaId: "persona-b", scenarioId: "persona-persona-b", personaVersionId: "persona-b-v1", scenarioVersionId: "persona-persona-b-v1", mode: "SALE_FIRST", sortOrder: 2 }
  ]
});

const user = (id: string, role: TrainingAssigneeRecord["role"], status: TrainingAssigneeRecord["status"] = "ACTIVE"): TrainingAssigneeRecord => ({
  id,
  email: `${id}@example.test`,
  displayName: id,
  role,
  status
});

const programs = new Map(["published", "draft", "archived"].map((id) => [id, program(id, id === "draft" ? "DRAFT" : id === "archived" ? "ARCHIVED" : "PUBLISHED")]));
const users = new Map([
  user("sale-a", "SALE"),
  user("sale-b", "SALE"),
  user("sale-disabled", "SALE", "DISABLED"),
  user("manager", "MANAGER"),
  user("admin", "ADMIN")
].map((value) => [value.id, value]));
const assignmentRepository = new InMemoryTrainingAssignmentRepository(programs, users);
const sessionRepository = new InMemorySessionRepository();
const linkedSessions: SessionRepository = {
  findById: (id) => sessionRepository.findById(id),
  findHistoryByUserId: (id: string, query: SessionHistoryQuery): Promise<SessionHistoryPage> => sessionRepository.findHistoryByUserId(id, query),
  save: async (session: SimulationSession) => {
    await sessionRepository.save(session);
    if (session.trainingAssignmentId && session.trainingProgramItemId) {
      assignmentRepository.addSession({
        id: session.id,
        userId: session.userId,
        trainingAssignmentId: session.trainingAssignmentId,
        trainingProgramItemId: session.trainingProgramItemId,
        status: session.status
      });
    }
  }
};
let idSequence = 0;
const contentSelection = (personaId: string, version: number): RuntimeContentSelection => ({
  personaId,
  personaVersionId: `${personaId}-v${version}`,
  scenarioId: `persona-${personaId}`,
  scenarioVersionId: `persona-${personaId}-v${version}`,
  personaSnapshot: { id: personaId, displayName: `Persona ${personaId} v${version}`, role: "Buyer", customerType: "Business", difficulty: "MEDIUM", summary: "Safe", interests: ["solution"], scenarioContext: "Safe" },
  scenarioSnapshot: { id: `persona-${personaId}`, title: `Scenario v${version}`, description: "Safe", difficulty: "MEDIUM" },
  personaRuntime: {} as RuntimeContentSelection["personaRuntime"],
  scenarioRuntime: {} as RuntimeContentSelection["scenarioRuntime"]
});
const contentResolver = {
  resolveCurrent: async (personaId: string) => contentSelection(personaId, 2),
  resolvePinned: async (personaVersionId: string) => {
    const personaId = personaVersionId.replace(/-v\d+$/, "");
    const version = Number(personaVersionId.match(/-v(\d+)$/)?.[1] ?? 1);
    return contentSelection(personaId, version);
  },
  listPublicCatalog: async () => [contentSelection("persona-a", 2), contentSelection("persona-b", 2)].map((selection) => ({
    ...selection.personaSnapshot, versionId: selection.personaVersionId, version: 2,
    scenarios: [{ ...selection.scenarioSnapshot, versionId: selection.scenarioVersionId, version: 2, trainingObjective: "Safe", isDefault: true }]
  }))
} as unknown as RuntimeContentResolver;
const simulation = new SimulationService({
  sessions: linkedSessions,
  contentResolver,
  orchestrator: {
    startCustomer: async () => { throw new Error("unused"); },
    handleSaleMessage: async () => { throw new Error("unused"); }
  },
  now: () => new Date("2026-08-21T03:00:00.000Z"),
  createId: () => `session-${++idSequence}`
});
const catalog: TrainingProgramCatalog = {
  resolve: (personaId, scenarioId, personaVersionId, scenarioVersionId) => scenarioId === `persona-${personaId}`
    ? { personaId, personaLabel: personaId, scenarioId, scenarioLabel: scenarioId, personaVersionId: personaVersionId || `${personaId}-v2`, personaVersion: personaVersionId ? 1 : 2, scenarioVersionId: scenarioVersionId || `${scenarioId}-v2`, scenarioVersion: scenarioVersionId ? 1 : 2 }
    : null
};
const service = new TrainingAssignmentService({
  repository: assignmentRepository,
  simulation,
  catalog,
  now: () => new Date("2026-08-21T04:00:00.000Z"),
  createId: () => `assignment-${++idSequence}`
});

async function expectCode(operation: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => error instanceof TrainingAssignmentServiceError && error.code === code);
}

async function main(): Promise<void> {
  assert.deepEqual((await service.listAssignees()).map((value) => value.id), ["sale-a", "sale-b"]);
  await expectCode(service.create("manager", { programId: "draft", assignedToUserId: "sale-a" }), "TRAINING_PROGRAM_NOT_ASSIGNABLE");
  await expectCode(service.create("manager", { programId: "archived", assignedToUserId: "sale-a" }), "TRAINING_PROGRAM_NOT_ASSIGNABLE");
  await expectCode(service.create("manager", { programId: "published", assignedToUserId: "sale-disabled" }), "TRAINING_ASSIGNEE_NOT_ELIGIBLE");
  await expectCode(service.create("manager", { programId: "published", assignedToUserId: "manager" }), "TRAINING_ASSIGNEE_NOT_ELIGIBLE");
  await expectCode(service.create("manager", { programId: "published", assignedToUserId: "admin" }), "TRAINING_ASSIGNEE_NOT_ELIGIBLE");
  await expectCode(service.create("manager", { programId: "published", assignedToUserId: "sale-a", dueAt: "invalid" }), "INVALID_TRAINING_ASSIGNMENT_INPUT");

  const created = await service.create("manager", {
    programId: "published",
    assignedToUserId: "sale-a",
    dueAt: "2026-08-20T00:00:00.000Z"
  });
  assert.equal(created.state, "ASSIGNED");
  assert.equal(created.isOverdue, true);
  assert.equal(created.completedItems, 0);
  assert.equal(created.totalItems, 2);
  await expectCode(service.create("admin", { programId: "published", assignedToUserId: "sale-a" }), "TRAINING_ASSIGNMENT_DUPLICATE");
  await expectCode(service.getOwn(created.id, "sale-b"), "TRAINING_ASSIGNMENT_NOT_FOUND");

  const ordinary = await simulation.createSession("persona-a", "SALE_FIRST", "sale-a");
  assert.equal(ordinary.trainingAssignmentId, null);
  assert.equal(ordinary.trainingProgramItemId, null);
  assert.equal(ordinary.personaVersionId, "persona-a-v2");

  const first = await service.startAssignedItem(created.id, "published-item-1", "sale-a");
  assert.equal(first.userId, "sale-a");
  assert.equal(first.personaId, "persona-a");
  assert.equal(first.mode, "SALE_FIRST");
  assert.equal(first.trainingAssignmentId, created.id);
  assert.equal(first.trainingProgramItemId, "published-item-1");
  assert.equal(first.personaVersionId, "persona-a-v1");
  assert.equal(first.scenarioVersionId, "persona-persona-a-v1");
  assert.equal((await service.getOwn(created.id, "sale-a")).state, "IN_PROGRESS");
  assert.equal((await service.getOwn(created.id, "sale-a")).completedItems, 0);
  assert.equal((await service.startAssignedItem(created.id, "published-item-1", "sale-a")).id, first.id);
  await simulation.stopSession(first.id, "sale-a");
  const partial = await service.getOwn(created.id, "sale-a");
  assert.equal(partial.state, "IN_PROGRESS");
  assert.equal(partial.completedItems, 1);
  assert.equal(partial.progressPercent, 50);

  assignmentRepository.setProgramStatus("published", "ARCHIVED");
  await expectCode(service.create("manager", { programId: "published", assignedToUserId: "sale-b" }), "TRAINING_PROGRAM_NOT_ASSIGNABLE");
  const second = await service.startAssignedItem(created.id, "published-item-2", "sale-a");
  await simulation.stopSession(second.id, "sale-a");
  const completed = await service.getOwn(created.id, "sale-a");
  assert.equal(completed.state, "COMPLETED");
  assert.equal(completed.completedItems, 2);
  assert.equal(completed.progressPercent, 100);
  await expectCode(service.cancel(created.id), "TRAINING_ASSIGNMENT_COMPLETED");
  await expectCode(service.startAssignedItem(created.id, "draft-item-1", "sale-a"), "TRAINING_ASSIGNMENT_ITEM_NOT_FOUND");

  assignmentRepository.setProgramStatus("published", "PUBLISHED");
  const cancellable = await service.create("manager", { programId: "published", assignedToUserId: "sale-b" });
  const running = await service.startAssignedItem(cancellable.id, "published-item-1", "sale-b");
  assert.equal(running.status, "RUNNING");
  const cancelled = await service.cancel(cancellable.id);
  assert.equal(cancelled.state, "CANCELLED");
  assert.equal(cancelled.completedItems, 0);
  await expectCode(service.startAssignedItem(cancellable.id, "published-item-2", "sale-b"), "TRAINING_ASSIGNMENT_CANCELLED");
  const reassigned = await service.create("admin", { programId: "published", assignedToUserId: "sale-b" });
  assert.notEqual(reassigned.id, cancellable.id);

  assignmentRepository.setProgramStatus("archived", "PUBLISHED");
  const assignedOnly = await service.create("manager", { programId: "archived", assignedToUserId: "sale-a" });
  assert.equal(assignedOnly.state, "ASSIGNED");
  assert.equal((await service.cancel(assignedOnly.id)).state, "CANCELLED");
  const afterAssignedCancellation = await service.create("manager", { programId: "archived", assignedToUserId: "sale-a" });
  assert.notEqual(afterAssignedCancellation.id, assignedOnly.id);

  const managerDto = await service.getManaged(created.id);
  assert(!JSON.stringify(managerDto).match(/messages|transcript|evaluation|coach|runtime|password|token|activeSessionId/i));
  console.log("Phase 10C TrainingAssignment domain/service/progress tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
