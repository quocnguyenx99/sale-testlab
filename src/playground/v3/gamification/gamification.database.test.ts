import { strict as assert } from "assert";
import { randomUUID } from "crypto";
import { prisma } from "../prismaClient";
import { DatabaseGamificationRepository } from "./databaseGamificationRepository";
import { GamificationService } from "./gamificationService";

const prefix = `phase12-${process.pid}-${Date.now()}`;
const userId = randomUUID();
const programId = randomUUID();
const assignmentId = randomUUID();
const itemIds = [randomUUID(), randomUUID()];
const sessionIds: string[] = [];
const evaluationIds: string[] = [];
const leaderboardUserIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const leaderboardEventIds: string[] = [];

async function main(): Promise<void> {
  const repository = new DatabaseGamificationRepository(prisma);
  const service = new GamificationService(repository);
  try {
    await prisma.user.create({ data: { id: userId, email: `${prefix}@testlab.local`, passwordHash: "fixture-only", displayName: "Phase 12 Sale", role: "SALE", status: "ACTIVE" } });
    await createEvaluatedSession("first", "2026-08-24T02:00:00.000Z", "content-a", 59);
    await createEvaluatedSession("repeat", "2026-08-24T03:00:00.000Z", "content-a", 60);
    await createEvaluatedSession("second", "2026-08-24T04:00:00.000Z", "content-b", 70);
    await createEvaluatedSession("third", "2026-08-24T05:00:00.000Z", "content-c", 80);
    await createEvaluatedSession("cap", "2026-08-24T06:00:00.000Z", "content-d", 90);
    await createEvaluatedSession("next-day", "2026-08-25T02:00:00.000Z", "content-a", 100);

    const results = [];
    for (const id of sessionIds) results.push(await service.reconcileSession(id));
    assert.deepEqual(results.map((event) => [event?.creditStatus, event?.points]), [
      ["AWARDED", 20], ["REPEAT_CONTENT", 0], ["AWARDED", 30], ["AWARDED", 35], ["DAILY_CAP", 0], ["AWARDED", 40]
    ]);
    const before = await prisma.gamificationEvent.count({ where: { userId, eventType: "SESSION_XP" } });
    const raced = await Promise.all([service.reconcileSession(sessionIds[0]), service.reconcileSession(sessionIds[0])]);
    assert.equal(raced[0]?.id, raced[1]?.id);
    assert.equal(await prisma.gamificationEvent.count({ where: { userId, eventType: "SESSION_XP" } }), before);
    await assert.rejects(
      () => prisma.simulationSession.delete({ where: { id: sessionIds[0] } }),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2003",
      "source Session deletion must be restricted while immutable ledger history exists"
    );

    await prisma.trainingProgram.create({ data: {
      id: programId, name: `${prefix}-program`, status: "PUBLISHED", createdByUserId: userId,
      items: { create: itemIds.map((id, index) => ({ id, personaId: `assignment-persona-${index}`, scenarioId: `assignment-scenario-${index}`, mode: "SALE_FIRST", sortOrder: index + 1 })) }
    } });
    await prisma.trainingAssignment.create({ data: { id: assignmentId, programId, assignedToUserId: userId, assignedByUserId: userId } });
    const firstAssignmentSession = await createCompletedSession("assignment-a", "2026-08-26T02:00:00.000Z", "assignment-a", assignmentId, itemIds[0]);
    assert.equal(await service.reconcileAssignmentForSession(firstAssignmentSession), null);
    const secondAssignmentSession = await createCompletedSession("assignment-b", "2026-08-27T02:00:00.000Z", "assignment-b", assignmentId, itemIds[1]);
    const assignmentEvent = await service.reconcileAssignmentForSession(secondAssignmentSession);
    assert.equal(assignmentEvent?.points, 50);
    assert.equal(assignmentEvent?.occurredAt, "2026-08-27T02:00:00.000Z");
    assert.equal((await service.reconcileAssignment(assignmentId))?.id, assignmentEvent?.id);
    assert.equal(await prisma.gamificationEvent.count({ where: { sourceAssignmentId: assignmentId } }), 1);

    const retrySessionId = await createCompletedSession("evaluation-retry", "2026-08-28T02:00:00.000Z", "retry-content");
    assert.equal(await service.reconcileSession(retrySessionId), null, "missing Evaluation cannot earn XP");
    const retryEvaluationId = randomUUID();
    evaluationIds.push(retryEvaluationId);
    await prisma.sessionEvaluation.create({ data: {
      id: retryEvaluationId, sessionId: retrySessionId, evaluatorVersion: "testlab-evaluator-v1", status: "FAILED",
      criteria: [], strengths: [], improvementAreas: []
    } });
    assert.equal(await service.reconcileSession(retrySessionId), null, "FAILED Evaluation cannot earn XP");
    await prisma.sessionEvaluation.update({ where: { id: retryEvaluationId }, data: { status: "COMPLETED", overallScore: 70, evaluatedAt: new Date("2026-08-28T03:00:00.000Z") } });
    const retryEvent = await service.reconcileSession(retrySessionId);
    assert.equal(retryEvent?.points, 30);
    assert.equal((await service.reconcileSession(retrySessionId))?.id, retryEvent?.id);
    assert.equal(await prisma.gamificationEvent.count({ where: { sourceSessionId: retrySessionId } }), 1);
    const aggregate = await repository.getPersonalAggregate(userId, new Date("2026-07-31T17:00:00.000Z"), new Date("2026-08-31T17:00:00.000Z"));
    assert.deepEqual(aggregate.activityDates, ["2026-08-24", "2026-08-25", "2026-08-28"], "zero-point and Assignment events must not extend streak dates");

    await createLeaderboardFixtures();
    const leaderboard = await repository.getLeaderboard({
      monthStart: new Date("2026-08-31T17:00:00.000Z"), monthEnd: new Date("2026-09-30T17:00:00.000Z"),
      page: 1, pageSize: 2, currentUserId: leaderboardUserIds[0]
    });
    assert.equal(leaderboard.totalParticipants, 3);
    assert.deepEqual(leaderboard.rows.map((row) => row.userId), [leaderboardUserIds[1], leaderboardUserIds[0]], "last-positive timestamp must break equal XP/session ties ascending");
    assert.equal(leaderboard.currentUser?.rank, 2);
    assert.equal(leaderboard.currentUser?.currentMonthXp, 100);
    assert.equal(leaderboard.currentUser?.creditedSessions, 2);
    const secondPage = await repository.getLeaderboard({
      monthStart: new Date("2026-08-31T17:00:00.000Z"), monthEnd: new Date("2026-09-30T17:00:00.000Z"),
      page: 2, pageSize: 2, currentUserId: leaderboardUserIds[4]
    });
    assert.deepEqual(secondPage.rows.map((row) => row.userId), [leaderboardUserIds[2]]);
    assert.equal(secondPage.currentUser, null, "disabled SALE must not be ranked");

    const personal = await service.getPersonal({ id: userId, role: "SALE" });
    assert.equal(personal.totalXp, 205);
    assert.equal(personal.level, 1);
    assert.equal(personal.currentStreakDays >= 0, true);
    assert(!JSON.stringify(personal).includes(sessionIds[0]));
    console.log("Phase 12 Gamification DB anti-farming/concurrency/assignment/privacy tests: PASS");
  } finally {
    for (const eventId of leaderboardEventIds) await prisma.gamificationEvent.deleteMany({ where: { id: eventId } });
    await prisma.gamificationEvent.deleteMany({ where: { userId } });
    for (const evaluationId of evaluationIds) await prisma.sessionEvaluation.deleteMany({ where: { id: evaluationId } });
    for (const sessionId of sessionIds) {
      await prisma.conversationTurn.deleteMany({ where: { sessionId } });
      await prisma.simulationSession.deleteMany({ where: { id: sessionId } });
    }
    await prisma.trainingAssignment.deleteMany({ where: { id: assignmentId } });
    for (const itemId of itemIds) await prisma.trainingProgramItem.deleteMany({ where: { id: itemId } });
    await prisma.trainingProgram.deleteMany({ where: { id: programId } });
    for (const id of leaderboardUserIds) await prisma.user.deleteMany({ where: { id } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

async function createLeaderboardFixtures(): Promise<void> {
  const [laterSale, earlierSale, fewerSessionsSale, manager, disabledSale] = leaderboardUserIds;
  await prisma.user.createMany({ data: [
    { id: laterSale, email: `${prefix}-later@testlab.local`, passwordHash: "fixture-only", displayName: "Later Sale", role: "SALE", status: "ACTIVE" },
    { id: earlierSale, email: `${prefix}-earlier@testlab.local`, passwordHash: "fixture-only", displayName: "Earlier Sale", role: "SALE", status: "ACTIVE" },
    { id: fewerSessionsSale, email: `${prefix}-fewer@testlab.local`, passwordHash: "fixture-only", displayName: "Fewer Sessions", role: "SALE", status: "ACTIVE" },
    { id: manager, email: `${prefix}-manager@testlab.local`, passwordHash: "fixture-only", displayName: "Manager", role: "MANAGER", status: "ACTIVE" },
    { id: disabledSale, email: `${prefix}-disabled@testlab.local`, passwordHash: "fixture-only", displayName: "Disabled Sale", role: "SALE", status: "DISABLED" }
  ] });
  const events = [
    event(laterSale, 40, "2026-09-02T08:00:00.000Z", "SESSION_XP"),
    event(laterSale, 60, "2026-09-03T10:00:00.000Z", "SESSION_XP"),
    event(earlierSale, 40, "2026-09-02T07:00:00.000Z", "SESSION_XP"),
    event(earlierSale, 60, "2026-09-03T09:00:00.000Z", "SESSION_XP"),
    event(fewerSessionsSale, 50, "2026-09-02T06:00:00.000Z", "SESSION_XP"),
    event(fewerSessionsSale, 50, "2026-09-02T07:00:00.000Z", "ASSIGNMENT_XP"),
    event(manager, 200, "2026-09-01T05:00:00.000Z", "SESSION_XP"),
    event(disabledSale, 300, "2026-09-01T04:00:00.000Z", "SESSION_XP"),
    event(laterSale, 200, "2026-08-15T04:00:00.000Z", "ASSIGNMENT_XP")
  ];
  leaderboardEventIds.push(...events.map((item) => item.id));
  await prisma.gamificationEvent.createMany({ data: events });
}

function event(user: string, points: number, occurredAt: string, eventType: "SESSION_XP" | "ASSIGNMENT_XP") {
  const id = randomUUID();
  return {
    id, userId: user, eventType, creditStatus: "AWARDED" as const, ruleVersion: "testlab-gamification-v1",
    points, occurredAt: new Date(occurredAt), activityDate: new Date(`${occurredAt.slice(0, 10)}T00:00:00.000Z`)
  };
}

async function createEvaluatedSession(label: string, completedAt: string, content: string, score: number): Promise<void> {
  const sessionId = await createCompletedSession(label, completedAt, content);
  const evaluationId = randomUUID();
  evaluationIds.push(evaluationId);
  await prisma.sessionEvaluation.create({ data: {
    id: evaluationId, sessionId, evaluatorVersion: "testlab-evaluator-v1", status: "COMPLETED", overallScore: score,
    criteria: [], strengths: [], improvementAreas: [], evaluatedAt: new Date(Date.parse(completedAt) + 60_000)
  } });
}

async function createCompletedSession(label: string, completedAt: string, content: string, trainingAssignmentId?: string, trainingProgramItemId?: string): Promise<string> {
  const sessionId = randomUUID();
  sessionIds.push(sessionId);
  await prisma.simulationSession.create({ data: {
    id: sessionId, userId, personaId: `legacy-${content}`, mode: "SALE_FIRST", status: "COMPLETED",
    personaSnapshot: { id: `legacy-${content}`, displayName: label }, scenarioSnapshot: { id: content, title: label },
    runtimeSessionId: randomUUID(), signals: [], result: { outcome: "completed" },
    createdAt: new Date(Date.parse(completedAt) - 300_000), completedAt: new Date(completedAt),
    trainingAssignmentId, trainingProgramItemId,
    turns: { create: [0, 1, 2].map((sequence) => ({ id: randomUUID(), sequence, sender: "SALE", content: "fixture", createdAt: new Date(Date.parse(completedAt) - (3 - sequence) * 10_000) })) }
  } });
  return sessionId;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
