import { strict as assert } from "assert";
import * as http from "http";
import type { AuthRepository, AuthUserRecord } from "../authRepository";
import { AuthService, hashAuthToken } from "../authService";
import { InMemorySessionRepository } from "../inMemorySessionRepository";
import { createV3Api } from "../publicApi";
import { SimulationService } from "../simulationService";
import { InMemoryTrainingProgramRepository } from "./inMemoryTrainingProgramRepository";
import type { TrainingProgramCatalog } from "./trainingProgramDomain";
import { TrainingProgramService } from "./trainingProgramService";

const users: Record<string, AuthUserRecord> = {
  sale: { id: "sale-user", email: "sale@example.test", passwordHash: "unused", displayName: "Sale", role: "SALE", status: "ACTIVE" },
  manager: { id: "manager-user", email: "manager@example.test", passwordHash: "unused", displayName: "Manager", role: "MANAGER", status: "ACTIVE" },
  admin: { id: "admin-user", email: "admin@example.test", passwordHash: "unused", displayName: "Admin", role: "ADMIN", status: "ACTIVE" }
};

const catalog: TrainingProgramCatalog = {
  resolve: (personaId, scenarioId) => personaId === "persona-a" && scenarioId === "persona-persona-a"
    ? { personaId, personaLabel: "Persona A", scenarioId, scenarioLabel: "Scenario A" }
    : null
};

let id = 0;
const programs = new TrainingProgramService({
  repository: new InMemoryTrainingProgramRepository({ "manager-user": "Manager", "admin-user": "Admin" }),
  catalog,
  createId: () => `program-api-${++id}`
});

async function startServer() {
  const byHash = new Map(Object.entries(users).map(([token, user]) => [hashAuthToken(`${token}-token`), user]));
  const authRepository: AuthRepository = {
    findUserByEmail: async () => null,
    createSession: async () => undefined,
    findUserBySessionTokenHash: async (tokenHash) => byHash.get(tokenHash) ?? null,
    revokeSession: async () => undefined,
    touchUserLogin: async () => undefined
  };
  const simulation = new SimulationService({
    sessions: new InMemorySessionRepository(),
    personas: [],
    orchestrator: { startCustomer: async () => { throw new Error("unused"); }, handleSaleMessage: async () => { throw new Error("unused"); } }
  });
  const handle = createV3Api({ service: simulation, auth: new AuthService(authRepository), trainingProgramService: programs });
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
  const request = async (method: string, path: string, role?: keyof typeof users, body?: unknown) => {
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
  const valid = (name: string) => ({
    name,
    description: "Safe",
    items: [{ personaId: "persona-a", scenarioId: "persona-persona-a", mode: "SALE_FIRST", sortOrder: 1 }]
  });
  try {
    const protectedRequests: Array<[string, string, unknown?]> = [
      ["GET", "/api/v3/training-programs"],
      ["POST", "/api/v3/training-programs", valid("Denied")],
      ["GET", "/api/v3/training-programs/missing"],
      ["PATCH", "/api/v3/training-programs/missing", valid("Denied")],
      ["POST", "/api/v3/training-programs/missing/publish"],
      ["POST", "/api/v3/training-programs/missing/archive"],
      ["DELETE", "/api/v3/training-programs/missing"]
    ];
    for (const [method, path, body] of protectedRequests) {
      assert.equal((await request(method, path, undefined, body)).status, 401, `unauthenticated ${method} ${path}`);
      const sale = await request(method, path, "sale", body);
      assert.equal(sale.status, 403, `SALE ${method} ${path}`);
      assert.equal((sale.body.error as { code: string }).code, "FORBIDDEN");
    }

    for (const role of ["manager", "admin"] as const) {
      const created = await request("POST", "/api/v3/training-programs", role, valid(`${role} program`));
      assert.equal(created.status, 201);
      const programId = (created.body.program as { id: string }).id;
      assert.equal((await request("GET", "/api/v3/training-programs", role)).status, 200);
      assert.equal((await request("GET", `/api/v3/training-programs/${programId}`, role)).status, 200);
      assert.equal((await request("PATCH", `/api/v3/training-programs/${programId}`, role, valid(`${role} updated`))).status, 200);
      assert.equal((await request("POST", `/api/v3/training-programs/${programId}/publish`, role)).status, 200);
      assert.equal((await request("PATCH", `/api/v3/training-programs/${programId}`, role, valid("Forbidden update"))).status, 409);
      assert.equal((await request("POST", `/api/v3/training-programs/${programId}/archive`, role)).status, 200);

      const disposable = await request("POST", "/api/v3/training-programs", role, { name: `${role} disposable`, description: null, items: [] });
      const disposableId = (disposable.body.program as { id: string }).id;
      assert.equal((await request("DELETE", `/api/v3/training-programs/${disposableId}`, role)).status, 200);
    }

    const invalid = await request("POST", "/api/v3/training-programs", "manager", {
      name: "Invalid", description: null,
      items: [{ personaId: "missing", scenarioId: "persona-missing", mode: "SALE_FIRST", sortOrder: 1 }]
    });
    assert.equal(invalid.status, 400);
    const list = await request("GET", "/api/v3/training-programs", "manager");
    assert.equal(list.status, 200);
    assert(!JSON.stringify(list.body).match(/prompt|memory|runtimeSnapshot|tokenHash|passwordHash|capabilit/i));
  } finally {
    await new Promise<void>((resolve, reject) => running.server.close((error) => error ? reject(error) : resolve()));
  }
  console.log("Phase 10B TrainingProgram API/RBAC integration tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
