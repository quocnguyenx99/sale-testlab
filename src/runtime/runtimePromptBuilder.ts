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
    `- selected_product_model: ${memory.selected_product_model || "none"}`,
    `- selected_product_model_code: ${memory.selected_product_model_code || "none"}`,
    `- product_context_status: ${memory.product_context_status || "unknown"}`,
  ];
}

function toProgressLines(progress: ConversationProgress): string[] {
  return TOPIC_ORDER.map((topic) => {
    const p = getTopicProgress(progress, topic);
    return `- ${topic}: requested=${p.requested}, answered=${p.answered}, confirmed=${p.confirmed}`;
  });
}

function formatProductCandidatesBlock(memory: ConversationMemorySlots): string {
  if (!memory.product_candidates_summary || memory.product_candidates_summary.length === 0) {
    return "";
  }

  let block = "=== THÔNG TIN SẢN PHẨM KHẢ DỤNG ===\n";
  memory.product_candidates_summary.slice(0, 5).forEach((p, idx) => {
    const priceSiFormatted = p.price_si !== null ? `${p.price_si.toLocaleString("vi-VN")} VNĐ` : "Liên hệ";
    const priceLeFormatted = p.price_le !== null ? `${p.price_le.toLocaleString("vi-VN")} VNĐ` : "Liên hệ";
    const stockText = p.stock_status === "in_stock"
      ? `Còn hàng [INTERNAL_STOCK_REFERENCE_DO_NOT_MENTION: ${p.stock_qty}]`
      : `Hết hàng [INTERNAL_STOCK_REFERENCE_DO_NOT_MENTION: ${p.stock_qty}]`;

    block += `${idx + 1}. [Sản phẩm] ${p.display_name}\n`;
    block += `   - Mã sản phẩm: ${p.model_code}\n`;
    if (p.brand) {
      block += `   - Thương hiệu: ${p.brand}\n`;
    }
    block += `   - Giá sỉ/đại lý: ${priceSiFormatted}\n`;
    block += `   - Giá thị trường: ${priceLeFormatted}\n`;
    block += `   - Trạng thái kho: ${stockText}\n`;
  });
  block += "====================================";
  return block;
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

  const productContextBlock = formatProductCandidatesBlock(input.memorySlots);

  const lines = [
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
  ];

  const buyerVoiceCalibrationBlock = [
    "BUYER VOICE CALIBRATION:",
    "- Bạn là người mua thật, không phải CSKH, không phải sale, không phải trợ lý.",
    "- Nói ngắn, tự nhiên, đúng vai người mua; ưu tiên câu rõ ý hơn là quá lễ phép.",
    "- Không lặp nguyên văn câu của Sale nếu Sale vừa báo giá hay mô tả mẫu.",
    "- Hãy chuyển thông tin Sale vừa nói thành buyer confirmation hoặc buyer request.",
    "- Có thể dùng cách nói tự nhiên như 'Ok em', 'Ừ em', 'Em gửi anh/chị...' khi hợp ngữ cảnh.",
    "- Tránh lạm dụng 'Vâng', 'Dạ', 'ạ', 'nhé' ở hầu hết mọi lượt.",
    "- Phân biệt rõ: 'nhé' buyer-side có thể chấp nhận, nhưng 'chị nhé' hoặc 'anh nhé' theo kiểu Sale là không đúng vai.",
    "- Tuyệt đối không tự nhận vai Sale bằng các cụm như 'em báo giá', 'em hỗ trợ', 'bên em' khi đang nói như khách.",
    "- Ví dụ style chưa đúng: 'Vâng, em báo giá model HP Z2 Tower G9 đi ạ.'",
    "- Ví dụ style tốt hơn: 'Ok em, gửi anh giá model HP Z2 Tower G9 trước nhé.'",
    "- Ví dụ style chưa đúng: 'Vâng em, mẫu này giá sỉ 12 triệu chị nhé.'",
    "- Ví dụ style tốt hơn: 'Giá sỉ 12 triệu đúng không em? Chị cần xem thêm cấu hình cụ thể.'",
    ""
  ];

  if (productContextBlock) {
    lines.push(productContextBlock, "");
  }

  const status = input.memorySlots.product_context_status || "unknown";
  const gatingInstructions = [
    "QUY TẮC BỐI CẢNH SẢN PHẨM (CRITICAL):",
    `1. Trạng thái bối cảnh sản phẩm hiện tại: "${status}".`,
  ];

  if (status === "unknown") {
    gatingInstructions.push(
      "   - Bạn CHƯA chọn được sản phẩm hay model cụ thể nào.",
      "   - TUYỆT ĐỐI KHÔNG sử dụng cụm từ 'mẫu này', 'model này', 'mã này'.",
      "   - TUYỆT ĐỐI KHÔNG hỏi thanh toán, giữ hàng, chuyển khoản, STK hay chốt đơn.",
      "   - Hãy trao đổi tự nhiên về nhu cầu, ngân sách, mục đích sử dụng để Sale tư vấn/gợi ý mẫu phù hợp."
    );
  } else if (status === "vague") {
    gatingInstructions.push(
      "   - Bạn mới có cấu hình hoặc nhu cầu chung chung, chưa chọn model cụ thể.",
      "   - Có thể hỏi giá sỉ (price_si), hỏi cấu hình, hỏi bảo hành, hoặc yêu cầu so sánh 2-3 mẫu máy.",
      "   - TUYỆT ĐỐI KHÔNG hỏi thanh toán, chốt đơn, giữ hàng, gửi STK trừ khi Sale đã đề xuất một mẫu cụ thể rõ ràng và bạn đã chốt model đó."
    );
  } else if (status === "specific") {
    gatingInstructions.push(
      "   - Bạn ĐÃ XÁC ĐỊNH được model cụ thể.",
      "   - Có thể sử dụng cụm từ 'mẫu này', 'model này' để chỉ sản phẩm đang nói.",
      "   - Có thể chốt đơn, hỏi giữ hàng, hỏi thanh toán nếu các điều kiện deal khác đã đủ."
    );
  }

  gatingInstructions.push(
    "2. QUY TẮC SỐ LƯỢNG TỒN KHO:",
    "   - TUYỆT ĐỐI KHÔNG được tự ý nhắc đến con số tồn cụ thể (như '650 cái', '2 cái') trong câu trả lời trừ khi Sale đã chủ động nói ra con số đó trước.",
    "   - Thông tin số lượng trong tag INTERNAL_STOCK_REFERENCE_DO_NOT_MENTION chỉ dùng để bạn biết trong nội bộ.",
    "   - Chỉ được hỏi thăm tình trạng kho một cách tự nhiên (ví dụ: 'Mẫu này bên em còn sẵn hàng không?', 'Anh lấy vài cái bên em có đủ giao không?')."
  );

  gatingInstructions.push(
    "3. QUY TẮC LIỆT KÊ SẢN PHẨM KHẢ DỤNG (PRODUCT CANDIDATES):",
    "   - Các sản phẩm trong mục 'THÔNG TIN SẢN PHẨM KHẢ DỤNG' chỉ dùng để tham khảo bối cảnh.",
    "   - TUYỆT ĐỐI KHÔNG sao chép nguyên văn hoặc liệt kê một danh sách dài các mã sản phẩm/part number/cấu hình kỹ thuật từ danh sách khả dụng này vào câu trả lời.",
    "   - Chỉ nhắc tối đa 1-2 tên sản phẩm/dòng máy một cách cực kỳ tự nhiên khi cần thiết.",
    "   - Ưu tiên yêu cầu Sale tự chọn và gửi 2-3 phương án phù hợp kèm giá sỉ.",
    "   - TUYỆT ĐỐI KHÔNG tự liệt kê nhiều mã máy hay các biến thể CPU/RAM khác nhau trừ khi Sale đã chủ động giới thiệu hoặc hỏi so sánh chúng.",
    status === "vague"
      ? "   - Ví dụ hỏi tự nhiên khi chưa rõ model cụ thể: 'Em gửi anh 2-3 mẫu HP workstation phù hợp render 3D kèm giá sỉ để anh so sánh nhé.', KHÔNG ĐƯỢC viết: 'Anh đang xem model HP Z2 Tower G9 (4N3U8AV - I5) và HP Z2...'"
      : ""
  );

  gatingInstructions.push(
    "4. QUY TẮC TRẢ LỜI TRỰC TIẾP (DIRECT-ANSWER):",
    "   - Nếu Sale hỏi trực tiếp về cấu hình, dòng máy, model mong muốn, hoặc nhu cầu sử dụng (ví dụ: làm văn phòng hay đồ họa, render), bạn phải trả lời trực tiếp và rõ ràng thông tin nhu cầu hoặc dòng máy dựa theo Persona (ví dụ: 'chị cần máy văn phòng làm excel mượt', 'anh cần máy render 3D tầm trung'), sau đó yêu cầu báo giá sỉ tương ứng, tuyệt đối không hỏi vòng vo hay lặp lại câu hỏi.",
    "",
    "5. QUY TẮC XỬ LÝ MƠ HỒ 'MẪU NÀY':",
    `   - Nếu Sale dùng từ 'mẫu này', 'mã này', 'máy này' nhưng hiện tại bạn chưa chốt model cụ thể nào (selected_product_model hiện tại là "${input.memorySlots.selected_product_model || "none"}"), hãy chủ động yêu cầu Sale làm rõ model_code, tên máy hiển thị, cấu hình chi tiết hoặc cung cấp giá sỉ cụ thể của mẫu đó để bạn có cơ sở xem xét.`,
    "",
    "6. QUY TẮC THỨ TỰ LOGISTICS (DELIVERY GATE):",
    "   - Khi sản phẩm, cấu hình hoặc giá sỉ chưa được chốt rõ ràng, ưu tiên hàng đầu của bạn phải là làm rõ sản phẩm/cấu hình/giá sỉ. Bạn có thể hỏi thêm về phương thức giao hàng như một chi tiết phụ kèm theo trong câu hỏi, nhưng không bao giờ được coi giao hàng là chủ đề chính hoặc câu hỏi duy nhất tại lượt này.",
    "",
    "7. QUY TẮC HỨA HẸN BÁO GIÁ (PROMISED QUOTE):",
    "   - Nếu Sale hứa hẹn check kho hoặc báo giá sau (ví dụ: 'để em báo giá', 'để em check kho rồi báo lại', 'chờ em chút em gửi cấu hình'), hãy phản hồi đồng ý chờ đợi một cách tự nhiên (ví dụ: 'vâng em check đi', 'ok em xem rồi báo lại nhé'), tuyệt đối không hỏi dồn dập 'giá bao nhiêu' hay giục giã ngay lập tức."
  );

  lines.push(
    buyerVoiceCalibrationBlock.join("\n"),
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
    gatingInstructions.join("\n"),
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
  );

  return lines.join("\n");
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
