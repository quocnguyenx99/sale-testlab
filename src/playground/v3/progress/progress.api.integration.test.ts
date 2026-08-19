import { strict as assert } from "assert";
import * as http from "http";
import { AuthRepository, AuthUserRecord } from "../authRepository";
import { AuthService, hashAuthToken } from "../authService";
import { EVALUATOR_VERSION } from "../evaluation/evaluationDomain";
import { InMemorySessionRepository } from "../inMemorySessionRepository";
import { createV3Api } from "../publicApi";
import { SimulationService } from "../simulationService";
import { ProgressEvaluationRepositorySample, ProgressRepository } from "./progressRepository";
import { ProgressService } from "./progressService";

const owner: AuthUserRecord = { id: "owner-a", email: "owner-a@example.test", passwordHash: "unused", displayName: "Owner A", role: "SALE", status: "ACTIVE" };
const other: AuthUserRecord = { ...owner, id: "owner-b", email: "owner-b@example.test", displayName: "Owner B" };

function sample(userId: string): ProgressEvaluationRepositorySample {
  return {
    evaluationId: `evaluation-${userId}`,
    sessionId: `session-${userId}`,
    evaluatorVersion: EVALUATOR_VERSION,
    status: "COMPLETED",
    overallScore: userId === owner.id ? 81 : 19,
    evaluatedAt: "2026-08-18T08:00:00.000Z",
    criteria: [{ key: "COMMUNICATION", applicability: "APPLICABLE", score: userId === owner.id ? 81 : 19, evidence: "private" }],
    mode: "SALE_FIRST",
    personaDisplayName: userId === owner.id ? "Persona A" : "Persona B"
  };
}

class OwnerScopedFixtureRepository implements ProgressRepository {
  readonly requestedUsers: string[] = [];
  async getSessionCounts(userId: string) {
    this.requestedUsers.push(userId);
    return userId === other.id ? { totalSessions: 0, completedSessions: 0 } : { totalSessions: 1, completedSessions: 1 };
  }
  async getCompletedSessionsInWindow(userId: string) {
    this.requestedUsers.push(userId);
    return userId === other.id ? [] : [{ sessionId: "session-owner-a", status: "COMPLETED", completedAt: "2026-08-18T08:00:00.000Z" }];
  }
  async getEvaluationSamples(userId: string) {
    this.requestedUsers.push(userId);
    return userId === other.id ? [] : [sample(userId)];
  }
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value !== null && typeof value === "object") Object.entries(value).forEach(([key, child]) => {
    keys.push(key);
    collectKeys(child, keys);
  });
  return keys;
}

async function startServer(progressService?: ProgressService) {
  const usersByHash = new Map([
    [hashAuthToken("owner-a-token"), owner],
    [hashAuthToken("owner-b-token"), other]
  ]);
  const authRepository: AuthRepository = {
    findUserByEmail: async () => null,
    createSession: async () => undefined,
    findUserBySessionTokenHash: async (hash) => usersByHash.get(hash) ?? null,
    revokeSession: async () => undefined,
    touchUserLogin: async () => undefined
  };
  const sessions = new InMemorySessionRepository();
  const simulation = new SimulationService({
    sessions,
    personas: [],
    orchestrator: {
      startCustomer: async () => { throw new Error("not used"); },
      handleSaleMessage: async () => { throw new Error("not used"); }
    }
  });
  const handle = createV3Api({ service: simulation, auth: new AuthService(authRepository), progressService });
  const server = http.createServer(async (req, res) => {
    if (!await handle(req, res)) {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function close(server: http.Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function main() {
  const repository = new OwnerScopedFixtureRepository();
  const progressService = new ProgressService({ repository, now: () => new Date("2026-08-18T12:00:00.000Z") });
  const running = await startServer(progressService);
  const request = async (path: string, token?: string) => {
    const response = await fetch(`${running.base}${path}`, { headers: token ? { Cookie: `testlab_session=${token}` } : {} });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  try {
    assert.equal((await request("/api/v3/progress")).status, 401);

    const populated = await request("/api/v3/progress", "owner-a-token");
    assert.equal(populated.status, 200);
    const progress = populated.body.progress as Record<string, unknown>;
    const recent = progress.recentEvaluatedSessions as Array<{ persona: { displayName: string }; overallScore: number }>;
    assert.equal(recent[0].persona.displayName, "Persona A");
    assert.equal(recent[0].overallScore, 81);
    assert(!JSON.stringify(populated.body).includes("Persona B"));
    assert(!JSON.stringify(populated.body).includes("19"));

    const crossUser = await request(`/api/v3/progress?userId=${encodeURIComponent(other.id)}`, "owner-a-token");
    assert.equal(crossUser.status, 200);
    assert.equal(((crossUser.body.progress as Record<string, unknown>).recentEvaluatedSessions as Array<{ persona: { displayName: string } }>)[0].persona.displayName, "Persona A");
    assert(repository.requestedUsers.every((userId) => userId === owner.id), "query parameter must not override authenticated owner");

    const empty = await request("/api/v3/progress", "owner-b-token");
    assert.equal(empty.status, 200);
    assert.equal(((empty.body.progress as Record<string, unknown>).summary as Record<string, unknown>).evaluatedSessions, 0);
    assert.deepEqual((empty.body.progress as Record<string, unknown>).recentEvaluatedSessions, []);

    const forbiddenKeys = collectKeys(populated.body).filter((key) => /^(criteria|evidence|runtimeSnapshot|personaSnapshot|coach|prompt|modelOutput)$/i.test(key));
    assert.deepEqual(forbiddenKeys, []);
  } finally {
    await close(running.server);
  }

  const unavailable = await startServer();
  try {
    const response = await fetch(`${unavailable.base}/api/v3/progress`, { headers: { Cookie: "testlab_session=owner-a-token" } });
    const body = await response.json() as { error?: { code?: string; message?: string } };
    assert.equal(response.status, 503);
    assert.equal(body.error?.code, "PROGRESS_UNAVAILABLE");
    assert(!JSON.stringify(body).match(/prisma|database_url|sql|stack/i));
  } finally {
    await close(unavailable.server);
  }

  const failingRepository: ProgressRepository = {
    getSessionCounts: async () => { throw new Error("DATABASE_URL secret SQL failure"); },
    getCompletedSessionsInWindow: async () => [],
    getEvaluationSamples: async () => []
  };
  const failed = await startServer(new ProgressService({ repository: failingRepository }));
  try {
    const response = await fetch(`${failed.base}/api/v3/progress`, { headers: { Cookie: "testlab_session=owner-a-token" } });
    const body = await response.json() as { error?: { code?: string } };
    assert.equal(response.status, 503);
    assert.equal(body.error?.code, "PROGRESS_UNAVAILABLE");
    assert(!JSON.stringify(body).match(/database_url|secret|sql/i));
  } finally {
    await close(failed.server);
  }

  console.log("Phase 9B Progress API integration tests: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
