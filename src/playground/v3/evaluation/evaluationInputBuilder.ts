import { EvaluationInput } from "./evaluationDomain";
import { SimulationSession } from "../simulationSession";

const MAX_TURNS = 60;
const MAX_TURN_CHARS = 2_000;

export function buildEvaluationInput(session: SimulationSession): EvaluationInput {
  const result = session.result;
  const insight = session.runtimeInsight;
  const turns = session.messages.slice(-MAX_TURNS).map((message, index) => ({
    sequence: Math.max(1, session.messages.length - Math.min(session.messages.length, MAX_TURNS) + index + 1),
    sender: message.sender,
    content: message.content.slice(0, MAX_TURN_CHARS)
  }));
  return {
    sessionId: session.id,
    persona: {
      displayName: session.personaSnapshot.displayName,
      role: session.personaSnapshot.role,
      customerType: session.personaSnapshot.customerType,
      summary: session.personaSnapshot.summary
    },
    scenario: { title: session.scenarioSnapshot.title, description: session.scenarioSnapshot.description },
    mode: session.mode,
    turns,
    outcome: result?.outcome ?? insight?.dealOutcome ?? "not_ready",
    trainingStatus: result?.trainingStatus ?? insight?.trainingStatus ?? "in_progress",
    resolvedTopics: [...new Set(result?.resolvedTopics ?? insight?.resolvedTopics ?? [])].slice(0, 20),
    missingTopics: [...new Set(result?.missingTopics ?? insight?.missingTopics ?? [])].slice(0, 20),
    signals: [...new Set(result?.signals ?? session.signals)].slice(0, 20)
  };
}

export function evaluationInputSize(input: EvaluationInput): { turns: number; characters: number } {
  return { turns: input.turns.length, characters: JSON.stringify(input).length };
}
