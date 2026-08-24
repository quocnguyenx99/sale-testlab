import { strict as assert } from "assert";
import * as http from "http";
import { AuthRepository, AuthUserRecord } from "../authRepository";
import { AuthService, hashAuthToken } from "../authService";
import { InMemorySessionRepository } from "../inMemorySessionRepository";
import { createV3Api } from "../publicApi";
import { SimulationService } from "../simulationService";
import type { GamificationRepository } from "./gamificationRepository";
import { GamificationService } from "./gamificationService";

const users: AuthUserRecord[] = [
  { id: "sale-a", email: "sale@example.test", passwordHash: "unused", displayName: "Sale A", role: "SALE", status: "ACTIVE" },
  { id: "manager-a", email: "manager@example.test", passwordHash: "unused", displayName: "Manager A", role: "MANAGER", status: "ACTIVE" },
  { id: "admin-a", email: "admin@example.test", passwordHash: "unused", displayName: "Admin A", role: "ADMIN", status: "ACTIVE" }
];

class ReadOnlyGamificationFixture implements GamificationRepository {
  readonly reads: string[] = [];
  readonly writes: string[] = [];

  async findSessionCandidate() { this.reads.push("session-candidate"); return null; }
  async findAssignmentCandidate() { this.reads.push("assignment-candidate"); return null; }
  async findAssignmentIdForSession() { this.reads.push("assignment-for-session"); return null; }
  async createSessionEventAtomically(): Promise<never> { this.writes.push("session-event"); throw new Error("GET must not write"); }
  async createAssignmentEventAtomically(): Promise<never> { this.writes.push("assignment-event"); throw new Error("GET must not write"); }
  async getPersonalAggregate(userId: string) {
    this.reads.push(`personal:${userId}`);
    return {
      totalXp: 320,
      currentMonthXp: 70,
      creditedSessions: 2,
      activityDates: ["2026-08-22", "2026-08-23"],
      recentActivities: [
        { eventType: "SESSION_XP" as const, creditStatus: "AWARDED" as const, points: 35, occurredAt: "2026-08-23T02:00:00.000Z" },
        { eventType: "SESSION_XP" as const, creditStatus: "REPEAT_CONTENT" as const, points: 0, occurredAt: "2026-08-23T03:00:00.000Z" }
      ]
    };
  }
  async getLeaderboard(input: { currentUserId: string }) {
    this.reads.push(`leaderboard:${input.currentUserId}`);
    const rows = [
      { rank: 1, userId: "sale-peer", displayName: "Sale Peer", totalXp: 520, currentMonthXp: 120, creditedSessions: 3 },
      { rank: 2, userId: "sale-a", displayName: "Sale A", totalXp: 320, currentMonthXp: 70, creditedSessions: 2 }
    ];
    return { rows, currentUser: rows.find((row) => row.userId === input.currentUserId) ?? null, totalParticipants: 2 };
  }
  async listHistoricalSessionIds() { this.reads.push("historical-sessions"); return []; }
  async listHistoricalAssignmentIds() { this.reads.push("historical-assignments"); return []; }
  async countEvents() { this.reads.push("event-count"); return 0; }
}

async function startServer(repository: GamificationRepository) {
  const tokenUsers = new Map(users.map((user) => [hashAuthToken(`${user.role.toLowerCase()}-token`), user]));
  const authRepository: AuthRepository = {
    findUserByEmail: async () => null,
    createSession: async () => undefined,
    findUserBySessionTokenHash: async (hash) => tokenUsers.get(hash) ?? null,
    revokeSession: async () => undefined,
    touchUserLogin: async () => undefined
  };
  const sessions = new InMemorySessionRepository();
  const simulation = new SimulationService({
    sessions,
    personas: [],
    orchestrator: {
      startCustomer: async () => { throw new Error("AI must not be called"); },
      handleSaleMessage: async () => { throw new Error("AI must not be called"); }
    }
  });
  const gamificationService = new GamificationService(repository, { now: () => new Date("2026-08-24T08:00:00.000Z") });
  const handle = createV3Api({ service: simulation, auth: new AuthService(authRepository), gamificationService });
  const server = http.createServer(async (req, res) => {
    if (!await handle(req, res)) { res.writeHead(404); res.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function close(server: http.Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => { keys.push(key); collectKeys(child, keys); });
  return keys;
}

async function main() {
  const repository = new ReadOnlyGamificationFixture();
  const running = await startServer(repository);
  const request = async (path: string, role?: "sale" | "manager" | "admin") => {
    const response = await fetch(`${running.base}${path}`, { headers: role ? { Cookie: `testlab_session=${role}-token` } : {} });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };

  try {
    assert.equal((await request("/api/v3/gamification/me")).status, 401);
    assert.equal((await request("/api/v3/leaderboard")).status, 401);

    const personal = await request("/api/v3/gamification/me", "sale");
    assert.equal(personal.status, 200);
    const profile = personal.body.gamification as Record<string, unknown>;
    assert.equal(profile.ruleVersion, "testlab-gamification-v1");
    assert.equal(profile.totalXp, 320);
    assert.equal(profile.level, 2);
    assert.equal((profile.currentMonth as Record<string, unknown>).rank, 2);
    assert.equal((profile.recentActivities as Array<{ creditStatus: string; points: number }>)[1].creditStatus, "REPEAT_CONTENT");
    assert.equal((profile.recentActivities as Array<{ creditStatus: string; points: number }>)[1].points, 0);

    assert.equal((await request("/api/v3/gamification/me", "manager")).status, 403);
    assert.equal((await request("/api/v3/gamification/me", "admin")).status, 403);

    for (const role of ["sale", "manager", "admin"] as const) {
      const response = await request("/api/v3/leaderboard?page=1&pageSize=25", role);
      assert.equal(response.status, 200);
      const leaderboard = response.body.leaderboard as Record<string, unknown>;
      assert.equal(leaderboard.totalParticipants, 2);
      assert.equal((leaderboard.rows as unknown[]).length, 2);
      assert.equal((leaderboard.period as Record<string, unknown>).timezone, "Asia/Ho_Chi_Minh");
      const forbidden = collectKeys(response.body).filter((key) => /^(userId|email|overallScore|score|evaluationId|sessionId|assignmentId|sourceSessionId|sourceEvaluationId|sourceAssignmentId|contentKeyHash)$/i.test(key));
      assert.deepEqual(forbidden, []);
      assert(!JSON.stringify(response.body).includes("sale-peer"), "internal peer identifier must not be public");
    }

    assert.equal((await request("/api/v3/leaderboard?page=0", "sale")).status, 400);
    assert.equal((await request("/api/v3/leaderboard?pageSize=101", "manager")).status, 400);
    assert.deepEqual(repository.writes, [], "read-only endpoints must not create ledger events");
    assert(repository.reads.every((entry) => !entry.includes("transcript") && !entry.includes("runtime") && !entry.includes("coach")));
  } finally {
    await close(running.server);
  }

  console.log("Phase 12 Gamification API authorization/privacy/read-only tests: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
