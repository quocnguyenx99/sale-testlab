import { strict as assert } from "assert";
import * as http from "http";
import { AuthRepository, AuthUserRecord } from "../authRepository";
import { AuthService, hashAuthToken } from "../authService";
import { EVALUATOR_VERSION, SessionEvaluationRecord } from "../evaluation/evaluationDomain";
import { InMemoryEvaluationRepository } from "../evaluation/inMemoryEvaluationRepository";
import { InMemorySessionRepository } from "../inMemorySessionRepository";
import { createV3Api } from "../publicApi";
import { SimulationService } from "../simulationService";
import { CoachingProviderError } from "./coachingProvider";
import { CoachingService } from "./coachingService";
import { InMemoryCoachingRepository } from "./inMemoryCoachingRepository";

const owner: AuthUserRecord = { id: "owner", email: "owner@example.test", passwordHash: "unused", displayName: "Owner", role: "SALE", status: "ACTIVE" };
const other: AuthUserRecord = { ...owner, id: "other", email: "other@example.test", displayName: "Other" };
function collectKeys(value: unknown, keys: string[] = []): string[] { if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys)); else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => { keys.push(key); collectKeys(child, keys); }); return keys; }

async function main() {
  const sessions = new InMemorySessionRepository();
  const baseSession = { id: "complete", userId: owner.id, runtimeSessionId: "runtime", personaId: "safe", personaSnapshot: { id: "safe", displayName: "Safe", role: "Buyer", customerType: "Business", difficulty: "MEDIUM" as const, summary: "Safe", interests: [], scenarioContext: "Safe" }, scenarioSnapshot: { id: "safe", title: "Safe", description: "Safe", difficulty: "MEDIUM" as const }, mode: "SALE_FIRST" as const, status: "COMPLETED" as const, createdAt: "2026-08-13T01:00:00.000Z", completedAt: "2026-08-13T02:00:00.000Z", messages: [{ id: "m1", sender: "SALE" as const, content: "Can I clarify your need?", createdAt: "2026-08-13T01:01:00.000Z" }], runtimeInsight: null, runtimeSnapshot: null, signals: [], result: { outcome: "completed", trainingStatus: "completed", turnCount: 1, durationSeconds: 60, resolvedTopics: ["product_model"], missingTopics: ["delivery"], signals: [] } };
  await sessions.save(baseSession);
  await sessions.save({ ...baseSession, id: "locked" });
  await sessions.save({ ...baseSession, id: "running", status: "RUNNING", completedAt: null, result: undefined });
  const evaluations = new InMemoryEvaluationRepository();
  const evaluation: SessionEvaluationRecord = { id: "eval", sessionId: "complete", evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", overallScore: 65, criteria: [{ key: "NEEDS_DISCOVERY", label: "Needs discovery", score: 60, weight: 20, effectiveWeight: 60, source: "LLM", applicability: "APPLICABLE", summary: "Need discovery can improve.", evidenceTurnSequences: [1] }, { key: "COMMUNICATION", label: "Communication", score: 85, weight: 10, effectiveWeight: 40, source: "LLM", applicability: "APPLICABLE", summary: "Communication is clear.", evidenceTurnSequences: [1] }], strengths: ["Communication is clear."], improvementAreas: ["Need discovery can improve."], failureCode: null, evaluatedAt: "2026-08-13T02:00:00.000Z", createdAt: "2026-08-13T02:00:00.000Z", updatedAt: "2026-08-13T02:00:00.000Z" };
  await evaluations.saveCompleted(evaluation);
  const coachingRepo = new InMemoryCoachingRepository(); let calls = 0; let fail = false;
  const coachingService = new CoachingService({ sessions, evaluations, coaching: coachingRepo, provider: { coach: async (input) => { calls += 1; if (fail) throw new CoachingProviderError("PROVIDER_TIMEOUT"); return { summary: "Focus on discovery.", priorities: input.priorities.map((priority) => ({ criterionKey: priority.criterionKey, priorityKind: priority.priorityKind, title: "Clarify needs", whyItMatters: "It improves relevance.", observation: priority.evaluationSummary, recommendedAction: "Ask one focused question.", suggestedPhrasing: "Could you share the primary use case?", evidenceTurnSequences: priority.evidenceTurnSequences })), strengthReinforcement: input.reinforcement ? { criterionKey: input.reinforcement.criterionKey, message: "Keep communication clear." } : null, nextPracticeFocus: ["Ask a focused discovery question."] }; } } });
  const usersByHash = new Map([[hashAuthToken("owner-token"), owner], [hashAuthToken("other-token"), other]]);
  const authRepo: AuthRepository = { findUserByEmail: async () => null, createSession: async () => undefined, findUserBySessionTokenHash: async (hash) => usersByHash.get(hash) ?? null, revokeSession: async () => undefined, touchUserLogin: async () => undefined };
  const auth = new AuthService(authRepo);
  const simulation = new SimulationService({ sessions, personas: [], orchestrator: { startCustomer: async () => { throw new Error(); }, handleSaleMessage: async () => { throw new Error(); } } });
  const handle = createV3Api({ service: simulation, auth, coachingService });
  const server = http.createServer(async (req, res) => { if (!await handle(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, token?: string, method = "GET") => { const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Cookie: `testlab_session=${token}` } : {}) }, ...(method === "POST" ? { body: "{}" } : {}) }); return { status: response.status, body: await response.json() as Record<string, unknown> }; };
  try {
    assert.equal((await request("/api/v3/sessions/complete/coaching")).status, 401);
    assert.equal((await request("/api/v3/sessions/complete/coaching", "other-token")).status, 404);
    assert.equal((await request("/api/v3/sessions/running/coaching", "owner-token", "POST")).status, 409);
    assert.equal((await request("/api/v3/sessions/locked/coaching", "owner-token")).body.state, "LOCKED_NEEDS_EVALUATION");
    assert.equal((await request("/api/v3/sessions/locked/coaching", "owner-token", "POST")).status, 409);
    const initial = await request("/api/v3/sessions/complete/coaching", "owner-token"); assert.equal(initial.body.state, "NOT_GENERATED"); assert.equal(calls, 0);
    const [first, duplicate] = await Promise.all([request("/api/v3/sessions/complete/coaching", "owner-token", "POST"), request("/api/v3/sessions/complete/coaching", "owner-token", "POST")]);
    assert.equal(first.status, 200); assert.equal(duplicate.status, 200); assert.equal(calls, 1);
    await request("/api/v3/sessions/complete/coaching", "owner-token", "POST"); assert.equal(calls, 1);
    assert.deepEqual(collectKeys(first.body).filter((key) => /overallScore|^score$|weight|effectiveWeight|failureCode|prompt|credential/i.test(key)), []);
    fail = true;
    const freshEvaluation = { ...evaluation, id: "eval-fail", sessionId: "locked" }; await evaluations.saveCompleted(freshEvaluation);
    assert.equal((await request("/api/v3/sessions/locked/coaching", "owner-token", "POST")).status, 503);
    assert.equal((await request("/api/v3/sessions/locked/coaching", "owner-token")).body.state, "FAILED");
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  console.log("Phase 8 coaching API integration tests passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
