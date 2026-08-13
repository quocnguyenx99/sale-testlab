import { strict as assert } from "assert";
import { InMemorySessionRepository } from "../inMemorySessionRepository";
import { SimulationSession } from "../simulationSession";
import { buildEvaluationInput, evaluationInputSize } from "./evaluationInputBuilder";
import { buildEvaluationCriteria, buildSessionEvaluation, calculateOverallScore, criterionApplicability, deterministicTopicCoverage } from "./evaluationEngine";
import { EVALUATOR_VERSION, QualitativeEvaluation, qualitativeEvaluationSchema } from "./evaluationDomain";
import { EvaluationProviderError } from "./evaluationProvider";
import { InMemoryEvaluationRepository } from "./inMemoryEvaluationRepository";
import { EvaluationService, EvaluationServiceError } from "./evaluationService";

function fixture(overrides: Partial<SimulationSession> = {}): SimulationSession {
  return {
    id: "session-safe-001", userId: "owner-001", runtimeSessionId: "runtime-safe-001", personaId: "persona-safe-001",
    personaSnapshot: { id: "persona-safe-001", displayName: "Khach hang mau", role: "Quan ly mua hang", customerType: "Doanh nghiep", difficulty: "MEDIUM", summary: "Du lieu gia lap an toan", interests: ["laptop"], scenarioContext: "Tu van thiet bi" },
    scenarioSnapshot: { id: "scenario-safe", title: "Tu van laptop", description: "Lam ro nhu cau", difficulty: "MEDIUM" },
    mode: "SALE_FIRST", status: "COMPLETED", createdAt: "2026-08-13T01:00:00.000Z", completedAt: "2026-08-13T01:05:00.000Z",
    messages: [
      { id: "m1", sender: "SALE", content: "Anh chi can may cho cong viec nao?", createdAt: "2026-08-13T01:01:00.000Z" },
      { id: "m2", sender: "CUSTOMER", content: "Toi can laptop nhung gia cao qua.", createdAt: "2026-08-13T01:02:00.000Z" },
      { id: "m3", sender: "SALE", content: "Toi de xuat cau hinh phu hop va gui bao gia.", createdAt: "2026-08-13T01:03:00.000Z" }
    ],
    runtimeInsight: null, runtimeSnapshot: null, signals: ["quote_request_signal"],
    result: { outcome: "quote_requested", trainingStatus: "completed", turnCount: 2, durationSeconds: 300, resolvedTopics: ["product_model", "configuration", "price"], missingTopics: ["delivery"], signals: ["quote_request_signal"] },
    ...overrides
  };
}

function qualitative(includeObjection = true): QualitativeEvaluation {
  return { criteria: [
    { key: "NEEDS_DISCOVERY", score: 90, summary: "Nhu cau duoc lam ro bang cau hoi.", evidenceTurnSequences: [1] },
    { key: "PRODUCT_CONSULTATION", score: 80, summary: "San pham duoc lien ket voi nhu cau.", evidenceTurnSequences: [3] },
    ...(includeObjection ? [{ key: "OBJECTION_HANDLING" as const, score: 70, summary: "Ban khoan ve gia duoc ghi nhan.", evidenceTurnSequences: [2, 3] }] : []),
    { key: "COMMUNICATION", score: 85, summary: "Trao doi ro rang va ngan gon.", evidenceTurnSequences: [1, 3] },
    { key: "CLOSING", score: 60, summary: "Da neu buoc gui bao gia tiep theo.", evidenceTurnSequences: [3] }
  ] };
}

async function main() {
  const strongInput = buildEvaluationInput(fixture());
  assert.equal(evaluationInputSize(strongInput).turns, 3);
  assert.equal(deterministicTopicCoverage(strongInput), 75);
  assert.equal(criterionApplicability(strongInput).OBJECTION_HANDLING, true);
  const strongCriteria = buildEvaluationCriteria(strongInput, qualitative());
  const score = calculateOverallScore(strongCriteria);
  assert(score >= 0 && score <= 100);
  assert.equal(score, calculateOverallScore(strongCriteria));
  assert(Math.abs(strongCriteria.reduce((sum, item) => sum + item.effectiveWeight, 0) - 100) < 0.02);

  const noObjection = fixture({ messages: fixture().messages.map((message) => message.sender === "CUSTOMER" ? { ...message, content: "Toi can laptop cho van phong." } : message) });
  const noObjectionCriteria = buildEvaluationCriteria(buildEvaluationInput(noObjection), qualitative(false));
  assert.equal(noObjectionCriteria.find((item) => item.key === "OBJECTION_HANDLING")?.applicability, "NOT_APPLICABLE");
  assert.equal(noObjectionCriteria.find((item) => item.key === "OBJECTION_HANDLING")?.effectiveWeight, 0);

  const missingTopics = fixture({ result: { ...fixture().result!, resolvedTopics: ["product_model"], missingTopics: ["configuration", "price", "delivery"] } });
  assert.equal(deterministicTopicCoverage(buildEvaluationInput(missingTopics)), 25);
  const weak = buildSessionEvaluation({ id: "eval-weak", input: buildEvaluationInput(missingTopics), qualitative: { criteria: qualitative().criteria.map((item) => ({ ...item, score: 30 })) }, evaluatedAt: "2026-08-13T02:00:00.000Z" });
  assert(weak.improvementAreas.length > 0);
  assert.equal(weak.evaluatorVersion, EVALUATOR_VERSION);

  assert.equal(qualitativeEvaluationSchema.safeParse({ criteria: [{ key: "UNKNOWN", score: 50, summary: "x", evidenceTurnSequences: [] }] }).success, false);
  assert.equal(qualitativeEvaluationSchema.safeParse({ criteria: [{ key: "COMMUNICATION", score: 101, summary: "x", evidenceTurnSequences: [] }] }).success, false);

  const sessions = new InMemorySessionRepository();
  await sessions.save(fixture());
  await sessions.save(fixture({ id: "running", status: "RUNNING", completedAt: null, result: undefined }));
  const evaluations = new InMemoryEvaluationRepository();
  let calls = 0;
  const service = new EvaluationService({ sessions, evaluations, provider: { evaluate: async () => { calls += 1; return qualitative(); } }, createId: () => "evaluation-001", now: () => new Date("2026-08-13T02:00:00.000Z") });
  const [first, duplicate] = await Promise.all([service.evaluate("session-safe-001", "owner-001"), service.evaluate("session-safe-001", "owner-001")]);
  assert.equal(first.id, duplicate.id);
  assert.equal(calls, 1);
  await service.evaluate("session-safe-001", "owner-001");
  assert.equal(calls, 1);
  await assert.rejects(() => service.evaluate("session-safe-001", "other-user"), (error: unknown) => error instanceof EvaluationServiceError && error.code === "EVALUATION_SESSION_NOT_FOUND");
  await assert.rejects(() => service.evaluate("running", "owner-001"), (error: unknown) => error instanceof EvaluationServiceError && error.code === "SESSION_NOT_COMPLETED");

  const failureRepo = new InMemoryEvaluationRepository();
  const timeoutService = new EvaluationService({ sessions, evaluations: failureRepo, provider: { evaluate: async () => { throw new EvaluationProviderError("PROVIDER_TIMEOUT"); } } });
  await assert.rejects(() => timeoutService.evaluate("session-safe-001", "owner-001"), EvaluationServiceError);
  const failed = await failureRepo.findBySessionAndVersion("session-safe-001", EVALUATOR_VERSION);
  assert.equal(failed?.status, "FAILED");
  assert.equal(failed?.overallScore, null);
  assert.deepEqual(failed?.criteria, []);

  const malformedRepo = new InMemoryEvaluationRepository();
  const malformed = new EvaluationService({ sessions, evaluations: malformedRepo, provider: { evaluate: async () => ({ criteria: [{ key: "COMMUNICATION", score: 70, summary: "Thieu tieu chi", evidenceTurnSequences: [1] }] }) } });
  await assert.rejects(() => malformed.evaluate("session-safe-001", "owner-001"), EvaluationServiceError);
  assert.equal((await malformedRepo.findBySessionAndVersion("session-safe-001", EVALUATOR_VERSION))?.status, "FAILED");
  console.log("Phase 7 evaluator domain/service tests passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
