import {
  SimulationRuntimeInsight,
  SimulationScenarioSnapshot
} from "./simulationSession";

type RuntimePayload = Record<string, unknown>;

export interface OrchestrationResult {
  runtimeSessionId: string;
  finalCustomerReply: string;
  runtimeInsight: SimulationRuntimeInsight;
  scenario: SimulationScenarioSnapshot | null;
  signals: string[];
  shouldEndSession: boolean;
}

export interface SimulationOrchestrator {
  startCustomer(personaId: string): Promise<OrchestrationResult>;
  handleSaleMessage(input: { runtimeSessionId: string; personaId: string; message: string }): Promise<OrchestrationResult>;
}

export interface CompatibilityOrchestratorCallbacks {
  startCustomer: (personaId: string) => Promise<RuntimePayload>;
  chat: (input: { sessionId: string; personaId: string; message: string }) => Promise<RuntimePayload>;
}

const TOPICS = ["product_model", "configuration", "price", "stock", "delivery", "warranty", "payment", "invoice_or_document", "next_step"];

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function runtimeInsight(payload: RuntimePayload): SimulationRuntimeInsight {
  const progress = record(payload.conversation_progress);
  const resolvedFromPayload = strings(payload.resolved_topics);
  const missingFromPayload = strings(payload.missing_topics);
  const resolvedTopics = resolvedFromPayload.length > 0
    ? resolvedFromPayload.filter((topic) => TOPICS.includes(topic))
    : TOPICS.filter((topic) => {
      const state = record(progress?.[topic]);
      return Boolean(state?.answered || state?.confirmed);
    });
  const missingTopics = missingFromPayload.length > 0
    ? missingFromPayload.filter((topic) => TOPICS.includes(topic))
    : TOPICS.filter((topic) => !resolvedTopics.includes(topic));
  const activeProduct = typeof payload.selected_product_model === "string" && typeof payload.selected_product_model_code === "string"
    ? { model: payload.selected_product_model, code: payload.selected_product_model_code }
    : null;
  return {
    runtimeState: typeof payload.runtime_state === "string" ? payload.runtime_state : "auto_state",
    resolvedTopics,
    missingTopics,
    nextUnresolvedTopic: typeof payload.next_unresolved_topic === "string" ? payload.next_unresolved_topic : null,
    dealOutcome: typeof payload.deal_outcome === "string" ? payload.deal_outcome : "not_ready",
    trainingStatus: typeof payload.training_success === "string" ? payload.training_success : "in_progress",
    topicProgress: { resolved: resolvedTopics.length, total: TOPICS.length },
    activeProduct
  };
}

function scenario(payload: RuntimePayload): SimulationScenarioSnapshot | null {
  const source = record(payload.scenario_context);
  if (!source) return null;
  return {
    id: typeof source.scenario_id === "string" ? source.scenario_id : "runtime-scenario",
    title: typeof source.scenario_product === "string" ? source.scenario_product : "Tình huống tư vấn sản phẩm",
    description: typeof source.scenario_need === "string" ? source.scenario_need : "Khám phá nhu cầu mua hàng.",
    difficulty: "MEDIUM"
  };
}

function signals(payload: RuntimePayload): string[] {
  return Array.from(new Set([
    ...strings(payload.buying_signals),
    ...strings(payload.closing_signals),
    ...strings(payload.objection_signals)
  ])).slice(0, 8);
}

function toResult(payload: RuntimePayload): OrchestrationResult {
  if (typeof payload.sessionId !== "string" || typeof payload.reply !== "string" || !payload.reply.trim()) {
    throw new Error("Runtime returned an invalid final response");
  }
  return {
    runtimeSessionId: payload.sessionId,
    finalCustomerReply: payload.reply,
    runtimeInsight: runtimeInsight(payload),
    scenario: scenario(payload),
    signals: signals(payload),
    shouldEndSession: payload.should_end_session === true
  };
}

export class CompatibilitySimulationOrchestrator implements SimulationOrchestrator {
  constructor(private readonly callbacks: CompatibilityOrchestratorCallbacks) {}

  async startCustomer(personaId: string): Promise<OrchestrationResult> {
    return toResult(await this.callbacks.startCustomer(personaId));
  }

  async handleSaleMessage(input: { runtimeSessionId: string; personaId: string; message: string }): Promise<OrchestrationResult> {
    const result = toResult(await this.callbacks.chat({
      sessionId: input.runtimeSessionId,
      personaId: input.personaId,
      message: input.message
    }));
    if (result.runtimeSessionId !== input.runtimeSessionId) throw new Error("Runtime session linkage mismatch");
    return result;
  }
}
