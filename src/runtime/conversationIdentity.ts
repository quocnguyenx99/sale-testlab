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

export function buildIdentityProfileFromPersona(
  persona: IdentitySourcePersona,
  openingText?: string
): ConversationIdentityProfile {
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
    const fallback = buildIdentityProfileFromOpening(openingText || persona.display_name || persona.name || "");
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
  const disallowedRolePronouns = pronouns.filter((p) => p !== expectedSelf && p !== expectedTarget);

  const roleInversion = /\b(em can|em gui bao gia|em ho tro|de em tu van)\b/.test(t);
  if (roleInversion) forbidden.push("role_inversion");
  if (expectedSelf === "em" && /\b(anh|chi|toi|minh)\s+(dang|can|muon)\b/.test(t)) {
    forbidden.push("self_pronoun_drift");
  }
  if (expectedSelf === "anh" && /\b(em|chi|toi|minh)\s+(dang|can|muon)\b/.test(t)) {
    forbidden.push("self_pronoun_drift");
  }
  if (expectedSelf === "chị" && /\b(anh|em|toi|minh)\s+(dang|can|muon)\b/.test(t)) {
    forbidden.push("self_pronoun_drift");
  }

  const drift = forbidden.length > 0 || disallowedRolePronouns.length > 0;
  return {
    identity_drift_detected: drift,
    role_inversion_detected: roleInversion,
    forbidden_phrase_matches: Array.from(new Set([...forbidden, ...disallowedRolePronouns]))
  };
}
