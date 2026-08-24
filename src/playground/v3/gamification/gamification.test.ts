import { strict as assert } from "assert";
import {
  assignmentCompletionTime,
  businessDate,
  currentMonthPeriod,
  isEligibleSession,
  levelProgress,
  qualityBonus,
  sessionXp,
  SessionXpCandidate,
  streaks
} from "./gamificationDomain";

for (const [score, expected] of [[59, 20], [60, 25], [69, 25], [70, 30], [79, 30], [80, 35], [89, 35], [90, 40], [100, 40]] as const) {
  assert.equal(sessionXp(score), expected, `score ${score}`);
}
for (const invalid of [-1, 101, 60.5, Number.NaN]) assert.throws(() => qualityBonus(invalid), /INVALID_EVALUATION_SCORE/);

const candidate = (saleTurnCount: number): SessionXpCandidate => ({
  sessionId: "session", evaluationId: "evaluation", userId: "sale", userRole: "SALE", userStatus: "ACTIVE",
  sessionStatus: "COMPLETED", completedAt: "2026-08-31T16:50:00.000Z", evaluatorVersion: "testlab-evaluator-v1",
  evaluationStatus: "COMPLETED", overallScore: 80, evaluatedAt: "2026-08-31T17:05:00.000Z", saleTurnCount,
  personaId: "persona", personaVersionId: "persona-v1", scenarioVersionId: "scenario-v1", scenarioIdentity: "scenario", mode: "SALE_FIRST"
});
for (const turns of [0, 1, 2]) assert.equal(isEligibleSession(candidate(turns)), false);
for (const turns of [3, 4, 10]) assert.equal(isEligibleSession(candidate(turns)), true);
assert.equal(isEligibleSession({ ...candidate(3), userRole: "MANAGER" }), false);
assert.equal(isEligibleSession({ ...candidate(3), userStatus: "DISABLED" }), false);
assert.equal(isEligibleSession({ ...candidate(3), evaluationStatus: "FAILED" }), false);
assert.equal(isEligibleSession({ ...candidate(3), evaluatorVersion: "testlab-evaluator-v2" }), false);

assert.equal(businessDate("2026-08-31T16:50:00.000Z"), "2026-08-31");
assert.equal(businessDate("2026-08-31T17:00:00.000Z"), "2026-09-01");
const august = currentMonthPeriod(new Date("2026-08-31T16:59:59.999Z"));
assert.equal(august.startAt, "2026-07-31T17:00:00.000Z");
assert.equal(august.endAt, "2026-08-31T17:00:00.000Z");
const september = currentMonthPeriod(new Date("2026-08-31T17:00:00.000Z"));
assert.equal(september.startAt, "2026-08-31T17:00:00.000Z");
assert.equal(september.endAt, "2026-09-30T17:00:00.000Z");

assert.deepEqual(levelProgress(0), { totalXp: 0, level: 1, currentLevelXp: 0, xpToNextLevel: 250 });
assert.equal(levelProgress(249).level, 1);
assert.deepEqual(levelProgress(250), { totalXp: 250, level: 2, currentLevelXp: 0, xpToNextLevel: 250 });
assert.equal(levelProgress(499).level, 2);
assert.equal(levelProgress(500).level, 3);

assert.deepEqual(streaks(["2026-08-20", "2026-08-21", "2026-08-22"], new Date("2026-08-22T10:00:00.000Z")), { currentStreakDays: 3, bestStreakDays: 3 });
assert.equal(streaks(["2026-08-20", "2026-08-21"], new Date("2026-08-22T10:00:00.000Z")).currentStreakDays, 2);
assert.equal(streaks(["2026-08-19", "2026-08-20"], new Date("2026-08-22T10:00:00.000Z")).currentStreakDays, 0);
assert.deepEqual(streaks(["2026-12-31", "2027-01-01", "2027-01-03"], new Date("2027-01-03T10:00:00.000Z")), { currentStreakDays: 1, bestStreakDays: 2 });

const completion = assignmentCompletionTime({
  assignmentId: "assignment", userId: "sale", userRole: "SALE", userStatus: "ACTIVE", cancelledAt: null,
  requiredItemIds: ["item-a", "item-b"], completedSessions: [
    { itemId: "item-a", completedAt: "2026-08-20T01:00:00.000Z", sessionId: "a2" },
    { itemId: "item-a", completedAt: "2026-08-19T01:00:00.000Z", sessionId: "a1" },
    { itemId: "item-b", completedAt: "2026-08-21T01:00:00.000Z", sessionId: "b1" }
  ]
});
assert.equal(completion, "2026-08-21T01:00:00.000Z");
assert.equal(assignmentCompletionTime({ assignmentId: "x", userId: "sale", userRole: "SALE", userStatus: "ACTIVE", cancelledAt: null, requiredItemIds: ["missing"], completedSessions: [] }), null);
assert.equal(assignmentCompletionTime({ assignmentId: "x", userId: "sale", userRole: "SALE", userStatus: "ACTIVE", cancelledAt: "2026-08-20T00:00:00.000Z", requiredItemIds: ["item"], completedSessions: [{ itemId: "item", completedAt: "2026-08-21T00:00:00.000Z", sessionId: "session" }] }), null);
assert.equal(assignmentCompletionTime({ assignmentId: "x", userId: "manager", userRole: "MANAGER", userStatus: "ACTIVE", cancelledAt: null, requiredItemIds: ["item"], completedSessions: [{ itemId: "item", completedAt: "2026-08-21T00:00:00.000Z", sessionId: "session" }] }), null);

console.log("Phase 12 Gamification rules/eligibility/timezone/level/streak tests: PASS");
