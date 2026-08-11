import { strict as assert } from "assert";
import { InMemorySessionRepository } from "./inMemorySessionRepository";
import { OrchestrationResult, SimulationOrchestrator } from "./simulationOrchestrator";
import { SimulationService, SimulationServiceError } from "./simulationService";

const persona = {
  persona_id: "persona-001",
  display_name: "Khách hàng 001",
  buyer_role: "Trưởng phòng mua hàng",
  organization_type: "Doanh nghiệp",
  product_interest_categories: ["laptop"],
  purchase_context: "Mua thiết bị cho đội ngũ",
  difficulty: "hard"
};

function result(runtimeSessionId: string, reply: string, shouldEndSession = false): OrchestrationResult {
  return {
    runtimeSessionId,
    finalCustomerReply: reply,
    runtimeInsight: {
      runtimeState: "pricing_phase",
      resolvedTopics: ["product_model"],
      missingTopics: ["price", "delivery"],
      nextUnresolvedTopic: "price",
      dealOutcome: "quote_requested",
      trainingStatus: "in_progress",
      topicProgress: { resolved: 1, total: 9 },
      activeProduct: { model: "Epson LQ310", code: "LQ310_EPSON" }
    },
    scenario: { id: "scenario-1", title: "Laptop doanh nghiệp", description: "Mua cho đội ngũ", difficulty: "MEDIUM" },
    signals: ["quote_request_signal"],
    shouldEndSession
  };
}

class StubOrchestrator implements SimulationOrchestrator {
  startCalls = 0;
  chatCalls = 0;
  lastRuntimeSessionId = "";
  fail = false;
  mismatch = false;

  async startCustomer(): Promise<OrchestrationResult> {
    this.startCalls += 1;
    if (this.fail) throw new Error("internal runtime failure");
    return result("runtime-customer-001", "Lời mở đầu từ runtime");
  }

  async handleSaleMessage(input: { runtimeSessionId: string }): Promise<OrchestrationResult> {
    this.chatCalls += 1;
    this.lastRuntimeSessionId = input.runtimeSessionId;
    if (this.fail) throw new Error("internal runtime failure");
    return result(this.mismatch ? "wrong-runtime-session" : input.runtimeSessionId, "Final guarded customer response");
  }
}

async function expectCode(operation: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => error instanceof SimulationServiceError && error.code === code);
}

async function main(): Promise<void> {
  let id = 0;
  let second = 0;
  const orchestrator = new StubOrchestrator();
  const repository = new InMemorySessionRepository();
  const service = new SimulationService({
    sessions: repository,
    orchestrator,
    personas: [persona],
    createId: () => `id-${++id}`,
    now: () => new Date(Date.UTC(2026, 7, 11, 8, 0, second++))
  });

  const customerFirst = await service.createSession(persona.persona_id, "CUSTOMER_FIRST");
  assert.equal(customerFirst.id, "runtime-customer-001");
  assert.equal(customerFirst.runtimeSessionId, "runtime-customer-001");
  assert.equal(customerFirst.personaId, persona.persona_id);
  assert.equal(customerFirst.mode, "CUSTOMER_FIRST");
  assert.equal(customerFirst.messages.length, 1);
  assert.equal(customerFirst.messages[0].sender, "CUSTOMER");
  assert.equal(orchestrator.startCalls, 1);
  await service.getSession(customerFirst.id);
  await service.getSession(customerFirst.id);
  assert.equal(orchestrator.startCalls, 1, "CUSTOMER_FIRST opening must only be created once");

  await expectCode(
    () => service.sendMessage(customerFirst.id, "Xin chào", "different-persona"),
    "SESSION_PERSONA_MISMATCH"
  );
  assert.equal(orchestrator.chatCalls, 0, "Persona mismatch must not reach runtime");

  const sent = await service.sendMessage(customerFirst.id, "Tôi gửi báo giá");
  assert.deepEqual(sent.session.messages.map((message) => message.sender), ["CUSTOMER", "SALE", "CUSTOMER"]);
  assert.equal(sent.session.mode, "CUSTOMER_FIRST");
  assert.equal(sent.session.personaId, persona.persona_id);
  assert.equal(orchestrator.lastRuntimeSessionId, customerFirst.runtimeSessionId);

  const stopped = await service.stopSession(customerFirst.id);
  assert.equal(stopped.status, "COMPLETED");
  assert.equal(stopped.result?.turnCount, 1);
  assert.deepEqual(stopped.result?.signals, ["quote_request_signal"]);
  const stoppedAgain = await service.stopSession(customerFirst.id);
  assert.equal(stoppedAgain.completedAt, stopped.completedAt, "Stop must be idempotent");
  assert.deepEqual(stoppedAgain.result, stopped.result, "Idempotent stop must preserve result");
  await expectCode(() => service.sendMessage(customerFirst.id, "Tin nhắn sau stop"), "SESSION_COMPLETED");

  const saleFirst = await service.createSession(persona.persona_id, "SALE_FIRST");
  assert.equal(saleFirst.messages.length, 0);
  assert.equal(saleFirst.mode, "SALE_FIRST");
  assert.equal(saleFirst.runtimeSessionId, saleFirst.id);
  assert.equal(orchestrator.startCalls, 1, "SALE_FIRST must not create an opening");
  await service.sendMessage(saleFirst.id, "Sale mở đầu");
  assert.equal(orchestrator.lastRuntimeSessionId, saleFirst.id);

  const mismatchSession = await service.createSession(persona.persona_id, "SALE_FIRST");
  orchestrator.mismatch = true;
  await expectCode(() => service.sendMessage(mismatchSession.id, "Test linkage"), "RUNTIME_UNAVAILABLE");
  orchestrator.mismatch = false;
  assert.equal((await service.getSession(mismatchSession.id)).messages.length, 0, "Linkage failure must not mutate transcript");

  const failureSession = await service.createSession(persona.persona_id, "SALE_FIRST");
  orchestrator.fail = true;
  await expectCode(() => service.sendMessage(failureSession.id, "Test failure"), "RUNTIME_UNAVAILABLE");
  orchestrator.fail = false;
  assert.equal((await service.getSession(failureSession.id)).messages.length, 0, "Runtime failure must not mutate transcript");

  await expectCode(() => service.createSession("unknown", "SALE_FIRST"), "PERSONA_NOT_FOUND");
  await expectCode(() => service.createSession(persona.persona_id, "INVALID"), "INVALID_MODE");
  await expectCode(() => service.getSession("unknown"), "SESSION_NOT_FOUND");
  await expectCode(() => service.sendMessage(saleFirst.id, " "), "MESSAGE_REQUIRED");

  console.log("V3 SimulationService session consistency tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
