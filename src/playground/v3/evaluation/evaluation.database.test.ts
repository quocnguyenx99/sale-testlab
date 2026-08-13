import { strict as assert } from "assert";
import { randomUUID } from "crypto";
import { prisma } from "../prismaClient";
import { DatabaseEvaluationRepository } from "./databaseEvaluationRepository";
import { EVALUATOR_VERSION, SessionEvaluationRecord } from "./evaluationDomain";

async function main() {
  const existingUsers = new Set((await prisma.user.findMany({ select: { id: true } })).map((row) => row.id));
  const existingSessions = new Set((await prisma.simulationSession.findMany({ select: { id: true } })).map((row) => row.id));
  const userId = randomUUID();
  const sessionId = randomUUID();
  const evaluationId = randomUUID();
  try {
    await prisma.user.create({ data: { id: userId, email: `phase7-${userId}@example.test`, passwordHash: "isolated-test-hash", displayName: "Phase 7 isolated fixture" } });
    await prisma.simulationSession.create({ data: {
      id: sessionId, userId, personaId: "phase7-safe-persona", mode: "SALE_FIRST", status: "COMPLETED",
      personaSnapshot: { id: "phase7-safe-persona", displayName: "Safe fixture" }, scenarioSnapshot: { id: "safe", title: "Safe fixture" },
      runtimeSessionId: randomUUID(), signals: [], result: { outcome: "completed" }, createdAt: new Date(), completedAt: new Date()
    } });
    const repository = new DatabaseEvaluationRepository(prisma);
    const now = new Date().toISOString();
    const evaluation: SessionEvaluationRecord = {
      id: evaluationId, sessionId, evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", overallScore: 78,
      criteria: [{ key: "TOPIC_COVERAGE", label: "Topic coverage", score: 78, weight: 25, effectiveWeight: 100, source: "DETERMINISTIC", applicability: "APPLICABLE", summary: "Safe isolated result.", evidenceTurnSequences: [] }],
      strengths: ["Safe strength"], improvementAreas: [], failureCode: null, evaluatedAt: now, createdAt: now, updatedAt: now
    };
    assert.equal((await repository.saveCompleted(evaluation)).overallScore, 78);
    assert.equal((await repository.findBySessionAndVersion(sessionId, EVALUATOR_VERSION))?.id, evaluationId);
    assert.equal(await prisma.sessionEvaluation.count({ where: { sessionId, evaluatorVersion: EVALUATOR_VERSION } }), 1);
    await repository.saveFailure({ id: evaluationId, sessionId, evaluatorVersion: EVALUATOR_VERSION, failureCode: "PROVIDER_TIMEOUT", now });
    assert.equal((await repository.findBySessionAndVersion(sessionId, EVALUATOR_VERSION))?.status, "COMPLETED");
    await prisma.sessionEvaluation.delete({ where: { sessionId_evaluatorVersion: { sessionId, evaluatorVersion: EVALUATOR_VERSION } } });
    await repository.saveFailure({ id: evaluationId, sessionId, evaluatorVersion: EVALUATOR_VERSION, failureCode: "PROVIDER_TIMEOUT", now });
    const failed = await repository.findBySessionAndVersion(sessionId, EVALUATOR_VERSION);
    assert.equal(failed?.status, "FAILED");
    assert.equal(failed?.overallScore, null);
  } finally {
    await prisma.sessionEvaluation.deleteMany({ where: { sessionId } });
    await prisma.simulationSession.deleteMany({ where: { id: sessionId, userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    const remainingUsers = new Set((await prisma.user.findMany({ where: { id: { in: [...existingUsers] } }, select: { id: true } })).map((row) => row.id));
    const remainingSessions = new Set((await prisma.simulationSession.findMany({ where: { id: { in: [...existingSessions] } }, select: { id: true } })).map((row) => row.id));
    assert.deepEqual(remainingUsers, existingUsers);
    assert.deepEqual(remainingSessions, existingSessions);
    await prisma.$disconnect();
  }
  console.log("Phase 7 isolated evaluation repository test passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
