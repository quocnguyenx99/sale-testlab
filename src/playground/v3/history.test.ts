import { strict as assert } from "assert";
import { InMemorySessionRepository } from "./inMemorySessionRepository";
import { SimulationOrchestrator } from "./simulationOrchestrator";
import { SimulationService } from "./simulationService";
import { SimulationSession } from "./simulationSession";

const personaSource = {
  persona_id: "persona-history",
  display_name: "Khách hàng History",
  buyer_role: "Trưởng phòng mua hàng",
  organization_type: "Doanh nghiệp",
  product_interest_categories: ["laptop"],
  purchase_context: "Mua thiết bị cho đội ngũ",
  difficulty: "medium"
};

const orchestrator: SimulationOrchestrator = {
  startCustomer: async () => { throw new Error("not expected"); },
  handleSaleMessage: async () => { throw new Error("not expected"); }
};

function session(input: { id: string; userId: string; name: string; mode: "CUSTOMER_FIRST" | "SALE_FIRST"; status: "RUNNING" | "COMPLETED"; createdAt: string; updatedAt: string }): SimulationSession {
  return {
    id: input.id,
    userId: input.userId,
    runtimeSessionId: input.id,
    personaId: `persona-${input.name.toLowerCase().replaceAll(" ", "-")}`,
    personaSnapshot: { id: `persona-${input.id}`, displayName: input.name, role: "Buyer", customerType: "Business", difficulty: "MEDIUM", summary: "Safe summary", interests: [], scenarioContext: "Safe context" },
    scenarioSnapshot: { id: "scenario", title: "Scenario", description: "Description", difficulty: "MEDIUM" },
    mode: input.mode,
    status: input.status,
    createdAt: input.createdAt,
    completedAt: input.status === "COMPLETED" ? input.updatedAt : null,
    messages: [
      { id: `${input.id}-sale`, sender: "SALE", content: "Persisted sale turn", createdAt: input.updatedAt },
      { id: `${input.id}-customer`, sender: "CUSTOMER", content: "Persisted customer turn", createdAt: input.updatedAt }
    ],
    runtimeInsight: null,
    runtimeSnapshot: null,
    signals: [],
    ...(input.status === "COMPLETED" ? { result: { outcome: "quote_requested", trainingStatus: "completed", turnCount: 1, durationSeconds: 60, resolvedTopics: [], missingTopics: [], signals: [] } } : {})
  };
}

async function main() {
  const repository = new InMemorySessionRepository();
  const service = new SimulationService({ sessions: repository, orchestrator, personas: [personaSource] });
  const fixtures = [
    session({ id: "a-old", userId: "user-a", name: "An Nguyễn", mode: "SALE_FIRST", status: "RUNNING", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T01:00:00.000Z" }),
    session({ id: "a-mid", userId: "user-a", name: "Bình Trần", mode: "CUSTOMER_FIRST", status: "COMPLETED", createdAt: "2026-08-02T00:00:00.000Z", updatedAt: "2026-08-02T01:00:00.000Z" }),
    session({ id: "a-new", userId: "user-a", name: "Chi Lê", mode: "SALE_FIRST", status: "COMPLETED", createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-03T01:00:00.000Z" }),
    session({ id: "b-hidden", userId: "user-b", name: "Hidden User", mode: "SALE_FIRST", status: "COMPLETED", createdAt: "2026-08-04T00:00:00.000Z", updatedAt: "2026-08-04T01:00:00.000Z" })
  ];
  for (const item of fixtures) await repository.save(item);

  const first = await service.listHistorySessions("user-a", { page: 1, pageSize: 2 });
  assert.equal(first.total, 3);
  assert.equal(first.totalPages, 2);
  assert.deepEqual(first.items.map((item) => item.id), ["a-new", "a-mid"], "history must be newest activity first");
  assert.ok(first.items.every((item) => item.id !== "b-hidden"), "other user's rows must be excluded");
  assert.equal((first.items[0] as unknown as Record<string, unknown>).messages, undefined, "history summary must not contain transcript");

  const second = await service.listHistorySessions("user-a", { page: 2, pageSize: 2 });
  assert.deepEqual(second.items.map((item) => item.id), ["a-old"]);
  assert.equal((await service.listHistorySessions("user-a", { page: 99, pageSize: 2 })).items.length, 0);
  assert.deepEqual((await service.listHistorySessions("user-a", { page: 1, pageSize: 10, status: "RUNNING" })).items.map((item) => item.id), ["a-old"]);
  assert.deepEqual((await service.listHistorySessions("user-a", { page: 1, pageSize: 10, mode: "CUSTOMER_FIRST" })).items.map((item) => item.id), ["a-mid"]);
  assert.deepEqual((await service.listHistorySessions("user-a", { page: 1, pageSize: 10, search: "bình" })).items.map((item) => item.id), ["a-mid"]);
  assert.equal((await service.listHistorySessions("user-a", { page: 1, pageSize: 100 })).pageSize, 20, "page size must be capped");

  console.log("V3 Phase 6 history pagination/filter/ownership tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
