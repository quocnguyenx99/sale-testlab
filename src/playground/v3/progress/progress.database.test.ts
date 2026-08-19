import { strict as assert } from "assert";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { EVALUATOR_VERSION } from "../evaluation/evaluationDomain";
import { prisma } from "../prismaClient";
import { DatabaseProgressRepository } from "./databaseProgressRepository";
import { ProgressService } from "./progressService";

const referenceTime = new Date("2026-08-18T12:00:00.000Z");

async function main() {
  const userA = randomUUID();
  const userB = randomUUID();
  const sessionIds = {
    running: randomUUID(),
    noEvaluation: randomUUID(),
    currentOne: randomUUID(),
    failed: randomUUID(),
    otherVersion: randomUUID(),
    currentTwo: randomUUID(),
    outsideWindow: randomUUID(),
    userB: randomUUID()
  };
  const evaluationIds = {
    currentOne: randomUUID(),
    failed: randomUUID(),
    otherVersion: randomUUID(),
    currentTwo: randomUUID(),
    outsideWindow: randomUUID(),
    userB: randomUUID()
  };
  const allSessionIds = Object.values(sessionIds);

  try {
    await prisma.user.createMany({ data: [
      { id: userA, email: `phase9b-a-${userA}@example.test`, passwordHash: "isolated-test-hash", displayName: "Phase 9B User A" },
      { id: userB, email: `phase9b-b-${userB}@example.test`, passwordHash: "isolated-test-hash", displayName: "Phase 9B User B" }
    ] });

    const createSession = (input: {
      id: string;
      userId: string;
      status: "RUNNING" | "COMPLETED";
      completedAt: Date | null;
      displayName: unknown;
    }) => prisma.simulationSession.create({ data: {
      id: input.id,
      userId: input.userId,
      personaId: `persona-${input.id}`,
      mode: "SALE_FIRST",
      status: input.status,
      personaSnapshot: { displayName: input.displayName, privateSource: "must-not-leak" } as Prisma.InputJsonValue,
      scenarioSnapshot: { id: "safe", title: "Safe fixture" },
      runtimeSessionId: randomUUID(),
      runtimeSnapshot: { privateRuntime: "must-not-load" },
      signals: [],
      result: input.status === "COMPLETED" ? { outcome: "completed" } : undefined,
      createdAt: new Date(input.completedAt?.getTime() ?? referenceTime.getTime() - 60_000),
      completedAt: input.completedAt
    } });

    await Promise.all([
      createSession({ id: sessionIds.running, userId: userA, status: "RUNNING", completedAt: null, displayName: "Running A" }),
      createSession({ id: sessionIds.noEvaluation, userId: userA, status: "COMPLETED", completedAt: new Date("2026-07-25T12:00:00.000Z"), displayName: "No Evaluation A" }),
      createSession({ id: sessionIds.currentOne, userId: userA, status: "COMPLETED", completedAt: new Date("2026-08-01T12:00:00.000Z"), displayName: "Persona A" }),
      createSession({ id: sessionIds.failed, userId: userA, status: "COMPLETED", completedAt: new Date("2026-08-02T12:00:00.000Z"), displayName: "Failed A" }),
      createSession({ id: sessionIds.otherVersion, userId: userA, status: "COMPLETED", completedAt: new Date("2026-08-03T12:00:00.000Z"), displayName: "Other Version A" }),
      createSession({ id: sessionIds.currentTwo, userId: userA, status: "COMPLETED", completedAt: new Date("2026-08-04T12:00:00.000Z"), displayName: 42 }),
      createSession({ id: sessionIds.outsideWindow, userId: userA, status: "COMPLETED", completedAt: new Date("2026-07-01T12:00:00.000Z"), displayName: "Outside A" }),
      createSession({ id: sessionIds.userB, userId: userB, status: "COMPLETED", completedAt: new Date("2026-08-05T12:00:00.000Z"), displayName: "Private Persona B" })
    ]);

    await prisma.conversationTurn.create({ data: {
      id: randomUUID(),
      sessionId: sessionIds.currentOne,
      sequence: 1,
      sender: "SALE",
      content: "PRIVATE_TRANSCRIPT_MUST_NOT_LOAD",
      createdAt: new Date("2026-08-01T11:00:00.000Z")
    } });

    const criteria = (value: unknown) => value as Prisma.InputJsonValue;
    await prisma.sessionEvaluation.createMany({ data: [
      { id: evaluationIds.currentOne, sessionId: sessionIds.currentOne, evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", overallScore: 80, criteria: criteria([{ key: "COMMUNICATION", applicability: "APPLICABLE", score: 80 }]), evaluatedAt: new Date("2026-08-01T13:00:00.000Z") },
      { id: evaluationIds.failed, sessionId: sessionIds.failed, evaluatorVersion: EVALUATOR_VERSION, status: "FAILED", failureCode: "ISOLATED_FAILURE" },
      { id: evaluationIds.otherVersion, sessionId: sessionIds.otherVersion, evaluatorVersion: "testlab-evaluator-v2", status: "COMPLETED", overallScore: 99, criteria: criteria([{ key: "COMMUNICATION", applicability: "APPLICABLE", score: 99 }]), evaluatedAt: new Date("2026-08-03T13:00:00.000Z") },
      { id: evaluationIds.currentTwo, sessionId: sessionIds.currentTwo, evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", overallScore: 90, criteria: criteria([
        { key: "COMMUNICATION", applicability: "APPLICABLE", score: 90 },
        { key: "PRODUCT_CONSULTATION", applicability: "NOT_APPLICABLE", score: 0 },
        { key: "NEEDS_DISCOVERY", applicability: "APPLICABLE", score: "malformed" }
      ]), evaluatedAt: new Date("2026-08-04T13:00:00.000Z") },
      { id: evaluationIds.outsideWindow, sessionId: sessionIds.outsideWindow, evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", overallScore: 60, criteria: criteria([{ key: "COMMUNICATION", applicability: "APPLICABLE", score: 60 }]), evaluatedAt: new Date("2026-07-01T13:00:00.000Z") },
      { id: evaluationIds.userB, sessionId: sessionIds.userB, evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", overallScore: 11, criteria: criteria([{ key: "COMMUNICATION", applicability: "APPLICABLE", score: 11 }]), evaluatedAt: new Date("2026-08-05T13:00:00.000Z") }
    ] });

    const repository = new DatabaseProgressRepository(prisma);
    const counts = await repository.getSessionCounts(userA);
    assert.deepEqual(counts, { totalSessions: 7, completedSessions: 6 });

    const windowSessions = await repository.getCompletedSessionsInWindow(userA, new Date("2026-07-21T12:00:00.000Z"), referenceTime);
    assert.equal(windowSessions.length, 5);
    assert(windowSessions.every((session) => session.status === "COMPLETED"));
    assert(!windowSessions.some((session) => session.sessionId === sessionIds.outsideWindow || session.sessionId === sessionIds.userB));

    const samples = await repository.getEvaluationSamples(userA);
    assert.equal(samples.length, 5);
    assert(samples.every((sample) => sample.sessionId !== sessionIds.userB));
    assert(!JSON.stringify(samples).includes("Private Persona B"));
    assert(!JSON.stringify(samples).includes("PRIVATE_TRANSCRIPT_MUST_NOT_LOAD"));
    assert(!JSON.stringify(samples).includes("privateRuntime"));
    assert.equal(samples.find((sample) => sample.evaluationId === evaluationIds.currentTwo)?.personaDisplayName, "Khách hàng");

    const progress = await new ProgressService({ repository, now: () => new Date(referenceTime) }).get(userA);
    assert.equal(progress.summary.totalSessions, 7);
    assert.equal(progress.summary.completedSessions, 6);
    assert.equal(progress.summary.evaluatedSessions, 3, "FAILED and other evaluator versions must be excluded by Phase 9A rules");
    assert.equal(progress.summary.trainingFrequency.completedSessions, 5);
    assert.deepEqual(progress.recentEvaluatedSessions.map((session) => session.sessionId), [sessionIds.currentTwo, sessionIds.currentOne, sessionIds.outsideWindow]);
    assert(progress.recentEvaluatedSessions.every((session) => session.persona.displayName !== "Private Persona B"));
    assert.equal(progress.skills.find((skill) => skill.criterionKey === "COMMUNICATION")?.sampleCount, 3);
    assert.equal(progress.skills.find((skill) => skill.criterionKey === "PRODUCT_CONSULTATION")?.sampleCount, 0, "N/A criteria must be excluded");
    assert.equal(progress.skills.find((skill) => skill.criterionKey === "NEEDS_DISCOVERY")?.sampleCount, 0, "malformed criteria must be excluded without invalidating overall analytics");

    const emptyCounts = await repository.getSessionCounts(randomUUID());
    assert.deepEqual(emptyCounts, { totalSessions: 0, completedSessions: 0 });
  } finally {
    await prisma.simulationSession.deleteMany({ where: { id: { in: allSessionIds }, userId: { in: [userA, userB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    assert.equal(await prisma.simulationSession.count({ where: { id: { in: allSessionIds } } }), 0);
    assert.equal(await prisma.user.count({ where: { id: { in: [userA, userB] } } }), 0);
    await prisma.$disconnect();
  }

  console.log("Phase 9B isolated Progress repository/database tests: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
