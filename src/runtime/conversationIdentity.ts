export interface ConversationIdentityProfile {
  customer_self_pronoun: "anh" | "chị" | "em" | "mình" | "tôi";
  customer_target_pronoun: "em" | "anh" | "chị" | "bạn";
  sale_expected_self_pronoun: "em" | "anh" | "chị" | "bạn";
  sale_expected_target_pronoun: "anh" | "chị" | "em" | "bạn";
  tone_style: "business_casual" | "neutral";
  conversation_role: "customer_to_sales";
}

export interface IdentityDriftResult {
  identity_drift_detected: boolean;
  role_inversion_detected: boolean;
  forbidden_phrase_matches: string[];
}

export interface IdentitySourcePersona {
  salutation_style?: string;
  display_name?: string;
  name?: string;
}

const SUPPORT_PHRASES = [
  "vui lòng cung cấp",
  "tôi có thể hỗ trợ",
  "chị cần cho em biết",
  "tôi hỗ trợ bạn"
];

function normalize(input: string): string {
  return (input || "")
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSelfPronoun(text: string): ConversationIdentityProfile["customer_self_pronoun"] {
  const t = normalize(text);
  if (/\banh\s+(dang|can|muon|se|da)\b/.test(t)) return "anh";
  if (/\bchi\s+(dang|can|muon|se|da)\b/.test(t)) return "chị";
  if (/\bem\s+(dang|can|muon|se|da)\b/.test(t)) return "em";
  if (/\bminh\s+(dang|can|muon|se|da)\b/.test(t)) return "mình";
  if (/\btoi\s+(dang|can|muon|se|da)\b/.test(t)) return "tôi";
  if (/\banh\b/.test(t)) return "anh";
  if (/\bchi\b/.test(t)) return "chị";
  if (/\btoi\b/.test(t)) return "tôi";
  return "mình";
}

function detectTargetPronoun(text: string): ConversationIdentityProfile["customer_target_pronoun"] {
  const t = normalize(text);
  if (/\bem\b/.test(t)) return "em";
  if (/\banh\b/.test(t)) return "anh";
  if (/\bchi\b/.test(t)) return "chị";
  return "bạn";
}

function expectedSaleSelf(target: ConversationIdentityProfile["customer_target_pronoun"]): ConversationIdentityProfile["sale_expected_self_pronoun"] {
  if (target === "em") return "em";
  if (target === "anh") return "anh";
  if (target === "chị") return "chị";
  return "bạn";
}

function expectedSaleTarget(self: ConversationIdentityProfile["customer_self_pronoun"]): ConversationIdentityProfile["sale_expected_target_pronoun"] {
  if (self === "anh") return "anh";
  if (self === "chị") return "chị";
  if (self === "em") return "em";
  return "bạn";
}

function normalizeSalutationStyle(input?: string): string {
  return (input || "")
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/_/g, "-")
    .replace(/[đĐ]/g, "d");
}

function parseSalutationStyle(style?: string): {
  customer_self_pronoun?: ConversationIdentityProfile["customer_self_pronoun"];
  customer_target_pronoun?: ConversationIdentityProfile["customer_target_pronoun"];
} {
  const normalized = normalizeSalutationStyle(style);
  if (!normalized) return {};
  if (normalized.includes("anh-em")) return { customer_self_pronoun: "anh", customer_target_pronoun: "em" };
  if (normalized.includes("chi-em")) return { customer_self_pronoun: "chị", customer_target_pronoun: "em" };
  if (normalized.includes("em-anh")) return { customer_self_pronoun: "em", customer_target_pronoun: "anh" };
  if (normalized.includes("em-chi")) return { customer_self_pronoun: "em", customer_target_pronoun: "chị" };
  if (normalized.includes("anh")) return { customer_self_pronoun: "anh", customer_target_pronoun: "em" };
  if (normalized.includes("chi")) return { customer_self_pronoun: "chị", customer_target_pronoun: "em" };
  if (normalized.includes("em")) return { customer_self_pronoun: "em", customer_target_pronoun: "anh" };
  return {};
}

function inferFromDisplayName(name?: string): {
  customer_self_pronoun?: ConversationIdentityProfile["customer_self_pronoun"];
  customer_target_pronoun?: ConversationIdentityProfile["customer_target_pronoun"];
} {
  const t = normalize(name || "");
  if (/^\banh\b/.test(t)) return { customer_self_pronoun: "anh", customer_target_pronoun: "em" };
  if (/^\bchi\b/.test(t)) return { customer_self_pronoun: "chị", customer_target_pronoun: "em" };
  if (/^\bem\b/.test(t)) return { customer_self_pronoun: "em", customer_target_pronoun: "anh" };
  return {};
}

export function buildIdentityProfileFromSaleOpening(saleMessage: string): ConversationIdentityProfile {
  const t = normalize(saleMessage);
  let customerSelf: ConversationIdentityProfile["customer_self_pronoun"] = "mình";
  let customerTarget: ConversationIdentityProfile["customer_target_pronoun"] = "em";

  // 1. Direct patterns for greeting and sending files
  if (/\b(em\s+chao\s+chi|em\s+gui\s+chi|gui\s+chi|da\s+chi)\b/.test(t)) {
    customerSelf = "chị";
    customerTarget = "em";
  } else if (/\b(em\s+chao\s+anh|em\s+gui\s+anh|gui\s+anh|da\s+anh)\b/.test(t)) {
    customerSelf = "anh";
    customerTarget = "em";
  } else if (/\b(anh\s+chao\s+em|anh\s+gui\s+em|gui\s+em)\b/.test(t)) {
    customerSelf = "em";
    customerTarget = "anh";
  } else if (/\b(chi\s+chao\s+em|chi\s+gui\s+em|gui\s+em)\b/.test(t)) {
    customerSelf = "em";
    customerTarget = "chị";
  } else {
    // 2. General fallbacks
    // Check if Sale addresses customer as "chị"
    const hasChi = /\b(chi|chj|chi\s+oi|chao\s+chi|gui\s+chi|cho\s+chi|gui\s+cho\s+chi|da\s+chi)\b/.test(t);
    // Check if Sale addresses customer as "anh"
    const hasAnh = /\b(anh|anh\s+oi|chao\s+anh|gui\s+anh|cho\s+anh|gui\s+cho\s+anh|da\s+anh)\b/.test(t);
    // Check if Sale addresses customer as "em"
    const hasEm = /\b(em|em\s+oi|chao\s+em|gui\s+em|cho\s+em|da\s+em)\b/.test(t);

    // Check if Sale refers to self as "em"
    const saleSelfIsEm = /\b(em|ben\s+em|em\s+gui|em\s+chao)\b/.test(t);
    // Check if Sale refers to self as "anh"
    const saleSelfIsAnh = /\b(anh|ben\s+anh|anh\s+gui|anh\s+chao)\b/.test(t);
    // Check if Sale refers to self as "chị"
    const saleSelfIsChi = /\b(chi|ben\s+chi|chi\s+gui|chi\s+chao)\b/.test(t);

    if (hasChi) {
      customerSelf = "chị";
      customerTarget = "em";
    } else if (hasAnh) {
      customerSelf = "anh";
      customerTarget = "em";
    } else if (hasEm) {
      customerSelf = "em";
      if (saleSelfIsAnh) {
        customerTarget = "anh";
      } else if (saleSelfIsChi) {
        customerTarget = "chị";
      } else {
        customerTarget = "bạn";
      }
    }
  }

  return {
    customer_self_pronoun: customerSelf,
    customer_target_pronoun: customerTarget,
    sale_expected_self_pronoun: expectedSaleSelf(customerTarget),
    sale_expected_target_pronoun: expectedSaleTarget(customerSelf),
    tone_style: "business_casual",
    conversation_role: "customer_to_sales"
  };
}

export function buildIdentityProfileFromPersona(
  persona: IdentitySourcePersona,
  openingText?: string,
  isSaleOpening = false
): ConversationIdentityProfile {
  // If in sale-start mode and there is clear pronoun evidence, it overrides display_name.
  if (isSaleOpening && openingText) {
    const saleProfile = buildIdentityProfileFromSaleOpening(openingText);
    const self = saleProfile.customer_self_pronoun;
    if (self === "anh" || self === "chị" || self === "em") {
      return saleProfile;
    }
  }

  const fromStyle = parseSalutationStyle(persona.salutation_style);

  if (fromStyle.customer_self_pronoun && fromStyle.customer_target_pronoun) {
    return {
      customer_self_pronoun: fromStyle.customer_self_pronoun,
      customer_target_pronoun: fromStyle.customer_target_pronoun,
      sale_expected_self_pronoun: expectedSaleSelf(fromStyle.customer_target_pronoun),
      sale_expected_target_pronoun: expectedSaleTarget(fromStyle.customer_self_pronoun),
      tone_style: "business_casual",
      conversation_role: "customer_to_sales"
    };
  }

  const fromName = inferFromDisplayName(persona.display_name || persona.name);

  let customerSelf = fromName.customer_self_pronoun;
  let customerTarget = fromName.customer_target_pronoun;

  if (!customerSelf || !customerTarget) {
    const fallback = isSaleOpening && openingText
      ? buildIdentityProfileFromSaleOpening(openingText)
      : buildIdentityProfileFromOpening(openingText || persona.display_name || persona.name || "");
    customerSelf = customerSelf || fallback.customer_self_pronoun;
    customerTarget = customerTarget || fallback.customer_target_pronoun;
  }

  return {
    customer_self_pronoun: customerSelf || "mình",
    customer_target_pronoun: customerTarget || "em",
    sale_expected_self_pronoun: expectedSaleSelf(customerTarget || "em"),
    sale_expected_target_pronoun: expectedSaleTarget(customerSelf || "mình"),
    tone_style: "business_casual",
    conversation_role: "customer_to_sales"
  };
}

export function buildIdentityProfileFromOpening(openingText: string): ConversationIdentityProfile {
  const customerTarget = detectTargetPronoun(openingText);
  let customerSelf = detectSelfPronoun(openingText);
  if (customerSelf === "mình" && customerTarget === "em") customerSelf = "anh";

  return {
    customer_self_pronoun: customerSelf,
    customer_target_pronoun: customerTarget,
    sale_expected_self_pronoun: expectedSaleSelf(customerTarget),
    sale_expected_target_pronoun: expectedSaleTarget(customerSelf),
    tone_style: "business_casual",
    conversation_role: "customer_to_sales"
  };
}

export function buildIdentityPromptBlock(identity: ConversationIdentityProfile): string {
  return [
    "Identity lock:",
    `- Bạn là KHÁCH HÀNG, tự xưng là '${identity.customer_self_pronoun}'.`,
    `- Bạn gọi Sale là '${identity.customer_target_pronoun}'.`,
    "- KHÔNG đổi cách xưng hô giữa cuộc trò chuyện.",
    "- KHÔNG dùng giọng nhân viên hỗ trợ/sale."
  ].join("\n");
}

export function detectIdentityDrift(
  reply: string,
  identity: ConversationIdentityProfile
): IdentityDriftResult {
  const t = normalize(reply);
  const forbidden: string[] = [];

  for (const phrase of SUPPORT_PHRASES) {
    if (t.includes(normalize(phrase))) forbidden.push(phrase);
  }

  const pronouns = ["anh", "chi", "em", "toi", "minh", "ban"].filter((p) => new RegExp(`\\b${p}\\b`).test(t));
  const expectedSelf = normalize(identity.customer_self_pronoun);
  const expectedTarget = normalize(identity.customer_target_pronoun);
  // Allow 'mình' as a natural alternative self-pronoun
  const disallowedRolePronouns = pronouns.filter((p) => p !== expectedSelf && p !== expectedTarget && p !== "minh");

  const roleInversion = /\b(em can|em gui bao gia|em ho tro|de em tu van)\b/.test(t);
  if (roleInversion) forbidden.push("role_inversion");
  if (expectedSelf === "em" && /\b(anh|chi|toi)\s+(dang|can|muon)\b/.test(t)) {
    forbidden.push("self_pronoun_drift");
  }
  if (expectedSelf === "anh" && /\b(em|chi|toi)\s+(dang|can|muon)\b/.test(t)) {
    forbidden.push("self_pronoun_drift");
  }
  if (expectedSelf === "chị" && /\b(anh|em|toi)\s+(dang|can|muon)\b/.test(t)) {
    forbidden.push("self_pronoun_drift");
  }

  const drift = forbidden.length > 0 || disallowedRolePronouns.length > 0;
  return {
    identity_drift_detected: drift,
    role_inversion_detected: roleInversion,
    forbidden_phrase_matches: Array.from(new Set([...forbidden, ...disallowedRolePronouns]))
  };
}

export interface CustomerVoiceGuardResult {
  customer_voice_drift_detected: boolean;
  customer_voice_guard_reason: string | null;
}

export function runCustomerVoiceGuard(
  reply: string,
  identity: ConversationIdentityProfile
): CustomerVoiceGuardResult {
  const t = reply.normalize("NFC").trim();
  const tNorm = normalize(t);

  // 1. Chặn các cụm từ đặc trưng của hỗ trợ/sale
  const forbiddenPhrases = [
    "toi co the ho tro",
    "ben em ho tro",
    "em tu van cho anh",
    "em tu van cho chi",
    "mình hỗ trợ",
    "minh ho tro",
    "mình sẽ hỗ trợ",
    "minh se ho tro",
    "mình tư vấn",
    "minh tu van",
    "mình kiểm tra cho bạn",
    "minh kiem tra cho ban",
    "bên mình hỗ trợ",
    "ben minh ho tro"
  ];

  for (const phrase of forbiddenPhrases) {
    if (tNorm.includes(phrase)) {
      return {
        customer_voice_drift_detected: true,
        customer_voice_guard_reason: `support_phrase:${phrase}`
      };
    }
  }

  // 2. Chặn từ "ạ" từ phía khách xưng anh/chị khi nghe không tự nhiên (role reversal)
  const self = identity.customer_self_pronoun;
  const target = identity.customer_target_pronoun;

  if ((self === "anh" || self === "chị") && target === "em") {
    // Chỉ chặn từ "ạ" hoặc "a" ở cuối câu khi đi kèm giọng điệu hỗ trợ/bán hàng
    const hasAwkwardEnding = /\s+ạ\s*[?.!]*$/i.test(t);
    const hasSupportTone = /(ho\s*tro|tu\s*van|bao\s*gia|stk|check|kiem\s*tra|xac\s*nhan|gui\s+stk|gui\s+bill|don\s*hang)/i.test(tNorm);
    
    if (hasAwkwardEnding && hasSupportTone) {
      return {
        customer_voice_drift_detected: true,
        customer_voice_guard_reason: "awkward_ạ_ending"
      };
    }
  }

  return {
    customer_voice_drift_detected: false,
    customer_voice_guard_reason: null
  };
}

export function rewriteVoiceDrift(reply: string, identity: ConversationIdentityProfile): string {
  const self = identity.customer_self_pronoun;
  const selfCap = self.charAt(0).toUpperCase() + self.slice(1);
  const target = identity.customer_target_pronoun;

  // Xử lý viết lại mẫu câu lỗi: "(chị/anh) đang tìm ... ạ" -> "(Chị/Anh) đang tìm ... cho công việc, em tư vấn giúp chị vài mẫu phù hợp nhé."
  const match = reply.match(/^(chị|anh)\s+đang\s+tìm\s+([^]*?)\s+ạ\s*[?.!]*$/i);
  if (match) {
    const product = match[2].trim();
    return `${selfCap} đang tìm ${product} cho công việc, ${target} tư vấn giúp ${self} vài mẫu phù hợp nhé.`;
  }

  // Viết lại mẫu câu lỗi: "(chị/anh) muốn xem mẫu này ạ" -> "(Chị/Anh) muốn xem mẫu này, em gửi giúp cấu hình chi tiết nhé."
  const matchWant = reply.match(/^(chị|anh)\s+muốn\s+xem\s+([^]*?)\s+ạ\s*[?.!]*$/i);
  if (matchWant) {
    const model = matchWant[2].trim();
    return `${selfCap} muốn xem mẫu ${model}, ${target} gửi giúp ${self} cấu hình chi tiết nhé.`;
  }

  // Loại bỏ từ "ạ" hoặc "ạ?" ở cuối một cách an toàn và thay bằng "nhé", "nha", hoặc câu tự nhiên của khách
  let cleaned = reply.replace(/\s+ạ\s*([?.!]*)$/i, " nhé$1");
  if (cleaned !== reply) return cleaned;

  return reply;
}
