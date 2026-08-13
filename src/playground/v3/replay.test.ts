import { strict as assert } from "assert";
import { InMemorySessionRepository } from "./inMemorySessionRepository";
import { OrchestrationResult, SimulationOrchestrator } from "./simulationOrchestrator";
import { SimulationService, SimulationServiceError } from "./simulationService";
import { SimulationSession } from "./simulationSession";

class CountingOrchestrator implements SimulationOrchestrator {
  startCalls = 0;
  chatCalls = 0;
  hydrationCalls = 0;
  async startCustomer(): Promise<OrchestrationResult> { this.startCalls += 1; throw new Error("not expected"); }
  async handleSaleMessage(): Promise<OrchestrationResult> { this.chatCalls += 1; throw new Error("not expected"); }
  async ensureRuntime(): Promise<void> { this.hydrationCalls += 1; }
}

function fixture(status: "RUNNING" | "COMPLETED", messages = true): SimulationSession {
  return {
    id: `replay-${status.toLowerCase()}`,
    userId: "owner",
    runtimeSessionId: `replay-${status.toLowerCase()}`,
    personaId: "persona-replay",
    personaSnapshot: { id: "persona-replay", displayName: "Replay Buyer", role: "Buyer", customerType: "Business", difficulty: "MEDIUM", summary: "Summary", interests: [], scenarioContext: "Context" },
    scenarioSnapshot: { id: "scenario", title: "Scenario", description: "Description", difficulty: "MEDIUM" },
    mode: "SALE_FIRST",
    status,
    createdAt: "2026-08-13T01:00:00.000Z",
    completedAt: status === "COMPLETED" ? "2026-08-13T01:05:00.000Z" : null,
    messages: messages ? [
      { id: "turn-1", sender: "SALE", content: "Persisted first", createdAt: "2026-08-13T01:01:00.000Z" },
      { id: "turn-2", sender: "CUSTOMER", content: "Persisted second", createdAt: "2026-08-13T01:02:00.000Z" }
    ] : [],
    runtimeInsight: null,
    runtimeSnapshot: status === "RUNNING" ? ({ version: 1 } as SimulationSession["runtimeSnapshot"]) : null,
    signals: [],
    ...(status === "COMPLETED" ? { result: { outcome: "quote_requested", trainingStatus: "completed", turnCount: 1, durationSeconds: 300, resolvedTopics: [], missingTopics: [], signals: [] } } : {})
  };
}

async function main() {
  const repository = new InMemorySessionRepository();
  const orchestrator = new CountingOrchestrator();
  const service = new SimulationService({ sessions: repository, orchestrator, personas: [] });
  const completed = fixture("COMPLETED");
  const running = fixture("RUNNING");
  const partial = { ...fixture("COMPLETED", false), id: "replay-partial", runtimeSessionId: "replay-partial", result: undefined };
  await repository.save(completed);
  await repository.save(running);
  await repository.save(partial);

  const replay = await service.getPersistedSession(completed.id, "owner");
  assert.deepEqual(replay.messages.map((message) => message.content), ["Persisted first", "Persisted second"]);
  assert.equal(replay.result?.outcome, "quote_requested", "completed result remains accessible");
  assert.equal(orchestrator.startCalls + orchestrator.chatCalls + orchestrator.hydrationCalls, 0, "replay must not call or mutate Runtime");

  const runningReplay = await service.getPersistedSession(running.id, "owner");
  assert.equal(runningReplay.status, "RUNNING");
  assert.equal(orchestrator.hydrationCalls, 0, "read-only running replay check must not hydrate Runtime");
  await service.getSession(running.id, "owner");
  assert.equal(orchestrator.hydrationCalls, 1, "normal practice load keeps existing hydration behavior");

  await assert.rejects(() => service.getPersistedSession(completed.id, "different-user"), (error: unknown) => error instanceof SimulationServiceError && error.code === "SESSION_FORBIDDEN");
  assert.equal((await service.getPersistedSession(partial.id, "owner")).messages.length, 0, "partial persisted transcript must remain truthful");
  assert.equal(orchestrator.startCalls + orchestrator.chatCalls, 0, "replay added LLM calls must remain zero");

  console.log("V3 Phase 6 persisted read-only replay tests: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
