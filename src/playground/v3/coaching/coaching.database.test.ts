import { strict as assert } from "assert";
import { randomUUID } from "crypto";
import { prisma } from "../prismaClient";
import { EVALUATOR_VERSION } from "../evaluation/evaluationDomain";
import { COACH_VERSION, SessionCoachingFeedback } from "./coachingDomain";
import { DatabaseCoachingRepository } from "./databaseCoachingRepository";

async function main() {
  const before = { users: await prisma.user.count(), sessions: await prisma.simulationSession.count(), evaluations: await prisma.sessionEvaluation.count() };
  const userId = randomUUID(); const sessionId = randomUUID(); const evaluationId = randomUUID(); const coachingId = randomUUID();
  try {
    await prisma.user.create({ data: { id: userId, email: `phase8-${userId}@example.test`, passwordHash: "isolated-test-hash", displayName: "Phase 8 isolated fixture" } });
    await prisma.simulationSession.create({ data: { id: sessionId, userId, personaId: "phase8-safe", mode: "SALE_FIRST", status: "COMPLETED", personaSnapshot: { id: "phase8-safe" }, scenarioSnapshot: { id: "phase8-safe" }, runtimeSessionId: randomUUID(), signals: [], result: { outcome: "completed" }, createdAt: new Date(), completedAt: new Date() } });
    await prisma.sessionEvaluation.create({ data: { id: evaluationId, sessionId, evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", overallScore: 60, criteria: [], strengths: [], improvementAreas: [], evaluatedAt: new Date() } });
    const repository = new DatabaseCoachingRepository(prisma); const now = "2026-08-13T10:00:00.000Z";
    const failed = await repository.saveFailure({ id: coachingId, evaluationId, evaluatorVersion: EVALUATOR_VERSION, coachVersion: COACH_VERSION, failureCode: "PROVIDER_TIMEOUT", now });
    assert.equal(failed.status, "FAILED"); assert.equal(failed.id, coachingId);
    const completedInput: SessionCoachingFeedback = { ...failed, status: "COMPLETED", summary: "Safe feedback", priorities: [{ criterionKey: "COMMUNICATION", priorityKind: "IMPROVEMENT", title: "Clarity", whyItMatters: "Relevant", observation: "Safe", recommendedAction: "Practice", suggestedPhrasing: null, evidenceTurnSequences: [] }], strengthReinforcement: null, nextPracticeFocus: ["Clarity"], failureCode: null, coachedAt: now, updatedAt: now };
    const completed = await repository.saveCompleted(completedInput);
    assert.equal(completed.status, "COMPLETED"); assert.equal(completed.id, coachingId, "FAILED retry must reuse the same row");
    assert.equal(await prisma.sessionCoachingFeedback.count({ where: { evaluationId, coachVersion: COACH_VERSION } }), 1);
    const protectedRecord = await repository.saveFailure({ id: randomUUID(), evaluationId, evaluatorVersion: EVALUATOR_VERSION, coachVersion: COACH_VERSION, failureCode: "PROVIDER_TIMEOUT", now });
    assert.equal(protectedRecord.status, "COMPLETED"); assert.equal(protectedRecord.id, coachingId);
  } finally {
    await prisma.sessionCoachingFeedback.deleteMany({ where: { evaluationId } });
    await prisma.sessionEvaluation.deleteMany({ where: { id: evaluationId } });
    await prisma.simulationSession.deleteMany({ where: { id: sessionId, userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    assert.deepEqual({ users: await prisma.user.count(), sessions: await prisma.simulationSession.count(), evaluations: await prisma.sessionEvaluation.count() }, before);
    await prisma.$disconnect();
  }
  console.log("Phase 8 isolated coaching repository test passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
