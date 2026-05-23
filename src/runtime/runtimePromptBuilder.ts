import {
  RuntimeState,
  buildConstraintLines,
  defaultRuntimeConstraints,
  sanitizeText,
} from "./runtimeConstraints";
import { ConversationMemorySlots } from "./conversationMemory";
import {
  ConversationProgress,
  ConversationTopic,
  getFirstUnresolvedTopic,
  getTopicProgress,
  TOPIC_ORDER,
} from "./conversationProgressTracker";
import {
  ConversationIdentityProfile,
  buildIdentityPromptBlock,
} from "./conversationIdentity";
import { buildProgressionInstruction } from "./repetitionGuard";
import { ProductScenario } from "./productScenarioCatalog";

export interface RuntimePersonaForPrompt {
  runtime_persona_id: string;
  runtime_readiness: "approved" | "limited" | "archive_only";
  runtime_behavior_profile: {
    research_behavior: string[];
    pricing_behavior: string[];
    payment_behavior: string[];
    logistics_behavior: string[];
    communication_behavior: string[];
  };
  interaction_patterns: Array<{
    pattern_name: string;
    priority: "low" | "medium" | "high";
    stability: "weak" | "moderate" | "strong";
    runtime_weight: number;
  }>;
  conversation_constraints: string[];
  risk_flags: string[];
}

export interface RuntimeConversationContext {
  topic: string;
  recent_messages: string[];
  current_phase: RuntimeState;
  risk_flags: string[];
}

export interface RuntimePromptBundle {
  system: string;
  persona: string;
  sessionContext: string;
  outputRules: string;
  fullPrompt: string;
}

export interface EnrichedPromptPersona {
  role_prompt: string;
  behavior_rules: string[];
  product_interest_categories: string[];
  purchase_context: string;
  closing_conditions: string[];
  do_not_do: string[];
}

export interface EnrichedPromptInput {
  persona: EnrichedPromptPersona;
  runtimeState: RuntimeState;
  recentMessages: string[];
  scenarioContext?: ProductScenario;
  memorySlots: ConversationMemorySlots;
  progress: ConversationProgress;
  identity: ConversationIdentityProfile;
}

function toMemoryLines(memory: ConversationMemorySlots): string[] {
  return [
    `- product_model_mentioned: ${memory.product_model_mentioned}`,
    `- configuration_discussed: ${memory.configuration_discussed}`,
    `- price_discussed: ${memory.price_discussed}`,
    `- stock_discussed: ${memory.stock_discussed}`,
    `- delivery_discussed: ${memory.delivery_discussed}`,
    `- warranty_discussed: ${memory.warranty_discussed}`,
    `- payment_discussed: ${memory.payment_discussed}`,
    `- invoice_or_document_discussed: ${memory.invoice_or_document_discussed}`,
    `- next_step_discussed: ${memory.next_step_discussed}`,
  ];
}

function toProgressLines(progress: ConversationProgress): string[] {
  return TOPIC_ORDER.map((topic) => {
    const p = getTopicProgress(progress, topic);
    return `- ${topic}: requested=${p.requested}, answered=${p.answered}, confirmed=${p.confirmed}`;
  });
}

export function buildEnrichedRuntimePrompt(input: EnrichedPromptInput): string {
  const behaviorBlock = input.persona.behavior_rules
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${sanitizeText(r)}`)
    .join("\n");
  const closingBlock = input.persona.closing_conditions
    .slice(0, 3)
    .map(sanitizeText)
    .join("; ");
  const productsBlock = input.persona.product_interest_categories
    .map(sanitizeText)
    .join(", ");
  const doNotBlock = input.persona.do_not_do
    .slice(0, 3)
    .map(sanitizeText)
    .join(" ");

  const scenarioLines = input.scenarioContext
    ? [
        `Scenario product: ${sanitizeText(input.scenarioContext.scenario_product)}`,
        `Scenario need: ${sanitizeText(input.scenarioContext.scenario_need)}`,
        `Scenario priority: ${input.scenarioContext.scenario_priority.map(sanitizeText).join(", ")}`,
      ]
    : ["Scenario product: none"];

  const memoryLines = toMemoryLines(input.memorySlots);
  const progressLines = toProgressLines(input.progress);
  const identityBlock = buildIdentityPromptBlock(input.identity);
  const progressionBlock = buildProgressionInstruction(input.progress);
  const nextTopic = getFirstUnresolvedTopic(input.progress);
  const history = input.recentMessages.slice(-10).map(sanitizeText).join("\n");

  return [
    input.persona.role_prompt,
    "",
    "Quy tắc hành vi:",
    behaviorBlock || "1. Giữ giọng điệu người mua tự nhiên.",
    "",
    identityBlock,
    "",
    `Sản phẩm quan tâm: ${productsBlock || "chưa rõ"}`,
    `Bối cảnh mua: ${sanitizeText(input.persona.purchase_context || "chưa rõ")}`,
    `Khép hội thoại khi: ${closingBlock || "đã có đủ thông tin để quyết định"}`,
    `Không được: ${doNotBlock || "không dùng văn phong trợ lý"}`,
    "",
    ...scenarioLines,
    "",
    "memory_slots:",
    ...memoryLines,
    "",
    "conversation_progress:",
    ...progressLines,
    `- next_unresolved_topic: ${nextTopic ?? "none"}`,
    "",
    progressionBlock,
    "",
    "Ghi nhớ quy tắc hội thoại tự nhiên:",
    "- KHÔNG ĐƯỢC hỏi lại những thông tin đã được Sale cung cấp và ghi trong memory_slots (ví dụ: nếu giá hoặc cấu hình đã có, cấm hỏi lại giá/cấu hình).",
    "- Lắng nghe, ghi nhận và phản hồi tự nhiên trước. Tránh tạo cảm giác bạn đang phỏng vấn hay điền checklist. Hãy chuyển ý mượt mà bằng cách liên kết câu trả lời của Sale với câu hỏi tiếp theo của bạn.",
    "",
    `Runtime state: ${input.runtimeState}`,
    "",
    "Lịch sử hội thoại:",
    history || "- none",
    "",
    "Khach AI:",
  ].join("\n");
}

export function buildRuntimePrompt(
  persona: RuntimePersonaForPrompt,
  runtimeState: RuntimeState,
  activeConstraints: string[],
  context: RuntimeConversationContext,
): RuntimePromptBundle {
  const topPatterns = persona.interaction_patterns
    .slice()
    .sort((a, b) => b.runtime_weight - a.runtime_weight)
    .slice(0, 5)
    .map(
      (p) =>
        `${p.pattern_name} [${p.priority}/${p.stability}/${p.runtime_weight}]`,
    )
    .join("; ");

  const constraintLines = buildConstraintLines(runtimeState, [
    ...persona.conversation_constraints,
    ...activeConstraints,
  ]).join("\n- ");

  const system = [
    "You are a runtime-safe customer simulator.",
    "You must speak as CUSTOMER/BUYER only.",
    "The user is always SALE.",
    "Reply naturally in Vietnamese with proper accents.",
    "Never speak as support agent, operator, helpdesk, or assistant.",
    "Follow only behavioral evidence and operational realism.",
    "Never invent customer history, emotion, demographics, or motives.",
    "Prefer natural, concise wording with mild phrasing variation.",
    "Avoid repetitive sentence templates across similar turns.",
    `Allowed behaviors: ${defaultRuntimeConstraints.allowedBehaviors.join(", ")}`,
    `Forbidden behaviors: ${defaultRuntimeConstraints.forbiddenBehaviors.join(", ")}`,
    `Forbidden assistant phrases: ${defaultRuntimeConstraints.forbiddenAssistantPhrases.join("; ")}`,
  ].join("\n");

  const personaSection = [
    `Runtime Persona ID: ${persona.runtime_persona_id}`,
    `Readiness: ${persona.runtime_readiness}`,
    `Behavior Profile: ${JSON.stringify(persona.runtime_behavior_profile)}`,
    `Top Interaction Patterns: ${topPatterns}`,
    `Persona Risk Flags: ${persona.risk_flags.join(", ") || "none"}`,
  ].join("\n");

  const recent = context.recent_messages
    .map((m) => `- ${sanitizeText(m)}`)
    .join("\n");
  const contextSection = [
    `Topic: ${sanitizeText(context.topic)}`,
    `Runtime State: ${runtimeState}`,
    `Current Phase: ${context.current_phase}`,
    `Session Risk Flags: ${context.risk_flags.join(", ") || "none"}`,
    "Recent Messages:",
    recent || "- none",
  ].join("\n");

  const outputRules = [
    "Return one concise customer reply.",
    "Reply as a buyer/customer, not as advisor/support.",
    "Do not use emotional storytelling.",
    "Do not claim memory outside provided context.",
    "Use a realistic customer tone without personality roleplay.",
    "Vary phrasing safely while preserving the same intent.",
    "Use buyer-side phrasing, not support-side phrasing.",
    "If uncertain, ask concise clarification.",
    `Preferred customer phrasing examples for ${runtimeState}: ${defaultRuntimeConstraints.preferredCustomerPhrases[runtimeState].join(" | ")}`,
    "Honor constraints:",
    `- ${constraintLines}`,
  ].join("\n");

  const fullPrompt = [
    "[SYSTEM]",
    system,
    "",
    "[RUNTIME PERSONA]",
    personaSection,
    "",
    "[SESSION CONTEXT]",
    contextSection,
    "",
    "[OUTPUT RULES]",
    outputRules,
  ].join("\n");

  return {
    system,
    persona: personaSection,
    sessionContext: contextSection,
    outputRules,
    fullPrompt,
  };
}
