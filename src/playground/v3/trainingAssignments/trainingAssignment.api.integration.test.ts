import { strict as assert } from "assert";
import * as http from "http";
import type { AuthRepository, AuthUserRecord } from "../authRepository";
import { AuthService, hashAuthToken } from "../authService";
import { CoachingService } from "../coaching/coachingService";
import { InMemoryCoachingRepository } from "../coaching/inMemoryCoachingRepository";
import { EvaluationService } from "../evaluation/evaluationService";
import { InMemoryEvaluationRepository } from "../evaluation/inMemoryEvaluationRepository";
import { InMemorySessionRepository } from "../inMemorySessionRepository";
import { createV3Api } from "../publicApi";
import type { SessionRepository } from "../sessionRepository";
import { SimulationService } from "../simulationService";
import type { SimulationSession } from "../simulationSession";
import type { TrainingProgramCatalog } from "../trainingPrograms/trainingProgramDomain";
import type { AssignmentProgramRecord, TrainingAssigneeRecord } from "./trainingAssignmentDomain";
import { InMemoryTrainingAssignmentRepository } from "./inMemoryTrainingAssignmentRepository";
import { TrainingAssignmentService } from "./trainingAssignmentService";

const authUsers: Record<string, AuthUserRecord> = {
  sale: { id: "sale-a", email: "sale-a@example.test", passwordHash: "unused", displayName: "Sale A", role: "SALE", status: "ACTIVE" },
  other: { id: "sale-b", email: "sale-b@example.test", passwordHash: "unused", displayName: "Sale B", role: "SALE", status: "ACTIVE" },
  manager: { id: "manager", email: "manager@example.test", passwordHash: "unused", displayName: "Manager", role: "MANAGER", status: "ACTIVE" },
  admin: { id: "admin", email: "admin@example.test", passwordHash: "unused", displayName: "Admin", role: "ADMIN", status: "ACTIVE" }
};
const users = new Map(Object.values(authUsers).map((value): [string, TrainingAssigneeRecord] => [value.id, { ...value }]));
const makeProgram = (id: string): AssignmentProgramRecord => ({
  id,
  name: `Program ${id}`,
  description: "Safe",
  status: "PUBLISHED",
  items: [{ id: `${id}-item`, personaId: "persona-safe", scenarioId: "persona-persona-safe", mode: "SALE_FIRST", sortOrder: 1 }]
});
const programs = new Map(["program-a", "program-b"].map((id) => [id, makeProgram(id)]));
const assignments = new InMemoryTrainingAssignmentRepository(programs, users);
const sessions = new InMemorySessionRepository();
const linkedSessions: SessionRepository = {
  findById: (id) => sessions.findById(id),
  findHistoryByUserId: (userId, query) => sessions.findHistoryByUserId(userId, query),
  save: async (session: SimulationSession) => {
    await sessions.save(session);
    if (session.trainingAssignmentId && session.trainingProgramItemId) {
      assignments.addSession({
        id: session.id,
        userId: session.userId,
        trainingAssignmentId: session.trainingAssignmentId,
        trainingProgramItemId: session.trainingProgramItemId,
        status: session.status
      });
    }
  }
};
let sequence = 0;
const simulation = new SimulationService({
  sessions: linkedSessions,
  personas: [{
    persona_id: "persona-safe",
    display_name: "Safe Persona",
    buyer_role: "Buyer",
    organization_type: "Business",
    product_interest_categories: ["solution"],
    purchase_context: "Safe",
    difficulty: "MEDIUM"
  }],
  orchestrator: { startCustomer: async () => { throw new Error("unused"); }, handleSaleMessage: async () => { throw new Error("unused"); } },
  createId: () => `phase10c-session-${++sequence}`
});
const catalog: TrainingProgramCatalog = {
  resolve: (personaId, scenarioId) => personaId === "persona-safe" && scenarioId === "persona-persona-safe"
    ? { personaId, personaLabel: "Safe Persona", scenarioId, scenarioLabel: "Safe Scenario" }
    : null
};
const assignmentService = new TrainingAssignmentService({
  repository: assignments,
  simulation,
  catalog,
  createId: () => `phase10c-assignment-${++sequence}`,
  now: () => new Date("2026-08-21T06:00:00.000Z")
});

async function startServer() {
  const byHash = new Map(Object.entries(authUsers).map(([token, user]) => [hashAuthToken(`${token}-token`), user]));
  const authRepository: AuthRepository = {
    findUserByEmail: async () => null,
    createSession: async () => undefined,
    findUserBySessionTokenHash: async (tokenHash) => byHash.get(tokenHash) ?? null,
    revokeSession: async () => undefined,
    touchUserLogin: async () => undefined
  };
  const evaluations = new InMemoryEvaluationRepository();
  const evaluationService = new EvaluationService({
    sessions: linkedSessions,
    evaluations,
    provider: { evaluate: async () => { throw new Error("must not be called"); } }
  });
  const coachingService = new CoachingService({
    sessions: linkedSessions,
    evaluations,
    coaching: new InMemoryCoachingRepository(),
    provider: { coach: async () => { throw new Error("must not be called"); } }
  });
  const handle = createV3Api({
    service: simulation,
    auth: new AuthService(authRepository),
    evaluationService,
    coachingService,
    trainingAssignmentService: assignmentService
  });
  const server = http.createServer(async (request, response) => {
    if (!await handle(request, response)) { response.writeHead(404); response.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function main(): Promise<void> {
  const running = await startServer();
  const request = async (method: string, path: string, role?: keyof typeof authUsers, body?: unknown) => {
    const response = await fetch(`${running.base}${path}`, {
      method,
      headers: {
        ...(role ? { Cookie: `testlab_session=${role}-token` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  try {
    const managementRoutes: Array<[string, string, unknown?]> = [
      ["GET", "/api/v3/training-assignees"],
      ["GET", "/api/v3/training-assignments"],
      ["POST", "/api/v3/training-assignments", { programId: "program-a", assignedToUserId: "sale-a" }],
      ["GET", "/api/v3/training-assignments/missing"],
      ["POST", "/api/v3/training-assignments/missing/cancel"]
    ];
    for (const [method, path, body] of managementRoutes) {
      assert.equal((await request(method, path, undefined, body)).status, 401, `unauthenticated ${method} ${path}`);
      assert.equal((await request(method, path, "sale", body)).status, 403, `SALE ${method} ${path}`);
    }

    const assignees = await request("GET", "/api/v3/training-assignees", "manager");
    assert.equal(assignees.status, 200);
    assert.deepEqual((assignees.body.assignees as Array<{ id: string }>).map((value) => value.id), ["sale-a", "sale-b"]);
    const created = await request("POST", "/api/v3/training-assignments", "manager", {
      programId: "program-a",
      assignedToUserId: "sale-a",
      assignedByUserId: "client-tamper",
      dueAt: null
    });
    assert.equal(created.status, 201);
    const assignment = created.body.assignment as { id: string; assignedBy: { id: string } };
    assert.equal(assignment.assignedBy.id, "manager");
    assert.equal((await request("GET", "/api/v3/training-assignments", "admin")).status, 200);
    assert.equal((await request("GET", `/api/v3/training-assignments/${assignment.id}`, "manager")).status, 200);

    assert.equal((await request("GET", "/api/v3/my-training-assignments")).status, 401);
    assert.equal((await request("GET", "/api/v3/my-training-assignments", "sale")).status, 200);
    assert.equal((await request("GET", `/api/v3/my-training-assignments/${assignment.id}`, "other")).status, 404);
    assert.equal((await request("POST", `/api/v3/my-training-assignments/${assignment.id}/items/program-a-item/start`, "other")).status, 404);
    assert.equal((await request("POST", `/api/v3/my-training-assignments/${assignment.id}/items/program-b-item/start`, "sale")).status, 404);

    const started = await request("POST", `/api/v3/my-training-assignments/${assignment.id}/items/program-a-item/start`, "sale", {
      personaId: "tampered",
      scenarioId: "tampered",
      mode: "CUSTOMER_FIRST",
      userId: "sale-b"
    });
    assert.equal(started.status, 201);
    const session = (started.body.session as { id: string; persona: { id: string }; mode: string });
    assert.equal(session.persona.id, "persona-safe");
    assert.equal(session.mode, "SALE_FIRST");
    assert(!JSON.stringify(session).match(/trainingAssignmentId|trainingProgramItemId/i));

    assert.equal((await request("GET", `/api/v3/sessions/${session.id}`, "manager")).status, 404);
    assert.equal((await request("GET", `/api/v3/sessions/${session.id}`, "admin")).status, 404);
    assert.equal((await request("GET", `/api/v3/sessions/${session.id}/evaluation`, "manager")).status, 404);
    assert.equal((await request("GET", `/api/v3/sessions/${session.id}/coaching`, "admin")).status, 404);

    const managed = await request("GET", `/api/v3/training-assignments/${assignment.id}`, "manager");
    assert.equal(managed.status, 200);
    assert(!JSON.stringify(managed.body).match(/messages|transcript|evaluation|coach|runtime|password|token|activeSessionId/i));
    const cancelled = await request("POST", `/api/v3/training-assignments/${assignment.id}/cancel`, "admin");
    assert.equal(cancelled.status, 200);
    assert.equal(((cancelled.body.assignment as { state: string }).state), "CANCELLED");

    const adminCreated = await request("POST", "/api/v3/training-assignments", "admin", { programId: "program-b", assignedToUserId: "sale-b" });
    assert.equal(adminCreated.status, 201);
  } finally {
    await new Promise<void>((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
  }
  console.log("Phase 10C TrainingAssignment API/RBAC/ownership/privacy tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
