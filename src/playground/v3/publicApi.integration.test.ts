import { strict as assert } from "assert";
import * as http from "http";
import { createV3Api } from "./publicApi";

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
  const handle = createV3Api({
    personas: [persona],
    startCustomer: async () => ({
      ...runtimePayload("customer-session", "Lời mở đầu thật từ runtime"),
      scenario_context: { scenario_id: "laptop-real", scenario_product: "Laptop doanh nghiệp", scenario_need: "Mua cho đội ngũ" }
    }),
    chat: async ({ sessionId }) => { chatCalls += 1; return runtimePayload(sessionId, "FINAL GUARDED CUSTOMER RESPONSE"); }
  });
  const server = http.createServer(async (req, res) => { if (!await handle(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const json = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${base}${path}`, { ...init, headers: { "Content-Type": "application/json" } });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };

  try {
    const list = await json("/api/v3/personas");
    assert.equal(list.status, 200);
    assert.equal((list.body.personas as unknown[]).length, 1);
    assert.equal((await json("/api/v3/personas/unknown")).status, 404);

    const customerFirst = await json("/api/v3/sessions", { method: "POST", body: JSON.stringify({ personaId: persona.persona_id, mode: "CUSTOMER_FIRST" }) });
    assert.equal(customerFirst.status, 201);
    const customerSession = customerFirst.body.session as { id: string; messages: unknown[]; scenario: { id: string } };
    assert.equal(customerSession.messages.length, 1);
    assert.equal(customerSession.scenario.id, "laptop-real");

    const saleFirst = await json("/api/v3/sessions", { method: "POST", body: JSON.stringify({ personaId: persona.persona_id, mode: "SALE_FIRST" }) });
    const saleSession = saleFirst.body.session as { id: string; messages: unknown[] };
    assert.equal(saleSession.messages.length, 0);
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
    assert.equal((await json("/api/v3/sessions/unknown")).status, 404);
    console.log("V3 public API integration tests: PASS");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
