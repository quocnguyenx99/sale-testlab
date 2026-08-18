import { strict as assert } from "assert";
import { InMemorySessionRepository } from "../inMemorySessionRepository";
import { EVALUATOR_VERSION, EvaluatedCriterion, SessionEvaluationRecord } from "../evaluation/evaluationDomain";
import { InMemoryEvaluationRepository } from "../evaluation/inMemoryEvaluationRepository";
import { SimulationSession } from "../simulationSession";
import { COACH_VERSION, CoachingProviderInput, MAX_COACH_TRANSCRIPT_CHARS, MAX_COACH_TURN_CHARS, coachingProviderOutputSchema } from "./coachingDomain";
import { buildCoachingFeedback, selectCoachingPlan } from "./coachingEngine";
import { buildCoachingProviderInput, coachingInputSize } from "./coachingInputBuilder";
import { buildCoachingSystemPrompt, CoachingProviderError, LocalAICoachingProvider } from "./coachingProvider";
import { CoachingService, CoachingServiceError } from "./coachingService";
import { InMemoryCoachingRepository } from "./inMemoryCoachingRepository";

const keys = ["TOPIC_COVERAGE", "NEEDS_DISCOVERY", "PRODUCT_CONSULTATION", "OBJECTION_HANDLING", "COMMUNICATION", "CLOSING"] as const;
function criterion(key: typeof keys[number], score: number | null, effectiveWeight: number, evidence: number[] = []): EvaluatedCriterion {
  return { key, label: key, score, weight: 10, effectiveWeight, source: key === "TOPIC_COVERAGE" ? "DETERMINISTIC" : "LLM", applicability: score === null ? "NOT_APPLICABLE" : "APPLICABLE", summary: `${key} evaluation summary`, evidenceTurnSequences: evidence };
}
function evaluation(criteria: EvaluatedCriterion[]): SessionEvaluationRecord {
  return { id: "evaluation-001", sessionId: "session-001", evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", overallScore: 68, criteria, strengths: criteria.filter((c) => (c.score ?? 0) >= 70).map((c) => c.summary), improvementAreas: criteria.filter((c) => c.score !== null && c.score < 70).map((c) => c.summary), failureCode: null, evaluatedAt: "2026-08-13T08:00:00.000Z", createdAt: "2026-08-13T08:00:00.000Z", updatedAt: "2026-08-13T08:00:00.000Z" };
}
function session(messages = 12): SimulationSession {
  return { id: "session-001", userId: "owner-001", runtimeSessionId: "runtime-001", personaId: "persona-safe", personaSnapshot: { id: "persona-safe", displayName: "Safe", role: "Buyer", customerType: "Business", difficulty: "MEDIUM", summary: "Safe", interests: [], scenarioContext: "Safe" }, scenarioSnapshot: { id: "scenario", title: "Safe scenario", description: "Safe description", difficulty: "MEDIUM" }, mode: "SALE_FIRST", status: "COMPLETED", createdAt: "2026-08-13T07:00:00.000Z", completedAt: "2026-08-13T08:00:00.000Z", messages: Array.from({ length: messages }, (_, index) => ({ id: `m-${index + 1}`, sender: index % 2 ? "CUSTOMER" as const : "SALE" as const, content: `turn-${index + 1}`, createdAt: "2026-08-13T07:00:00.000Z" })), runtimeInsight: null, runtimeSnapshot: null, signals: [], result: { outcome: "completed", trainingStatus: "completed", turnCount: Math.ceil(messages / 2), durationSeconds: 60, resolvedTopics: ["product_model"], missingTopics: ["delivery"], signals: [] } };
}
function output(input: CoachingProviderInput) {
  return { summary: "Tập trung vào các ưu tiên đã chọn.", priorities: input.priorities.map((priority) => ({ criterionKey: priority.criterionKey, priorityKind: priority.priorityKind, title: priority.priorityKind === "REFINEMENT" ? "Tinh chỉnh thêm" : "Cải thiện kỹ năng", whyItMatters: "Giúp hội thoại rõ ràng hơn.", observation: priority.evaluationSummary, recommendedAction: priority.priorityKind === "REFINEMENT" ? "Có thể nâng chất lượng hơn nữa bằng một câu xác nhận." : "Hãy đặt một câu hỏi làm rõ.", suggestedPhrasing: "Ví dụ gợi ý phù hợp với tình huống.", evidenceTurnSequences: priority.evidenceTurnSequences.slice(0, 2) })), strengthReinforcement: input.reinforcement ? { criterionKey: input.reinforcement.criterionKey, message: "Tiếp tục duy trì cách làm này." } : null, nextPracticeFocus: ["Tập trung vào ưu tiên đầu tiên."] };
}

async function main() {
  const weak = evaluation([criterion("TOPIC_COVERAGE", 45, 30, [2]), criterion("NEEDS_DISCOVERY", 60, 25, [4]), criterion("PRODUCT_CONSULTATION", 60, 35, [6]), criterion("OBJECTION_HANDLING", 50, 10, [8]), criterion("COMMUNICATION", 90, 10, [10]), criterion("CLOSING", null, 0)]);
  const selected = selectCoachingPlan(weak);
  assert.deepEqual(selected.priorities.map((p) => [p.criterionKey, p.kind]), [["TOPIC_COVERAGE", "IMPROVEMENT"], ["OBJECTION_HANDLING", "IMPROVEMENT"], ["PRODUCT_CONSULTATION", "IMPROVEMENT"]]);
  assert.equal(selected.reinforcementCriterionKey, "COMMUNICATION");
  assert.equal(selected.priorities.some((p) => p.criterionKey === "CLOSING"), false);

  const allStrong = evaluation([criterion("TOPIC_COVERAGE", 80, 25, [2]), criterion("NEEDS_DISCOVERY", 75, 20, [4]), criterion("COMMUNICATION", 90, 10, [6])]);
  const refinement = selectCoachingPlan(allStrong);
  assert.deepEqual(refinement.priorities, [{ criterionKey: "NEEDS_DISCOVERY", kind: "REFINEMENT" }]);
  assert.equal(refinement.reinforcementCriterionKey, "COMMUNICATION");
  const tie = selectCoachingPlan(evaluation([criterion("TOPIC_COVERAGE", 85, 20), criterion("NEEDS_DISCOVERY", 85, 30), criterion("COMMUNICATION", 80, 10)]));
  assert.equal(tie.reinforcementCriterionKey, "NEEDS_DISCOVERY");

  const providerInput = buildCoachingProviderInput(session(), weak, selected);
  const serialized = JSON.stringify(providerInput);
  for (const forbidden of ["overallScore", '"score"', '"weight"', "effectiveWeight"]) assert.equal(serialized.includes(forbidden), false);
  const promptPayload = `${buildCoachingSystemPrompt(providerInput)}\n${serialized}`;
  for (const forbidden of ["overallScore", '"score"', '"weight"', "effectiveWeight"]) assert.equal(promptPayload.includes(forbidden), false);
  assert.match(buildCoachingSystemPrompt(providerInput), /exactly 1 or 2 concise strings/);
  assert.deepEqual(providerInput.turns.map((turn) => turn.sequence), [...providerInput.turns.map((turn) => turn.sequence)].sort((a, b) => a - b));
  assert.equal(new Set(providerInput.turns.map((turn) => turn.sequence)).size, providerInput.turns.length);

  const longSession = session(50);
  longSession.messages = longSession.messages.map((message) => ({ ...message, content: "x".repeat(3_000) }));
  const budgetEvaluation = evaluation([
    criterion("TOPIC_COVERAGE", 10, 30, [2, 4, 6, 8, 10, 12, 14, 16]),
    criterion("NEEDS_DISCOVERY", 20, 20, [18, 20, 22, 24, 26, 28, 30, 32]),
    criterion("COMMUNICATION", 30, 10, [34, 36, 38, 40, 42, 44, 46, 48])
  ]);
  const budgetInput = buildCoachingProviderInput(longSession, budgetEvaluation, selectCoachingPlan(budgetEvaluation));
  const budgetSize = coachingInputSize(budgetInput);
  assert(budgetSize.transcriptCharacters <= MAX_COACH_TRANSCRIPT_CHARS);
  assert(budgetInput.turns.every((turn) => turn.content.length <= MAX_COACH_TURN_CHARS));
  assert.deepEqual(budgetInput.turns.map((turn) => turn.sequence), budgetEvaluation.criteria.flatMap((c) => c.evidenceTurnSequences).sort((a, b) => a - b));
  assert.equal(budgetInput.turns.some((turn) => turn.sequence % 2 === 1), false, "optional adjacent turns must be dropped before evidence");

  const valid = buildCoachingFeedback({ id: "coach-001", evaluation: weak, providerInput, output: output(providerInput), coachedAt: "2026-08-13T09:00:00.000Z" });
  assert.equal(valid.status, "COMPLETED");
  const mismatch = output(providerInput); mismatch.strengthReinforcement = { criterionKey: "TOPIC_COVERAGE", message: "wrong" };
  assert.throws(() => buildCoachingFeedback({ id: "x", evaluation: weak, providerInput, output: mismatch, coachedAt: "2026-08-13T09:00:00.000Z" }), /INVALID_REINFORCEMENT/);
  const wrongPriority = output(providerInput); wrongPriority.priorities[0].criterionKey = wrongPriority.priorities[1].criterionKey;
  assert.throws(() => buildCoachingFeedback({ id: "x", evaluation: weak, providerInput, output: wrongPriority, coachedAt: "2026-08-13T09:00:00.000Z" }), /INVALID_PRIORITY_SET/);
  const wrongOrder = output(providerInput); [wrongOrder.priorities[0], wrongOrder.priorities[1]] = [wrongOrder.priorities[1], wrongOrder.priorities[0]];
  assert.throws(() => buildCoachingFeedback({ id: "x", evaluation: weak, providerInput, output: wrongOrder, coachedAt: "2026-08-13T09:00:00.000Z" }), /INVALID_PRIORITY_SET/);
  const wrongKind = output(providerInput); wrongKind.priorities[0].priorityKind = "REFINEMENT";
  assert.throws(() => buildCoachingFeedback({ id: "x", evaluation: weak, providerInput, output: wrongKind, coachedAt: "2026-08-13T09:00:00.000Z" }), /INVALID_PRIORITY_SET/);
  const fabricated = output(providerInput); fabricated.priorities[0].evidenceTurnSequences = [999];
  assert.throws(() => buildCoachingFeedback({ id: "x", evaluation: weak, providerInput, output: fabricated, coachedAt: "2026-08-13T09:00:00.000Z" }), /INVALID_COACH_EVIDENCE/);
  const crossPriority = output(providerInput); crossPriority.priorities[0].evidenceTurnSequences = [...providerInput.priorities[1].evidenceTurnSequences];
  assert.throws(() => buildCoachingFeedback({ id: "x", evaluation: weak, providerInput, output: crossPriority, coachedAt: "2026-08-13T09:00:00.000Z" }), /INVALID_COACH_EVIDENCE/);
  const emptyTopicEvidence = evaluation(weak.criteria.map((item) => item.key === "TOPIC_COVERAGE" ? { ...item, evidenceTurnSequences: [] } : item));
  const emptyTopicInput = buildCoachingProviderInput(session(), emptyTopicEvidence, selectCoachingPlan(emptyTopicEvidence));
  assert.deepEqual(emptyTopicInput.priorities[0].evidenceTurnSequences, []);
  assert.equal(buildCoachingFeedback({ id: "empty-topic", evaluation: emptyTopicEvidence, providerInput: emptyTopicInput, output: output(emptyTopicInput), coachedAt: "2026-08-13T09:00:00.000Z" }).status, "COMPLETED");
  const falseWeakness = output(buildCoachingProviderInput(session(), allStrong, refinement)); falseWeakness.priorities[0].title = "Điểm yếu cần khắc phục";
  assert.throws(() => buildCoachingFeedback({ id: "x", evaluation: allStrong, providerInput: buildCoachingProviderInput(session(), allStrong, refinement), output: falseWeakness, coachedAt: "2026-08-13T09:00:00.000Z" }), /INVALID_REFINEMENT_LANGUAGE/);
  assert.equal(coachingProviderOutputSchema.safeParse({ ...output(providerInput), overallScore: 80 }).success, false);
  const missingSummary = output(providerInput) as Partial<ReturnType<typeof output>>; delete missingSummary.summary;
  assert.equal(coachingProviderOutputSchema.safeParse(missingSummary).success, false);
  const invalidKind = output(providerInput) as unknown as { priorities: Array<{ priorityKind: string }> }; invalidKind.priorities[0].priorityKind = "OTHER";
  assert.equal(coachingProviderOutputSchema.safeParse(invalidKind).success, false);

  const originalFetch = globalThis.fetch;
  try {
    const provider = new LocalAICoachingProvider({ baseUrl: "http://local.test/v1", model: "test", apiKey: "", timeoutMs: 100 });
    const respondWith = (content: unknown) => {
      globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
    };
    const rejectsWith = async (content: unknown, code: string) => {
      respondWith(content);
      await assert.rejects(() => provider.coach(providerInput), (error: unknown) => error instanceof CoachingProviderError && error.code === code);
    };

    respondWith(JSON.stringify(output(providerInput)));
    assert.equal((await provider.coach(providerInput)).priorities.length, providerInput.priorities.length);
    respondWith(`\`\`\`json\n${JSON.stringify(output(providerInput))}\n\`\`\``);
    assert.equal((await provider.coach(providerInput)).nextPracticeFocus.length, 1);
    await rejectsWith(JSON.stringify({ ...output(providerInput), overallScore: 80 }), "PROVIDER_SCHEMA_VALIDATION_FAILED");
    await rejectsWith(JSON.stringify({ ...output(providerInput), nextPracticeFocus: ["one", "two", "three"] }), "PROVIDER_SCHEMA_VALIDATION_FAILED");
    await rejectsWith("", "PROVIDER_EMPTY_CONTENT");
    await rejectsWith(null, "PROVIDER_CONTENT_EXTRACTION_FAILED");
    await rejectsWith("not-json", "PROVIDER_JSON_PARSE_FAILED");
    await rejectsWith('{"summary":"truncated"', "PROVIDER_JSON_PARSE_FAILED");
    await rejectsWith(`${JSON.stringify(output(providerInput))}${JSON.stringify(output(providerInput))}`, "PROVIDER_JSON_PARSE_FAILED");
    await rejectsWith(`leading prose ${JSON.stringify(output(providerInput))}`, "PROVIDER_JSON_PARSE_FAILED");
    await rejectsWith(`${JSON.stringify(output(providerInput))} trailing prose`, "PROVIDER_JSON_PARSE_FAILED");

    globalThis.fetch = ((_: string | URL | Request, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
    })) as typeof fetch;
    const timeoutProvider = new LocalAICoachingProvider({ baseUrl: "http://local.test/v1", model: "test", apiKey: "", timeoutMs: 1 });
    await assert.rejects(() => timeoutProvider.coach(providerInput), (error: unknown) => error instanceof CoachingProviderError && error.code === "PROVIDER_TIMEOUT");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const sessions = new InMemorySessionRepository(); await sessions.save(session());
  const evaluations = new InMemoryEvaluationRepository(); await evaluations.saveCompleted(weak);
  const coaching = new InMemoryCoachingRepository(); let calls = 0; let fail = true;
  const service = new CoachingService({ sessions, evaluations, coaching, createId: () => "coach-stable", now: () => new Date("2026-08-13T09:00:00.000Z"), provider: { coach: async (input) => { calls += 1; if (fail) throw new CoachingProviderError("PROVIDER_SCHEMA_VALIDATION_FAILED"); return output(input); } } });
  await assert.rejects(() => service.generate("session-001", "owner-001"), CoachingServiceError);
  const failed = await coaching.findByEvaluationAndVersion(weak.id, COACH_VERSION); assert.equal(failed?.status, "FAILED"); assert.equal(failed?.id, "coach-stable"); assert.equal(failed?.failureCode, "PROVIDER_SCHEMA_VALIDATION_FAILED");
  fail = false; const retried = await service.generate("session-001", "owner-001"); assert.equal(retried.id, "coach-stable"); assert.equal(retried.status, "COMPLETED"); assert.equal(calls, 2);
  const repeated = await service.generate("session-001", "owner-001"); assert.equal(repeated.id, retried.id); assert.equal(calls, 2);
  const protectedRecord = await coaching.saveFailure({ id: "different", evaluationId: weak.id, evaluatorVersion: EVALUATOR_VERSION, coachVersion: COACH_VERSION, failureCode: "PROVIDER_TIMEOUT", now: "2026-08-13T10:00:00.000Z" }); assert.equal(protectedRecord.status, "COMPLETED");

  const semanticCoaching = new InMemoryCoachingRepository();
  const semanticService = new CoachingService({ sessions, evaluations, coaching: semanticCoaching, provider: { coach: async (input) => { const value = output(input); value.strengthReinforcement = { criterionKey: "TOPIC_COVERAGE", message: "wrong" }; return value; } } });
  await assert.rejects(() => semanticService.generate("session-001", "owner-001"), CoachingServiceError);
  assert.equal((await semanticCoaching.findByEvaluationAndVersion(weak.id, COACH_VERSION))?.failureCode, "PROVIDER_SEMANTIC_VALIDATION_FAILED");

  const evidenceCoaching = new InMemoryCoachingRepository();
  const evidenceService = new CoachingService({ sessions, evaluations, coaching: evidenceCoaching, provider: { coach: async (input) => { const value = output(input); value.priorities[0].evidenceTurnSequences = [999]; return value; } } });
  await assert.rejects(() => evidenceService.generate("session-001", "owner-001"), CoachingServiceError);
  assert.equal((await evidenceCoaching.findByEvaluationAndVersion(weak.id, COACH_VERSION))?.failureCode, "PROVIDER_EVIDENCE_VALIDATION_FAILED");
  await assert.rejects(() => service.generate("session-001", "other"), (error: unknown) => error instanceof CoachingServiceError && error.code === "COACHING_SESSION_NOT_FOUND");
  const missingEvaluations = new InMemoryEvaluationRepository(); const locked = new CoachingService({ sessions, evaluations: missingEvaluations, coaching: new InMemoryCoachingRepository(), provider: { coach: async () => { throw new Error("not called"); } } });
  assert.equal((await locked.get("session-001", "owner-001")).state, "LOCKED_NEEDS_EVALUATION");
  await assert.rejects(() => locked.generate("session-001", "owner-001"), (error: unknown) => error instanceof CoachingServiceError && error.code === "EVALUATION_REQUIRED");
  console.log(`Phase 8 coaching domain/service tests passed; typical_input_chars=${coachingInputSize(providerInput).totalCharacters}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
