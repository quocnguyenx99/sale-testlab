import { strict as assert } from "assert";
import * as http from "http";
import { createV3Api } from "./publicApi";
import { InMemorySessionRepository } from "./inMemorySessionRepository";
import { CompatibilitySimulationOrchestrator } from "./simulationOrchestrator";
import { SimulationService } from "./simulationService";
import { AuthService } from "./authService";
import { AuthRepository, AuthUserRecord } from "./authRepository";
import { hash } from "bcryptjs";
import { EvaluationService } from "./evaluation/evaluationService";
import { InMemoryEvaluationRepository } from "./evaluation/inMemoryEvaluationRepository";
import { QualitativeEvaluation } from "./evaluation/evaluationDomain";

const persona = {
  persona_id: "persona-real-001",
  display_name: "Khách hàng 001",
  buyer_role: "Trưởng phòng mua hàng",
  organization_type: "Doanh nghiệp",
  product_interest_categories: ["laptop"],
  purchase_context: "Mua thiết bị cho đội ngũ",
  difficulty: "hard"
};

const progress = {
  product_model: { requested: true, answered: true, confirmed: true },
  configuration: { requested: true, answered: true, confirmed: false },
  price: { requested: false, answered: false, confirmed: false }
};

function runtimePayload(sessionId: string, reply: string) {
  return {
    sessionId,
    reply,
    runtime_state: "pricing_phase",
    conversation_progress: progress,
    resolved_topics: ["product_model"],
    missing_topics: ["configuration", "price", "delivery"],
    next_unresolved_topic: "configuration",
    deal_outcome: "quote_requested",
    training_success: "in_progress",
    buying_signals: ["quote_request_signal"],
    selected_product_model: "Epson LQ310",
    selected_product_model_code: "LQ310_EPSON",
    raw_model_reply: "MUST_NOT_LEAK",
    memory_slots: { stock_qty: 99 },
    identity_profile: { secret: true },
    constraint_triggers: ["internal"],
    guard_trigger_reasons: ["internal"]
  };
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => { keys.push(key); collectKeys(child, keys); });
  return keys;
}

async function main(): Promise<void> {
  let chatCalls = 0;
  let runtimeFailure = false;
  const orchestrator = new CompatibilitySimulationOrchestrator({
    startCustomer: async () => ({
      ...runtimePayload("customer-session", "Lời mở đầu thật từ runtime"),
      scenario_context: { scenario_id: "laptop-real", scenario_product: "Laptop doanh nghiệp", scenario_need: "Mua cho đội ngũ" }
    }),
    chat: async ({ sessionId }) => {
      chatCalls += 1;
      if (runtimeFailure) throw new Error("deterministic runtime failure");
      return runtimePayload(sessionId, "FINAL GUARDED CUSTOMER RESPONSE");
    }
  });
  let generatedId = 0;
  let clockTick = 0;
  const sessionsRepository = new InMemorySessionRepository();
  const service = new SimulationService({
    sessions: sessionsRepository,
    orchestrator,
    personas: [persona],
    createId: () => `test-id-${String(++generatedId).padStart(3, "0")}`,
    now: () => new Date(Date.UTC(2026, 7, 13, 3, 0, clockTick++))
  });
  const user: AuthUserRecord = {
    id: "user-001", email: "sale@example.test", passwordHash: await hash("valid-password", 4),
    displayName: "Sale Test", role: "SALE", status: "ACTIVE"
  };
  let activeTokenHash = "";
  const authRepository: AuthRepository = {
    findUserByEmail: async (email) => email === user.email ? user : null,
    createSession: async (input) => { activeTokenHash = input.tokenHash; },
    findUserBySessionTokenHash: async (tokenHash) => tokenHash === activeTokenHash ? user : null,
    revokeSession: async () => { activeTokenHash = ""; },
    touchUserLogin: async () => undefined
  };
  const auth = new AuthService(authRepository, { createToken: () => "raw-test-token" });
  let evaluationCalls = 0;
  const evaluationService = new EvaluationService({
    sessions: sessionsRepository,
    evaluations: new InMemoryEvaluationRepository(),
    provider: { evaluate: async (): Promise<QualitativeEvaluation> => { evaluationCalls += 1; return { criteria: [
      { key: "NEEDS_DISCOVERY", score: 80, summary: "Lam ro nhu cau.", evidenceTurnSequences: [1] },
      { key: "PRODUCT_CONSULTATION", score: 75, summary: "Tu van dung boi canh.", evidenceTurnSequences: [1] },
      { key: "COMMUNICATION", score: 85, summary: "Trao doi ro rang.", evidenceTurnSequences: [1] }
    ] }; } }
  });
  const handle = createV3Api({ service, auth, evaluationService });
  const server = http.createServer(async (req, res) => { if (!await handle(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  let cookieHeader = "";
  const json = async (path: string, init?: RequestInit, cookieOverride?: string | null) => {
    const requestCookie = cookieOverride === undefined ? cookieHeader : cookieOverride || "";
    const response = await fetch(`${base}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(requestCookie ? { Cookie: requestCookie } : {}) } });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookieHeader = setCookie.split(";")[0];
    return { status: response.status, body: await response.json() as Record<string, unknown>, setCookie };
  };

  try {
    const missingSession = await json("/api/v3/personas");
    assert.equal(missingSession.status, 401);
    assert.equal((missingSession.body.error as { code: string }).code, "UNAUTHENTICATED");
    assert.equal((await json("/api/v3/sessions")).status, 401);
    assert.equal((await json("/api/v3/sessions/missing/evaluation")).status, 401);
    assert.equal((await json("/api/v3/sessions/missing/evaluation", { method: "POST", body: "{}" })).status, 401);
    const login = await json("/api/v3/auth/login", { method: "POST", body: JSON.stringify({ email: user.email, password: "valid-password" }) });
    assert.equal(login.status, 200);
    assert.match(login.setCookie || "", /HttpOnly/);
    assert.doesNotMatch(login.setCookie || "", /SALE|MANAGER|ADMIN|MANAGE_TRAINING_PROGRAMS/);
    const saleMe = await json("/api/v3/auth/me");
    assert.equal(saleMe.status, 200);
    const salePublicUser = saleMe.body.user as Record<string, unknown>;
    assert.equal(salePublicUser.id, user.id);
    assert.equal(salePublicUser.email, user.email);
    assert.equal(salePublicUser.displayName, user.displayName);
    assert.equal(salePublicUser.role, "SALE");
    assert.deepEqual(collectKeys(salePublicUser).filter((key) => /password|token|session|capabilit|authorization|credential|secret/i.test(key)), []);

    user.role = "MANAGER";
    assert.equal(((await json("/api/v3/auth/me")).body.user as { role: string }).role, "MANAGER");
    user.role = "ADMIN";
    assert.equal(((await json("/api/v3/auth/me")).body.user as { role: string }).role, "ADMIN");
    user.role = "SALE";
    assert.equal(((await json("/api/v3/auth/me")).body.user as { role: string }).role, "SALE");

    const malformedCookie = await json("/api/v3/auth/me", undefined, "testlab_session=%");
    assert.equal(malformedCookie.status, 401);
    assert.equal((malformedCookie.body.error as { code: string }).code, "UNAUTHENTICATED");
    const unknownCookie = await json("/api/v3/auth/me", undefined, "testlab_session=unknown-token");
    assert.equal(unknownCookie.status, 401);
    assert.equal((unknownCookie.body.error as { code: string }).code, "UNAUTHENTICATED");
    const list = await json("/api/v3/personas");
    assert.equal(list.status, 200);
    assert.equal((list.body.personas as unknown[]).length, 1);
    assert.deepEqual(collectKeys(list.body).filter((key) => /source_entity|stock_qty|prompt|constraint|guard/i.test(key)), []);
    const detail = await json(`/api/v3/personas/${persona.persona_id}`);
    assert.equal(detail.status, 200);
    assert.equal((detail.body.persona as { id: string }).id, persona.persona_id);
    assert.equal((await json("/api/v3/personas/unknown")).status, 404);
    assert.equal((await json("/api/v3/sessions", { method: "POST", body: JSON.stringify({ personaId: "unknown", mode: "SALE_FIRST" }) })).status, 404);
    assert.equal((await json("/api/v3/sessions", { method: "POST", body: JSON.stringify({ personaId: persona.persona_id, mode: "INVALID" }) })).status, 400);

    const customerFirst = await json("/api/v3/sessions", { method: "POST", body: JSON.stringify({ personaId: persona.persona_id, mode: "CUSTOMER_FIRST" }) });
    assert.equal(customerFirst.status, 201);
    const customerSession = customerFirst.body.session as { id: string; messages: unknown[]; scenario: { id: string } };
    assert.equal(customerSession.messages.length, 1);
    assert.equal(customerSession.scenario.id, "laptop-real");

    const saleFirst = await json("/api/v3/sessions", { method: "POST", body: JSON.stringify({ personaId: persona.persona_id, mode: "SALE_FIRST" }) });
    const saleSession = saleFirst.body.session as { id: string; messages: unknown[] };
    assert.equal(saleSession.messages.length, 0);
    assert.equal((await json(`/api/v3/sessions/${saleSession.id}/evaluation`, { method: "POST", body: "{}" })).status, 409);
    const mismatch = await json(`/api/v3/sessions/${saleSession.id}/messages`, { method: "POST", body: JSON.stringify({ message: "Xin chào", personaId: "another" }) });
    assert.equal(mismatch.status, 409);
    assert.equal(chatCalls, 0);
    assert.equal((await json(`/api/v3/sessions/${saleSession.id}/messages`, { method: "POST", body: JSON.stringify({ message: " " }) })).status, 400);

    const chat = await json(`/api/v3/sessions/${saleSession.id}/messages`, { method: "POST", body: JSON.stringify({ message: "Tôi gửi báo giá laptop" }) });
    assert.equal(chat.status, 200);
    assert.equal(chatCalls, 1);
    assert.equal((chat.body.customerMessage as { content: string }).content, "FINAL GUARDED CUSTOMER RESPONSE");
    const forbidden = /raw|memory|identity|source_entity|stock_qty|prompt|constraint|guard/i;
    assert.deepEqual(collectKeys(chat.body).filter((key) => forbidden.test(key)), []);

    const recovered = await json(`/api/v3/sessions/${saleSession.id}`);
    assert.equal(((recovered.body.session as { messages: unknown[] }).messages).length, 2);
    const stopped = await json(`/api/v3/sessions/${saleSession.id}/stop`, { method: "POST", body: "{}" });
    assert.equal((stopped.body.result as { turnCount: number }).turnCount, 1);
    assert.equal((stopped.body.session as { status: string }).status, "COMPLETED");
    const stoppedAgain = await json(`/api/v3/sessions/${saleSession.id}/stop`, { method: "POST", body: "{}" });
    assert.deepEqual(stoppedAgain.body.result, stopped.body.result);
    const notEvaluated = await json(`/api/v3/sessions/${saleSession.id}/evaluation`);
    assert.equal(notEvaluated.status, 200);
    assert.equal(notEvaluated.body.state, "NOT_EVALUATED");
    const evaluated = await json(`/api/v3/sessions/${saleSession.id}/evaluation`, { method: "POST", body: "{}" });
    assert.equal(evaluated.status, 200);
    assert.equal(evaluated.body.state, "COMPLETED");
    assert.equal(evaluationCalls, 1);
    await json(`/api/v3/sessions/${saleSession.id}/evaluation`, { method: "POST", body: "{}" });
    assert.equal(evaluationCalls, 1);
    assert.equal((await json(`/api/v3/sessions/${saleSession.id}/messages`, { method: "POST", body: JSON.stringify({ message: "Sau stop" }) })).status, 409);

    const otherUserSession = await service.createSession(persona.persona_id, "SALE_FIRST", "user-002");
    assert.equal((await json(`/api/v3/sessions/${otherUserSession.id}?view=replay`)).status, 404, "direct replay URL must preserve ownership isolation");
    const recent = await json("/api/v3/sessions?userId=user-002");
    assert.equal(recent.status, 200);
    const recentSessions = recent.body.sessions as Array<Record<string, unknown>>;
    assert.deepEqual(recent.body.items, recent.body.sessions, "legacy sessions alias must remain compatible");
    assert.equal(recent.body.page, 1);
    assert.equal(recent.body.pageSize, 10);
    assert.equal(recent.body.total, 2);
    assert.equal(recent.body.totalPages, 1);
    assert.deepEqual(recentSessions.map((session) => session.id), [saleSession.id, customerSession.id]);
    assert.equal(recentSessions[0].status, "COMPLETED");
    assert.equal(recentSessions[0].turnCount, 1);
    assert.equal(recentSessions[1].status, "RUNNING");
    assert.deepEqual(Object.keys(recentSessions[0]).sort(), [
      "completedAt", "createdAt", "dealOutcome", "id", "mode", "persona", "status", "trainingStatus", "turnCount", "updatedAt"
    ]);
    assert.deepEqual(Object.keys(recentSessions[0].persona as Record<string, unknown>).sort(), ["customerType", "displayName", "id", "role"]);
    assert.deepEqual(collectKeys(recent.body).filter((key) => forbidden.test(key)), []);

    const firstHistoryPage = await json("/api/v3/sessions?page=1&pageSize=1");
    const secondHistoryPage = await json("/api/v3/sessions?page=2&pageSize=1");
    assert.equal((firstHistoryPage.body.items as unknown[]).length, 1);
    assert.equal((secondHistoryPage.body.items as unknown[]).length, 1);
    assert.notEqual((firstHistoryPage.body.items as Array<{ id: string }>)[0].id, (secondHistoryPage.body.items as Array<{ id: string }>)[0].id);
    assert.equal((await json("/api/v3/sessions?page=99&pageSize=1")).body.total, 2);
    assert.equal(((await json("/api/v3/sessions?page=99&pageSize=1")).body.items as unknown[]).length, 0);
    assert.deepEqual(((await json("/api/v3/sessions?status=COMPLETED")).body.items as Array<{ id: string }>).map((item) => item.id), [saleSession.id]);
    assert.deepEqual(((await json("/api/v3/sessions?mode=CUSTOMER_FIRST")).body.items as Array<{ id: string }>).map((item) => item.id), [customerSession.id]);
    assert.equal(((await json("/api/v3/sessions?search=Kh%C3%A1ch%20h%C3%A0ng")).body.items as unknown[]).length, 2);
    assert.equal((await json("/api/v3/sessions?status=INVALID")).status, 400);

    const replay = await json(`/api/v3/sessions/${saleSession.id}?view=replay`);
    assert.equal(replay.status, 200);
    assert.deepEqual(((replay.body.session as { messages: Array<{ content: string }> }).messages).map((message) => message.content), ["Tôi gửi báo giá laptop", "FINAL GUARDED CUSTOMER RESPONSE"]);
    assert.equal((replay.body.session as { completedAt: string | null }).completedAt !== null, true);
    assert.deepEqual(collectKeys(replay.body).filter((key) => forbidden.test(key)), []);

    const failureSession = await json("/api/v3/sessions", { method: "POST", body: JSON.stringify({ personaId: persona.persona_id, mode: "SALE_FIRST" }) });
    runtimeFailure = true;
    assert.equal((await json(`/api/v3/sessions/${(failureSession.body.session as { id: string }).id}/messages`, { method: "POST", body: JSON.stringify({ message: "Runtime fail" }) })).status, 503);
    assert.equal((await json("/api/v3/sessions/unknown")).status, 404);
    assert.equal((await json("/api/v3/auth/logout", { method: "POST", body: "{}" })).status, 200);
    assert.equal((await json("/api/v3/auth/me")).status, 401);
    assert.equal((await json(`/api/v3/sessions/${saleSession.id}?view=replay`)).status, 401);
    console.log("V3 public API integration tests: PASS");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
