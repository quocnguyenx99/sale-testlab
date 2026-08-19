import { PublicProgress } from "../publicContracts";
import { EVALUATOR_VERSION } from "../evaluation/evaluationDomain";
import {
  buildOverallTrendPoints,
  calculateOverallMetrics,
  calculateSkillInsights,
  calculateTrainingFrequency,
  PROGRESS_FREQUENCY_WINDOW_DAYS,
  selectRecentEvaluatedSessions
} from "./progressMetrics";
import {
  ProgressEvaluationRepositorySample,
  ProgressRepository
} from "./progressRepository";

const DAY_MS = 24 * 60 * 60 * 1_000;
const PERSONA_DISPLAY_NAME_FALLBACK = "Khách hàng";
const PERSONA_DISPLAY_NAME_MAX_CHARS = 160;

interface ProgressServiceDependencies {
  repository: ProgressRepository;
  now?: () => Date;
}

export class ProgressService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: ProgressServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async get(userId: string): Promise<PublicProgress> {
    const referenceTime = this.now();
    const windowStart = new Date(referenceTime.getTime() - PROGRESS_FREQUENCY_WINDOW_DAYS * DAY_MS);
    const [counts, frequencySessions, evaluations] = await Promise.all([
      this.dependencies.repository.getSessionCounts(userId),
      this.dependencies.repository.getCompletedSessionsInWindow(userId, windowStart, referenceTime),
      this.dependencies.repository.getEvaluationSamples(userId)
    ]);

    const overall = calculateOverallMetrics(evaluations);
    const skillInsights = calculateSkillInsights(evaluations);
    const recentByEvaluationId = new Map(evaluations.map((evaluation) => [evaluation.evaluationId, evaluation]));

    return {
      evaluatorVersion: EVALUATOR_VERSION,
      summary: {
        totalSessions: counts.totalSessions,
        completedSessions: counts.completedSessions,
        evaluatedSessions: overall.evaluatedSessions,
        averageOverallScore: overall.averageOverallScore,
        recentAverageScore: overall.recentAverageScore,
        trainingFrequency: calculateTrainingFrequency(frequencySessions, referenceTime.toISOString())
      },
      overallTrend: {
        ...overall.trend,
        points: buildOverallTrendPoints(evaluations)
      },
      skills: skillInsights.skills,
      highlights: {
        strongestSkillKey: skillInsights.strongestSkillKey,
        needsAttentionSkillKey: skillInsights.needsAttentionSkillKey
      },
      recentEvaluatedSessions: selectRecentEvaluatedSessions(evaluations).flatMap((recent) => {
        const source = recentByEvaluationId.get(recent.evaluationId);
        return source ? [{
          sessionId: recent.sessionId,
          evaluatedAt: recent.evaluatedAt,
          persona: { displayName: safePersonaDisplayName(source) },
          mode: source.mode,
          overallScore: recent.score
        }] : [];
      })
    };
  }
}

function safePersonaDisplayName(source: ProgressEvaluationRepositorySample): string {
  const value = source.personaDisplayName.trim();
  return value ? value.slice(0, PERSONA_DISPLAY_NAME_MAX_CHARS) : PERSONA_DISPLAY_NAME_FALLBACK;
}
