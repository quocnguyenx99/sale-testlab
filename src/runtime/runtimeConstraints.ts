export type RuntimeState =
  | "research_phase"
  | "pricing_phase"
  | "logistics_phase"
  | "payment_phase"
  | "operational_followup"
  | "passive_followup"
  | "uncertain_interest";

export interface RuntimeConstraintPack {
  allowedBehaviors: string[];
  forbiddenBehaviors: string[];
  forbiddenAssistantPhrases: string[];
  responseRules: string[];
  stateRules: Record<RuntimeState, string[]>;
  preferredCustomerPhrases: Record<RuntimeState, string[]>;
}

export const defaultRuntimeConstraints: RuntimeConstraintPack = {
  allowedBehaviors: [
    "pricing hesitation",
    "logistics followup",
    "product comparison",
    "operational coordination",
    "payment-related concerns"
  ],
  forbiddenBehaviors: [
    "emotional inference",
    "unsupported escalation",
    "invented customer history",
    "demographic assumptions",
    "fictional intent claims",
    "freeform personality storytelling"
  ],
  forbiddenAssistantPhrases: [
    "vui lòng cung cấp",
    "vui lòng cho tôi biết",
    "xin cung cấp",
    "cho tôi biết chi tiết",
    "tôi cần thêm thông tin từ bạn",
    "vui lòng xác nhận",
    "tôi hỗ trợ bạn",
    "tôi có thể hỗ trợ",
    "chị cần cho em biết"
  ],
  responseRules: [
    "Keep replies concise and operationally realistic.",
    "Stay inside runtime persona evidence and constraints.",
    "Do not claim facts not present in conversation context.",
    "Do not expose internal raw data or private identifiers.",
    "You are the buyer/customer side, never the support side."
  ],
  stateRules: {
    research_phase: [
      "Focus on model comparison and requirement clarity.",
      "Avoid hard commitment language.",
      "Do not switch to logistics/payment wording."
    ],
    pricing_phase: [
      "Focus on budget and price comparison requests.",
      "Ask for clearer quote/options before commitment.",
      "Do not switch to logistics-heavy response."
    ],
    logistics_phase: [
      "Focus on timeline, delivery, and document flow.",
      "Avoid pricing claims outside known context.",
      "Do not switch to payment confirmation unless explicitly asked."
    ],
    payment_phase: [
      "Focus on payment confirmation/check flow.",
      "Keep transactional wording and confirmation intent.",
      "Do not switch to product comparison."
    ],
    operational_followup: [
      "Focus on status updates and operational coordination.",
      "Keep short, actionable followups."
    ],
    passive_followup: [
      "Provide light acknowledgement and pending status.",
      "Avoid introducing new requirements unexpectedly."
    ],
    uncertain_interest: [
      "Use cautious interest wording.",
      "Ask clarifying question when context is incomplete.",
      "Use low-commitment language."
    ]
  },
  preferredCustomerPhrases: {
    pricing_phase: [
      "Giá này còn fix thêm được không em?",
      "Anh đang tham khảo thêm vài nơi.",
      "Bên kia đang báo thấp hơn chút."
    ],
    research_phase: [
      "Anh đang phân vân giữa mấy mẫu.",
      "Dòng này khác gì mẫu kia em?",
      "Cấu hình này dùng văn phòng ổn không?"
    ],
    logistics_phase: [
      "Khoảng mấy giờ giao được vậy em?",
      "Hàng có sẵn không em?",
      "Giao trong hôm nay được không?"
    ],
    payment_phase: [
      "Anh chuyển khoản rồi nha.",
      "Em check giúp anh nhé.",
      "Anh gửi lại bill nha."
    ],
    operational_followup: [
      "em cap nhat giup anh nhe",
      "anh doi thong tin moi"
    ],
    passive_followup: [
      "anh xem them da",
      "co gi cap nhat giup anh nhe"
    ],
    uncertain_interest: [
      "Anh đang xem thử thôi.",
      "Để anh tham khảo thêm.",
      "Anh chưa chốt vội."
    ]
  }
};

export function sanitizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function normalizeForDetect(input: string): string {
  return sanitizeText(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d");
}

export function detectBlockedBehaviors(text: string): string[] {
  const t = text.toLowerCase();
  const blocked: string[] = [];
  if (/(angry|sad|happy|emotional|hurt|betrayed|tổn thương|thất vọng cảm xúc)/i.test(t)) {
    blocked.push("emotional_inference");
  }
  if (/(always|never|every time|all history|lúc nào cũng|trước giờ bạn luôn)/i.test(t)) {
    blocked.push("invented_history");
  }
  if (/(young|old|male|female|rich|poor|demographic|giàu|nghèo|tuổi tác|giới tính)/i.test(t)) {
    blocked.push("demographic_assumption");
  }
  return blocked;
}

export function buildConstraintLines(
  runtimeState: RuntimeState,
  activeConstraints: string[]
): string[] {
  const lines = [
    ...defaultRuntimeConstraints.responseRules,
    ...defaultRuntimeConstraints.stateRules[runtimeState],
    ...activeConstraints
  ];
  return Array.from(new Set(lines));
}

export function detectAssistantStyle(text: string): string[] {
  const t = normalizeForDetect(text);
  const hits: string[] = [];
  for (const phrase of defaultRuntimeConstraints.forbiddenAssistantPhrases) {
    const p = normalizeForDetect(phrase);
    if (t.includes(p)) hits.push(phrase);
  }
  if (/(toi ho tro|chung toi cung cap|toi se tu van)/.test(t)) {
    hits.push("assistant_role_wording");
  }
  return Array.from(new Set(hits));
}
