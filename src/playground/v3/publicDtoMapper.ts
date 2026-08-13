import {
  PublicChatMessage,
  PublicPersona,
  PublicRecentSession,
  PublicRuntimeInsight,
  PublicScenario,
  PublicSession,
  PublicSessionResult,
  PublicSessionEvaluation,
  PublicSessionCoaching
} from "./publicContracts";
import { SessionEvaluationRecord } from "./evaluation/evaluationDomain";
import { SessionCoachingFeedback } from "./coaching/coachingDomain";
import { RecentSessionSummary } from "./sessionRepository";
import {
  SimulationMessage,
  SimulationPersonaSnapshot,
  SimulationRuntimeInsight,
  SimulationScenarioSnapshot,
  SimulationSession
} from "./simulationSession";

export function toPublicScenario(scenario: SimulationScenarioSnapshot): PublicScenario {
  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    difficulty: scenario.difficulty
  };
}

export function toPublicPersona(persona: SimulationPersonaSnapshot): PublicPersona {
  const interest = persona.interests[0] || "giải pháp phù hợp";
  return {
    id: persona.id,
    displayName: persona.displayName,
    role: persona.role,
    customerType: persona.customerType,
    difficulty: persona.difficulty,
    summary: persona.summary,
    interests: persona.interests,
    scenarioContext: persona.scenarioContext,
    defaultScenario: {
      id: `persona-${persona.id}`,
      title: `Tư vấn ${interest}`,
      description: persona.scenarioContext || `Khám phá nhu cầu của ${persona.role}.`,
      difficulty: persona.difficulty
    }
  };
}

export function toPublicChatMessage(message: SimulationMessage): PublicChatMessage {
  return {
    id: message.id,
    sender: message.sender,
    content: message.content,
    createdAt: message.createdAt
  };
}

export function toPublicRuntimeInsight(insight: SimulationRuntimeInsight): PublicRuntimeInsight {
  return {
    runtimeState: insight.runtimeState,
    resolvedTopics: insight.resolvedTopics,
    missingTopics: insight.missingTopics,
    nextUnresolvedTopic: insight.nextUnresolvedTopic,
    dealOutcome: insight.dealOutcome,
    trainingStatus: insight.trainingStatus,
    topicProgress: { resolved: insight.topicProgress.resolved, total: insight.topicProgress.total },
    activeProduct: insight.activeProduct ? { model: insight.activeProduct.model, code: insight.activeProduct.code } : null
  };
}

export function toPublicSessionResult(result: NonNullable<SimulationSession["result"]>): PublicSessionResult {
  return {
    outcome: result.outcome,
    trainingStatus: result.trainingStatus,
    turnCount: result.turnCount,
    durationSeconds: result.durationSeconds,
    resolvedTopics: result.resolvedTopics,
    missingTopics: result.missingTopics,
    signals: result.signals
  };
}

export function toPublicSessionEvaluation(evaluation: SessionEvaluationRecord): PublicSessionEvaluation {
  return {
    id: evaluation.id,
    evaluatorVersion: evaluation.evaluatorVersion,
    status: evaluation.status,
    overallScore: evaluation.overallScore,
    criteria: evaluation.criteria.map(({ key, label, score, weight, effectiveWeight, source, applicability, summary, evidenceTurnSequences }) => ({
      key, label, score, weight, effectiveWeight, source, applicability, summary, evidenceTurnSequences
    })),
    strengths: evaluation.strengths,
    improvementAreas: evaluation.improvementAreas,
    evaluatedAt: evaluation.evaluatedAt
  };
}

export function toPublicSessionCoaching(coaching: SessionCoachingFeedback): PublicSessionCoaching {
  return {
    id: coaching.id,
    evaluationId: coaching.evaluationId,
    evaluatorVersion: coaching.evaluatorVersion,
    coachVersion: coaching.coachVersion,
    status: coaching.status,
    summary: coaching.summary,
    priorities: coaching.priorities.map(({ criterionKey, priorityKind, title, whyItMatters, observation, recommendedAction, suggestedPhrasing, evidenceTurnSequences }) => ({
      criterionKey, priorityKind, title, whyItMatters, observation, recommendedAction, suggestedPhrasing, evidenceTurnSequences
    })),
    strengthReinforcement: coaching.strengthReinforcement ? { ...coaching.strengthReinforcement } : null,
    nextPracticeFocus: coaching.nextPracticeFocus,
    coachedAt: coaching.coachedAt
  };
}

export function toPublicRecentSession(session: RecentSessionSummary): PublicRecentSession {
  return {
    id: session.id,
    persona: {
      id: session.persona.id,
      displayName: session.persona.displayName,
      role: session.persona.role,
      customerType: session.persona.customerType
    },
    mode: session.mode,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    turnCount: session.turnCount,
    dealOutcome: session.dealOutcome,
    trainingStatus: session.trainingStatus
  };
}

export function toPublicSession(session: SimulationSession): PublicSession {
  return {
    id: session.id,
    persona: toPublicPersona(session.personaSnapshot),
    scenario: toPublicScenario(session.scenarioSnapshot),
    mode: session.mode,
    status: session.status,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    messages: session.messages.map(toPublicChatMessage),
    runtimeInsight: session.runtimeInsight ? toPublicRuntimeInsight(session.runtimeInsight) : null,
    ...(session.result ? { result: toPublicSessionResult(session.result) } : {})
  };
}
