import { strict as assert } from "assert";
import { EVALUATION_RUBRIC, EVALUATOR_VERSION } from "../evaluation/evaluationDomain";
import { ProgressEvaluationRepositorySample, ProgressRepository } from "./progressRepository";
import { ProgressService } from "./progressService";

const referenceTime = new Date("2026-08-18T12:00:00.000Z");

function evaluation(index: number, score: number, overrides: Partial<ProgressEvaluationRepositorySample> = {}): ProgressEvaluationRepositorySample {
  return {
    evaluationId: `evaluation-${index}`,
    sessionId: `session-${index}`,
    evaluatorVersion: EVALUATOR_VERSION,
    status: "COMPLETED",
    overallScore: score,
    evaluatedAt: new Date(Date.UTC(2026, 7, index, 8)).toISOString(),
    criteria: EVALUATION_RUBRIC.map((criterion) => ({ key: criterion.key, applicability: "APPLICABLE", score })),
    mode: index % 2 ? "SALE_FIRST" : "CUSTOMER_FIRST",
    personaDisplayName: `Persona ${index}`,
    ...overrides
  };
}

class FixtureProgressRepository implements ProgressRepository {
  readonly users: string[] = [];
  readonly windows: Array<{ from: Date; to: Date }> = [];

  constructor(private readonly evaluations: ProgressEvaluationRepositorySample[]) {}

  async getSessionCounts(userId: string) {
    this.users.push(userId);
    return { totalSessions: 7, completedSessions: 6 };
  }

  async getCompletedSessionsInWindow(userId: string, from: Date, to: Date) {
    this.users.push(userId);
    this.windows.push({ from, to });
    return [
      { sessionId: "frequency-1", status: "COMPLETED", completedAt: "2026-07-21T12:00:00.000Z" },
      { sessionId: "frequency-2", status: "COMPLETED", completedAt: "2026-08-01T12:00:00.000Z" },
      { sessionId: "frequency-3", status: "COMPLETED", completedAt: referenceTime.toISOString() }
    ];
  }

  async getEvaluationSamples(userId: string) {
    this.users.push(userId);
    return this.evaluations;
  }
}

async function main() {
  let nowCalls = 0;
  const evaluations = [
    evaluation(1, 50),
    evaluation(2, 60),
    evaluation(3, 70),
    evaluation(4, 80, { personaDisplayName: "   " }),
    evaluation(5, 100, { status: "FAILED" }),
    evaluation(6, 100, { evaluatorVersion: "testlab-evaluator-v2" })
  ];
  const repository = new FixtureProgressRepository(evaluations);
  const service = new ProgressService({
    repository,
    now: () => {
      nowCalls += 1;
      return new Date(referenceTime);
    }
  });
  const progress = await service.get("owner-a");

  assert.equal(nowCalls, 1, "reference time must be resolved once per request");
  assert.deepEqual(repository.users, ["owner-a", "owner-a", "owner-a"]);
  assert.equal(repository.windows.length, 1);
  assert.equal(repository.windows[0].from.toISOString(), "2026-07-21T12:00:00.000Z");
  assert.equal(repository.windows[0].to.toISOString(), referenceTime.toISOString());

  assert.equal(progress.evaluatorVersion, EVALUATOR_VERSION);
  assert.deepEqual(progress.summary, {
    totalSessions: 7,
    completedSessions: 6,
    evaluatedSessions: 4,
    averageOverallScore: 65,
    recentAverageScore: 70,
    trainingFrequency: { windowDays: 28, completedSessions: 3, averagePerWeek: 0.8 }
  });
  assert.deepEqual(progress.overallTrend.state, "IMPROVING");
  assert.equal(progress.overallTrend.delta, 20);
  assert.equal(progress.overallTrend.points.length, 4);
  assert.equal(progress.skills.length, 6);
  assert.deepEqual(progress.skills.map((skill) => [skill.criterionKey, skill.label]), EVALUATION_RUBRIC.map((criterion) => [criterion.key, criterion.label]));
  assert(progress.skills.every((skill) => skill.sampleCount === 4 && skill.trend.state === "IMPROVING"));
  assert.equal(progress.highlights.strongestSkillKey, "TOPIC_COVERAGE");
  assert.equal(progress.highlights.needsAttentionSkillKey, "NEEDS_DISCOVERY");
  assert.deepEqual(progress.recentEvaluatedSessions.map((session) => session.sessionId), ["session-4", "session-3", "session-2", "session-1"]);
  assert.equal(progress.recentEvaluatedSessions[0].persona.displayName, "Khách hàng");

  const emptyRepository: ProgressRepository = {
    getSessionCounts: async () => ({ totalSessions: 0, completedSessions: 0 }),
    getCompletedSessionsInWindow: async () => [],
    getEvaluationSamples: async () => []
  };
  const empty = await new ProgressService({ repository: emptyRepository, now: () => new Date(referenceTime) }).get("empty-owner");
  assert.equal(empty.summary.evaluatedSessions, 0);
  assert.equal(empty.summary.averageOverallScore, null);
  assert.equal(empty.overallTrend.state, "NO_DATA");
  assert.equal(empty.skills.length, 6);
  assert.deepEqual(empty.highlights, { strongestSkillKey: null, needsAttentionSkillKey: null });
  assert.deepEqual(empty.recentEvaluatedSessions, []);

  const oneRepository = new FixtureProgressRepository([evaluation(1, 75)]);
  const one = await new ProgressService({ repository: oneRepository, now: () => new Date(referenceTime) }).get("one-owner");
  assert.equal(one.overallTrend.state, "BASELINE_ONLY");
  assert.equal(one.skills[0].trend.state, "BASELINE_ONLY");

  console.log("Phase 9B ProgressService tests: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
