import { ConversationIdentityProfile } from "../../runtime/conversationIdentity";
import { ConversationMemorySlots, createEmptyMemory, updateMemorySlots } from "../../runtime/conversationMemory";
import {
  ConversationProgress,
  createEmptyConversationProgress,
  ensureConversationProgress,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage
} from "../../runtime/conversationProgressTracker";
import { RuntimeState } from "../../runtime/runtimeConstraints";
import type { SimulationMessage } from "./simulationSession";

export interface SafeRuntimeMemorySnapshot {
  product_model_mentioned: boolean;
  configuration_discussed: boolean;
  price_discussed: boolean;
  stock_discussed: boolean;
  delivery_discussed: boolean;
  warranty_discussed: boolean;
  payment_discussed: boolean;
  invoice_or_document_discussed: boolean;
  next_step_discussed: boolean;
  selected_product_model: string | null;
  selected_product_model_code: string | null;
  product_context_status: "unknown" | "vague" | "specific";
  product_knowledge_used: boolean;
}

export interface RuntimeScenarioSnapshot {
  scenario_id: string;
  scenario_product: string;
  scenario_need: string;
  scenario_priority: string[];
}

export interface RuntimeRecoverySnapshot {
  version: 1;
  currentState: RuntimeState;
  memory: SafeRuntimeMemorySnapshot;
  conversationProgress: ConversationProgress;
  identityProfile: ConversationIdentityProfile;
  identitySource: string;
  personaSalutationStyle: string;
  recentFallbackVariantIds: string[];
  scenarioContext: RuntimeScenarioSnapshot | null;
}

export interface RecoveredRuntimeState {
  turns: Array<{ role: "sale" | "customer_ai"; text: string; state: RuntimeState }>;
  memorySlots: ConversationMemorySlots;
  conversationProgress: ConversationProgress;
}

export function toSafeRuntimeMemory(memory: ConversationMemorySlots): SafeRuntimeMemorySnapshot {
  return {
    product_model_mentioned: memory.product_model_mentioned,
    configuration_discussed: memory.configuration_discussed,
    price_discussed: memory.price_discussed,
    stock_discussed: memory.stock_discussed,
    delivery_discussed: memory.delivery_discussed,
    warranty_discussed: memory.warranty_discussed,
    payment_discussed: memory.payment_discussed,
    invoice_or_document_discussed: memory.invoice_or_document_discussed,
    next_step_discussed: memory.next_step_discussed,
    selected_product_model: memory.selected_product_model,
    selected_product_model_code: memory.selected_product_model_code,
    product_context_status: memory.product_context_status,
    product_knowledge_used: memory.product_knowledge_used
  };
}

export function rebuildRuntimeState(
  messages: SimulationMessage[],
  snapshot: RuntimeRecoverySnapshot
): RecoveredRuntimeState {
  let memorySlots = createEmptyMemory();
  let replayedProgress = createEmptyConversationProgress();

  for (const message of messages) {
    if (message.sender === "SALE") {
      memorySlots = updateMemorySlots(memorySlots, message.content);
      replayedProgress = updateProgressFromSaleMessage(replayedProgress, message.content);
    } else {
      replayedProgress = updateProgressFromCustomerMessage(replayedProgress, message.content);
    }
  }

  memorySlots = {
    ...memorySlots,
    ...snapshot.memory,
    // Catalog-derived candidates are deliberately rebuilt, never persisted.
    product_candidates_summary: memorySlots.product_candidates_summary
  };

  return {
    turns: messages.slice(-30).map((message) => ({
      role: message.sender === "SALE" ? "sale" : "customer_ai",
      text: message.content,
      state: snapshot.currentState
    })),
    memorySlots,
    // The snapshot preserves confirmation chronology that may not be reversible
    // from a guarded public transcript across future tracker versions.
    conversationProgress: ensureConversationProgress(snapshot.conversationProgress ?? replayedProgress)
  };
}
