import { strict as assert } from "assert";
import * as http from "http";
import { hash } from "bcryptjs";
import { AuthService, AuthServiceError, hashAuthToken } from "./authService";
import { DatabaseAuthRepository } from "./databaseAuthRepository";
import { DatabaseSessionRepository } from "./databaseSessionRepository";
import { SimulationOrchestrator, OrchestrationResult } from "./simulationOrchestrator";
import { SimulationService, SimulationServiceError } from "./simulationService";
import { prisma } from "./prismaClient";
import { createV3Api } from "./publicApi";

const persona = {
  persona_id: "persona-db-001", display_name: "Khách DB", buyer_role: "Mua hàng",
  organization_type: "Doanh nghiệp", product_interest_categories: ["máy in"],
  purchase_context: "Mua thiết bị", difficulty: "medium"
};

function result(runtimeSessionId: string, reply: string): OrchestrationResult {
  return {
    runtimeSessionId,
    finalCustomerReply: reply,
    runtimeInsight: {
      runtimeState: "pricing_phase", resolvedTopics: ["product_model"], missingTopics: ["price"],
      nextUnresolvedTopic: "price", dealOutcome: "quote_requested", trainingStatus: "in_progress",
      topicProgress: { resolved: 1, total: 9 }, activeProduct: { model: "Epson LQ310", code: "LQ310_EPSON" }
    },
    scenario: null, signals: ["quote_request_signal"], shouldEndSession: false, runtimeSnapshot: null
  };
}

class ConcurrencyOrchestrator implements SimulationOrchestrator {
  active = 0;
  maxActive = 0;
  calls = 0;
  async startCustomer(): Promise<OrchestrationResult> { return result("unused", "opening"); }
  async handleSaleMessage(input: { runtimeSessionId: string }): Promise<OrchestrationResult> {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    this.calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    this.active -= 1;
    return result(input.runtimeSessionId, `guarded-${this.calls}`);
  }
}

async function expectCode(operation: () => Promise<unknown>, type: "auth" | "simulation", code: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) =>
    type === "auth"
      ? error instanceof AuthServiceError && error.code === code
      : error instanceof SimulationServiceError && error.code === code
  );
}

async function reset(): Promise<void> {
  await prisma.authSession.deleteMany();
  await prisma.conversationTurn.deleteMany();
  await prisma.simulationSession.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  await reset();
  try {
    const passwordHash = await hash("phase4-valid-password", 6);
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { email: "a@example.test", passwordHash, displayName: "Sale A" } }),
      prisma.user.create({ data: { email: "b@example.test", passwordHash, displayName: "Sale B" } })
    ]);

    const auth = new AuthService(new DatabaseAuthRepository(prisma), { createToken: () => "raw-opaque-token" });
    await expectCode(() => auth.login(userA.email, "wrong"), "auth", "INVALID_CREDENTIALS");
    const login = await auth.login(userA.email, "phase4-valid-password");
    assert.equal((await auth.currentUser(login.token)).id, userA.id);
    const storedAuth = await prisma.authSession.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(login.token) } });
    assert.notEqual(storedAuth.tokenHash, login.token);
    assert.equal(storedAuth.tokenHash.length, 64);
    await auth.logout(login.token);
    await expectCode(() => auth.currentUser(login.token), "auth", "UNAUTHENTICATED");

    const expiredToken = "expired-token";
    await prisma.authSession.create({ data: { userId: userA.id, tokenHash: hashAuthToken(expiredToken), expiresAt: new Date(Date.now() - 1000) } });
    await expectCode(() => auth.currentUser(expiredToken), "auth", "UNAUTHENTICATED");

    const repository = new DatabaseSessionRepository(prisma);
    const orchestrator = new ConcurrencyOrchestrator();
    const service = new SimulationService({ sessions: repository, orchestrator, personas: [persona] });
    const session = await service.createSession(persona.persona_id, "SALE_FIRST", userA.id);
    assert.equal((await repository.findById(session.id))?.userId, userA.id);
    await expectCode(() => service.getSession(session.id, userB.id), "simulation", "SESSION_FORBIDDEN");
    await expectCode(() => service.sendMessage(session.id, "Không được gửi", undefined, userB.id), "simulation", "SESSION_FORBIDDEN");
    await expectCode(() => service.stopSession(session.id, userB.id), "simulation", "SESSION_FORBIDDEN");

    const api = createV3Api({ service, auth: new AuthService(new DatabaseAuthRepository(prisma)) });
    const server = http.createServer(async (req, res) => { if (!await api(req, res)) { res.writeHead(404); res.end(); } });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const loginCookie = async (email: string): Promise<string> => {
      const response = await fetch(`${base}/api/v3/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "phase4-valid-password" })
      });
      assert.equal(response.status, 200);
      return (response.headers.get("set-cookie") || "").split(";")[0];
    };
    const requestAs = (path: string, authCookie: string, method = "GET", body?: string) => fetch(`${base}${path}`, {
      method, headers: { "Content-Type": "application/json", Cookie: authCookie }, body
    });
    try {
      const cookieA = await loginCookie(userA.email);
      const cookieB = await loginCookie(userB.email);
      assert.equal((await requestAs(`/api/v3/sessions/${session.id}`, cookieA)).status, 200);
      assert.equal((await requestAs(`/api/v3/sessions/${session.id}`, cookieB)).status, 404);
      assert.equal((await requestAs(`/api/v3/sessions/${session.id}/messages`, cookieB, "POST", JSON.stringify({ message: "Forbidden" }))).status, 404);
      assert.equal((await requestAs(`/api/v3/sessions/${session.id}/stop`, cookieB, "POST", "{}")).status, 404);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }

    await Promise.all([
      service.sendMessage(session.id, "Tin nhắn A", undefined, userA.id),
      service.sendMessage(session.id, "Tin nhắn B", undefined, userA.id)
    ]);
    assert.equal(orchestrator.maxActive, 1);
    const persisted = await repository.findById(session.id);
    assert(persisted);
    assert.deepEqual(persisted.messages.map((message) => message.sender), ["SALE", "CUSTOMER", "SALE", "CUSTOMER"]);
    assert.deepEqual(persisted.messages.map((message) => message.content).filter((content) => content.startsWith("Tin nhắn")), ["Tin nhắn A", "Tin nhắn B"]);

    const completed = await service.stopSession(session.id, userA.id);
    assert.equal(completed.status, "COMPLETED");
    const reloaded = await repository.findById(session.id);
    assert.equal(reloaded?.result?.turnCount, 2);
    assert.equal(await prisma.conversationTurn.count({ where: { sessionId: session.id } }), 4);

    await service.createSession(persona.persona_id, "SALE_FIRST", userB.id);
    const recent = await service.listRecentSessions(userA.id);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].id, session.id);
    assert.equal(recent[0].status, "COMPLETED");
    assert.equal(recent[0].turnCount, 2);
    assert.equal(recent[0].dealOutcome, "quote_requested");

    const rawRows = JSON.stringify(await prisma.simulationSession.findUnique({ where: { id: session.id }, include: { turns: true } }));
    assert(!/raw_model_reply|memory_slots|identity_profile|source_entity_id|stock_qty|prompt|guard_trigger|constraint/i.test(rawRows));
    console.log("V3 MySQL persistence/auth/ownership/concurrency tests: PASS");
  } finally {
    await reset();
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
