import {
  PublicChatMessage,
  PublicPersona,
  PublicRuntimeInsight,
  PublicScenario,
  PublicSession,
  PublicSessionResult
} from "./publicContracts";
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

export function toPublicSession(session: SimulationSession): PublicSession {
  return {
    id: session.id,
    persona: toPublicPersona(session.personaSnapshot),
    scenario: toPublicScenario(session.scenarioSnapshot),
    mode: session.mode,
    status: session.status,
    createdAt: session.createdAt,
    messages: session.messages.map(toPublicChatMessage),
    runtimeInsight: session.runtimeInsight ? toPublicRuntimeInsight(session.runtimeInsight) : null,
    ...(session.result ? { result: toPublicSessionResult(session.result) } : {})
  };
}
