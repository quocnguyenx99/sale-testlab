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
  is_recoverable?: boolean;
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

const SELF_REFERENCE_VERBS = ["dang", "can", "muon", "se", "da", "hoi", "xem", "lay"];
const SELF_REFERENCE_VERB_PATTERN = SELF_REFERENCE_VERBS.join("|");
const RAW_SELF_REFERENCE_VERB_PATTERN = "đang|dang|cần|can|muốn|muon|sẽ|se|đã|da|hỏi|hoi|xem|lấy|lay";

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

function sanitizeVietnamesePronounText(t: string): string {
  return t
    // "chi" compound words / usages
    .replace(/\bchi\s+tiet\b/g, "chi_tiet")
    .replace(/\bchi\s+phi\b/g, "chi_phi")
    .replace(/\bchi\s+nhanh\b/g, "chi_nhanh")
    .replace(/\bchi\s+tieu\b/g, "chi_tieu")
    .replace(/\bdia\s+chi\b/g, "dia_chi")
    .replace(/\btham\s+chi\b/g, "tham_chi")
    .replace(/\bdu\s+chi\b/g, "du_chi")
    .replace(/\bthu\s+chi\b/g, "thu_chi")
    .replace(/\bchi\s+co\b/g, "chi_co")
    .replace(/\bchi\s+con\b/g, "chi_con")
    .replace(/\bchi\s+can\b/g, "chi_can")
    .replace(/\bchi\s+muon\b/g, "chi_muon")
    .replace(/\bchi\s+lay\b/g, "chi_lay")
    .replace(/\bchi\s+giao\b/g, "chi_giao")
    .replace(/\bchi\s+duoc\b/g, "chi_duoc")
    .replace(/\bchi\s+khoang\b/g, "chi_khoang")
    .replace(/\bchi\s+tam\b/g, "chi_tam")
    .replace(/\bchi\s+tu\b/g, "chi_tu")
    .replace(/\bchi\s+dung\b/g, "chi_dung")
    .replace(/\bchi\s+thoi\b/g, "chi_thoi")
    .replace(/\bchi\s+de\b/g, "chi_de")
    .replace(/\bchi\s+la\b/g, "chi_la")
    .replace(/\bchi\s+thinh\b/g, "chi_thinh")
    .replace(/\bchi\s+(ban|mua|gui|check|hoi|xem|nhan|tra|lam|biet|dung|gia|phai)\b/g, "chi_$1")
    // "anh" compound words / names
    .replace(/\btieng\s+anh\b/g, "tieng_anh")
    .replace(/\bhinh\s+anh\b/g, "hinh_anh")
    .replace(/\bphan\s+anh\b/g, "phan_anh")
    .replace(/\bchup\s+anh\b/g, "chup_anh")
    .replace(/\bbuc\s+anh\b/g, "buc_anh")
    .replace(/\balbum\s+anh\b/g, "album_anh")
    .replace(/\bfile\s+anh\b/g, "file_anh")
    .replace(/\banh\s+sang\b/g, "anh_sang")
    .replace(/\banh\s+duong\b/g, "anh_duong")
    .replace(/\banh\s+kim\b/g, "anh_kim")
    .replace(/\banh\s+sao\b/g, "anh_sao")
    .replace(/\banh\s+hoa\b/g, "anh_hoa")
    .replace(/\b(lan|quynh|tuan|viet|tram|duc|ngoc|duy|hoang|the|quoc|trung|minh|kieu|phuong|mai|ha|tu|van)\s+anh\b/g, "$1_anh")
    // "em" compound words
    .replace(/\btre\s+em\b/g, "tre_em")
    // "minh" compound words / names
    .replace(/\bthong\s+minh\b/g, "thong_minh")
    .replace(/\bchung\s+minh\b/g, "chung_minh")
    .replace(/\bbinh\s+minh\b/g, "binh_minh")
    .replace(/\bcong\s+minh\b/g, "cong_minh")
    .replace(/\bminh\s+chung\b/g, "minh_chung")
    .replace(/\bminh\s+hoa\b/g, "minh_hoa")
    .replace(/\bminh\s+bach\b/g, "minh_bach")
    .replace(/\bthuyet\s+minh\b/g, "thuyet_minh")
    .replace(/\b(hoang|duc|hai|quang|tuan|khanh|gia|nhat|binh|cong)\s+minh\b/g, "$1_minh")
    // "ban" compound words
    .replace(/\bban\s+bac\b/g, "ban_bac")
    .replace(/\bban\s+luan\b/g, "ban_luan")
    .replace(/\bban\s+ve\b/g, "ban_ve")
    .replace(/\bvan\s+ban\b/g, "van_ban")
    .replace(/\bban\s+giao\b/g, "ban_giao")
    .replace(/\bban\s+ui\b/g, "ban_ui")
    .replace(/\bban\s+phim\b/g, "ban_phim")
    .replace(/\bban\s+ghe\b/g, "ban_ghe")
    .replace(/\bphien\s+ban\b/g, "phien_ban")
    .replace(/\bco\s+ban\b/g, "co_ban")
    .replace(/\bban\s+tin\b/g, "ban_tin")
    .replace(/\bban\s+do\b/g, "ban_do")
    .replace(/\bban\s+nhap\b/g, "ban_nhap")
    .replace(/\bban\s+quyen\b/g, "ban_quyen")
    .replace(/\bban\s+phu\b/g, "ban_phu")
    .replace(/\bban\s+goc\b/g, "ban_goc")
    .replace(/\bchua\s+ban\b/g, "chua_ban")
    .replace(/\bgia\s+ban\b/g, "gia_ban")
    .replace(/\bnguoi\s+ban\b/g, "nguoi_ban")
    .replace(/\bbuon\s+ban\b/g, "buon_ban")
    .replace(/\brao\s+ban\b/g, "rao_ban")
    .replace(/\bmua\s+ban\b/g, "mua_ban")
    .replace(/\bban\s+le\b/g, "ban_le")
    .replace(/\bban\s+si\b/g, "ban_si")
    .replace(/\bban\s+hang\b/g, "ban_hang")
    .replace(/\bban\s+chay\b/g, "ban_chay")
    .replace(/\bban\s+duoc\b/g, "ban_duoc")
    // "toi" compound words
    .replace(/\bbong\s+toi\b/g, "bong_toi")
    .replace(/\btam\s+toi\b/g, "tam_toi")
    .replace(/\btoi\s+tam\b/g, "toi_tam")
    .replace(/\btoi\s+gian\b/g, "toi_gian")
    .replace(/\btoi\s+da\b/g, "toi_da")
    .replace(/\btoi\s+thieu\b/g, "toi_thieu")
    .replace(/\btoi\s+uu\b/g, "toi_uu")
    .replace(/\btoi\s+nay\b/g, "toi_nay")
    .replace(/\bbuoi\s+toi\b/g, "buoi_toi")
    .replace(/\bden\s+toi\b/g, "den_toi")
    .replace(/\btoi\s+mat\b/g, "toi_mat")
    .replace(/\btoi\s+cao\b/g, "toi_cao")
    .replace(/\btoi\s+mat\b/g, "toi_mat")
    .replace(/\btoi\s+pham\b/g, "toi_pham")
    .replace(/\btoi\s+loi\b/g, "toi_loi")
    .replace(/\bpham\s+toi\b/g, "pham_toi")
    .replace(/\bket\s+toi\b/g, "ket_toi")
    .replace(/\btoi\s+tinh\b/g, "toi_tinh");
}

function detectSelfPronoun(text: string): ConversationIdentityProfile["customer_self_pronoun"] {
  const t = sanitizeVietnamesePronounText(normalize(text));
  if (new RegExp(`\\banh\\s+(${SELF_REFERENCE_VERB_PATTERN})\\b`).test(t)) return "anh";
  if (new RegExp(`\\bchi\\s+(${SELF_REFERENCE_VERB_PATTERN})\\b`).test(t)) return "\u0063\u0068\u1ecb";
  if (new RegExp(`\\bem\\s+(${SELF_REFERENCE_VERB_PATTERN})\\b`).test(t)) return "em";
  if (new RegExp(`\\bminh\\s+(${SELF_REFERENCE_VERB_PATTERN})\\b`).test(t)) return "\u006d\u00ec\u006e\u0068";
  if (new RegExp(`\\btoi\\s+(${SELF_REFERENCE_VERB_PATTERN})\\b`).test(t)) return "\u0074\u00f4\u0069";
  if (/\banh\b/.test(t)) return "anh";
  if (/\bchi\b/.test(t)) return "chị";
  if (/\btoi\b/.test(t)) return "tôi";
  return "mình";
}

function detectTargetPronoun(text: string): ConversationIdentityProfile["customer_target_pronoun"] {
  const t = sanitizeVietnamesePronounText(normalize(text));
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
  const t = sanitizeVietnamesePronounText(normalize(saleMessage));
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
  const t = sanitizeVietnamesePronounText(normalize(reply));
  const forbidden: string[] = [];

  for (const phrase of SUPPORT_PHRASES) {
    if (t.includes(normalize(phrase))) forbidden.push(phrase);
  }

  const pronouns = ["anh", "chi", "em", "toi", "minh", "ban"].filter((p) => new RegExp(`\\b${p}\\b`).test(t));
  const expectedSelf = normalize(identity.customer_self_pronoun);
  const expectedTarget = normalize(identity.customer_target_pronoun);
  // Allow 'mình' as a natural alternative self-pronoun
  const disallowedRolePronouns = pronouns.filter((p) => p !== expectedSelf && p !== expectedTarget && p !== "minh");
  const selfReferenceRegex = (pronounsToBlock: string[]) =>
    new RegExp(`\\b(${pronounsToBlock.join("|")})\\s+(${SELF_REFERENCE_VERB_PATTERN})\\b`);

  const roleInversion = /\b(em can|em gui bao gia|em ho tro|de em tu van)\b/.test(t);
  if (roleInversion) forbidden.push("role_inversion");
  if (expectedSelf === "em" && selfReferenceRegex(["anh", "chi", "toi"]).test(t)) {
    forbidden.push("self_pronoun_drift");
  }
  if (expectedSelf === "anh" && selfReferenceRegex(["em", "chi", "toi"]).test(t)) {
    forbidden.push("self_pronoun_drift");
  }
  if (expectedSelf === "chi" && selfReferenceRegex(["anh", "em", "toi"]).test(t)) {
    forbidden.push("self_pronoun_drift");
  }

  const drift = forbidden.length > 0 || disallowedRolePronouns.length > 0;
  
  let is_recoverable = false;
  if (drift) {
    const hasRoleInversion = forbidden.includes("role_inversion");
    const hasSupportPhrases = forbidden.some(f => SUPPORT_PHRASES.map(normalize).includes(normalize(f)));
    if (!hasRoleInversion && !hasSupportPhrases) {
      is_recoverable = true;
    }
  }

  return {
    identity_drift_detected: drift,
    role_inversion_detected: roleInversion,
    forbidden_phrase_matches: Array.from(new Set([...forbidden, ...disallowedRolePronouns])),
    is_recoverable
  };
}

export function repairPronounDrift(
  reply: string,
  identity: ConversationIdentityProfile
): string {
  const expectedSelf = identity.customer_self_pronoun;
  const expectedSelfNormalized = normalize(expectedSelf);
  const wrongSelfReferenceCandidates =
    expectedSelfNormalized === "chi"
      ? ["anh", "em", "toi"]
      : expectedSelfNormalized === "anh"
        ? ["chi", "em", "toi"]
        : expectedSelfNormalized === "em"
          ? ["anh", "chi", "toi"]
          : [];

  let replyAfterSelfRepair = reply;
  if (wrongSelfReferenceCandidates.length > 0) {
    const wrongSelfReferenceRegex = new RegExp(
      `(^|[\\s,.:;?!\\-])((${wrongSelfReferenceCandidates.join("|")})\\s+(${RAW_SELF_REFERENCE_VERB_PATTERN}))(?=$|[\\s,.:;?!\\-])`,
      "gi"
    );
    replyAfterSelfRepair = replyAfterSelfRepair.replace(wrongSelfReferenceRegex, (match, prefix, phrase) => {
      const firstWord = phrase.split(/\s+/)[0] || "";
      const replacedSelf =
        firstWord === firstWord.toUpperCase()
          ? expectedSelf.toUpperCase()
          : firstWord.charAt(0) === firstWord.charAt(0).toUpperCase()
            ? expectedSelf.charAt(0).toUpperCase() + expectedSelf.slice(1)
            : expectedSelfNormalized;
      return `${prefix}${phrase.replace(new RegExp(`^${firstWord}`, "i"), replacedSelf)}`;
    });
  }

  let wrongSelf: string | null = null;
  if (expectedSelf === "chị") wrongSelf = "anh";
  else if (expectedSelf === "anh") wrongSelf = "chị";

  if (!wrongSelf) return replyAfterSelfRepair;

  const compPhrases = [
    "tiếng anh", "tieng anh", "hình ảnh", "hinh anh", "phản ánh", "phan anh",
    "chụp ảnh", "chup anh", "bức ảnh", "buc anh", "album ảnh", "album anh",
    "file ảnh", "file anh", "ánh sáng", "anh sang", "ánh dương", "anh duong",
    "ánh kim", "anh kim", "ánh sao", "anh sao", "ánh hoa", "anh hoa",
    "tuấn anh", "tuan anh", "việt anh", "viet anh", "trâm anh", "tram anh",
    "đức anh", "duc anh", "ngọc anh", "ngoc anh", "duy anh", "duy anh",
    "hoàng anh", "hoang anh", "thế anh", "the anh", "quốc anh", "quoc anh",
    "trung anh", "trung anh", "minh anh", "minh anh", "kiều anh", "kieu anh",
    "phương anh", "phuong anh", "mai anh", "mai anh", "hà anh", "ha anh",
    "tú anh", "tu anh", "vân anh", "van anh",
    "chi tiết", "chi tiet", "chi phí", "chi phi", "chi nhánh", "chi nhanh",
    "chi tiêu", "chi tieu", "địa chỉ", "dia chi", "thậm chí", "tham chi",
    "du chi", "du chi", "thu chi", "thu chi", "chỉ có", "chi co",
    "chỉ còn", "chi con", "chỉ cần", "chi can", "chỉ muốn", "chi muon",
    "chỉ lấy", "chi lay", "chỉ giao", "chi giao", "chỉ được", "chi duoc",
    "chỉ chuyển", "chi chuyen", "chỉ khoảng", "chi khoang", "chỉ tầm", "chi tam",
    "chỉ tự", "chi tu", "chỉ dùng", "chi dung", "chỉ thôi", "chi thoi",
    "chỉ để", "chi de", "chỉ là", "chi la"
  ];

  let tempText = replyAfterSelfRepair;
  const placeholders: { placeholder: string; original: string }[] = [];
  let phCounter = 0;

  const sortedCompPhrases = [...compPhrases].sort((a, b) => b.length - a.length);

  for (const phrase of sortedCompPhrases) {
    const escaped = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?<=^|[\\s,.:;?!\\-])(${escaped})(?=$|[\\s,.:;?!\\-])`, 'gi');
    tempText = tempText.replace(regex, (match) => {
      const ph = `__COMP_PH_${phCounter++}__`;
      placeholders.push({ placeholder: ph, original: match });
      return ph;
    });
  }

  const wrongRegex = new RegExp(`(?<=^|[\\s,.:;?!\\-])(${wrongSelf})(?=$|[\\s,.:;?!\\-])`, 'gi');
  tempText = tempText.replace(wrongRegex, (match) => {
    if (match === match.toUpperCase()) {
      return expectedSelf.toUpperCase();
    }
    if (match.charAt(0) === match.charAt(0).toUpperCase()) {
      return expectedSelf.charAt(0).toUpperCase() + expectedSelf.slice(1);
    }
    return expectedSelf.toLowerCase();
  });

  for (let i = placeholders.length - 1; i >= 0; i--) {
    const { placeholder, original } = placeholders[i];
    tempText = tempText.replace(placeholder, original);
  }

  return tempText;
}

export interface CustomerVoiceGuardResult {
  customer_voice_drift_detected: boolean;
  customer_voice_guard_reason: string | null;
}

export interface BuyerVoiceStyleMetrics {
  buyer_voice_score: number;
  sale_tone_risk: "low" | "medium" | "high";
  over_polite_marker_count: number;
  sale_echo_marker_count: number;
  support_phrase_count: number;
  buyer_request_marker_count: number;
}

function countMatches(input: string, regex: RegExp): number {
  const matches = input.match(regex);
  return matches ? matches.length : 0;
}

function countSupportPhraseMatches(input: string): number {
  const supportLikePatterns = [
    /\btoi co the ho tro\b/g,
    /\bem bao gia\b/g,
    /\bem ho tro\b/g,
    /\bem tu van\b/g,
    /\bem gui stk\b/g,
    /\bben em (?:dang co san|co san|ho tro)\b/g,
    /\bminh ho tro\b/g,
    /\bminh tu van\b/g
  ];
  return supportLikePatterns.reduce((acc, pattern) => acc + countMatches(input, pattern), 0);
}

function countSaleEchoMarkers(replyNorm: string, saleNorm: string): number {
  if (!saleNorm) return 0;

  let count = 0;
  if (replyNorm.includes(saleNorm) && saleNorm.split(/\s+/).length >= 4) {
    count += 2;
  }
  if (/\b(mau nay|model nay)\b/.test(saleNorm) && /\b(mau nay|model nay)\b/.test(replyNorm)) {
    count += 1;
  }
  if (/\bchi nhe\b|\banh nhe\b/.test(saleNorm) && /\bchi nhe\b|\banh nhe\b/.test(replyNorm)) {
    count += 2;
  }
  if (/\bben em con \d+\s+(cai|chiec|may|bo)\b/.test(saleNorm) && /\bben em con \d+\s+(cai|chiec|may|bo)\b/.test(replyNorm)) {
    count += 1;
  }
  return count;
}

function countBuyerRequestMarkers(input: string): number {
  const buyerRequestPatterns = [
    /\b(ok|uh|um)\s+em\b/g,
    /\b(em gui|gui)\s+(anh|chi)\b/g,
    /\b(em co|co)\s+mau nao\b/g,
    /\bben em\s+con hang\s+khong\b/g,
    /\b(em gui|gui)\s+(anh|chi)\s+\d+\s*-\s*\d+\s+mau\b/g,
    /\b(em gui|gui)\s+(anh|chi)\s+vai\s+(mau|cai)\b/g,
    /\b(anh|chi)\s+(can|muon|dang can|dang xem|doi)\b/g,
    /\bgia\s+(si\s+)?[0-9.,a-z]*\s*dung khong\b/g
  ];
  return buyerRequestPatterns.reduce((acc, pattern) => acc + countMatches(input, pattern), 0);
}

function countSaleStyleEndings(input: string): number {
  const strongSaleAssertionPatterns = [
    /\b(vang|da)\b[^.!?]*\b(anh|chi)\s+nhe\b/g,
    /\b(gia|gia si|bao gia|ben em|dang co san|san hang|ho tro|tu van|gui stk)\b[^.!?]{0,40}\b(anh|chi)\s+nhe\b/g,
    /\b(mau nay|model nay)\b[^.!?]{0,50}\b(anh|chi)\s+nhe\b/g
  ];
  return strongSaleAssertionPatterns.reduce((acc, pattern) => acc + countMatches(input, pattern), 0);
}

export function analyzeBuyerVoiceStyle(
  reply: string,
  saleMessage: string,
  identity: ConversationIdentityProfile
): BuyerVoiceStyleMetrics {
  const replyNorm = normalize(reply);
  const saleNorm = normalize(saleMessage);
  const drift = detectIdentityDrift(reply, identity);

  const overPoliteMarkerCount =
    countMatches(replyNorm, /\b(vang|da)\b/g) +
    countMatches(replyNorm, /\ba\b/g) +
    countMatches(replyNorm, /\bnhe\b/g);
  const supportPhraseCount = countSupportPhraseMatches(replyNorm);
  const saleEchoMarkerCount = countSaleEchoMarkers(replyNorm, saleNorm);
  const buyerRequestMarkerCount = countBuyerRequestMarkers(replyNorm);
  const saleStyleEndingCount = countSaleStyleEndings(replyNorm);
  const leadingPoliteMarker = /^\s*(vang|da)\b/.test(replyNorm);

  let buyerVoiceScore = 100;
  buyerVoiceScore -= supportPhraseCount * 20;
  buyerVoiceScore -= saleEchoMarkerCount * 10;
  buyerVoiceScore -= saleStyleEndingCount * 18;
  buyerVoiceScore -= Math.max(0, overPoliteMarkerCount - 1) * 4;
  if (leadingPoliteMarker) {
    buyerVoiceScore -= 6;
  }
  if (drift.identity_drift_detected) {
    buyerVoiceScore -= drift.is_recoverable ? 10 : 22;
  }
  buyerVoiceScore += Math.min(8, buyerRequestMarkerCount * 2);
  buyerVoiceScore = Math.max(0, Math.min(100, buyerVoiceScore));

  let saleToneRisk: "low" | "medium" | "high" = "low";
  if (
    supportPhraseCount > 0 ||
    saleStyleEndingCount > 0 ||
    saleEchoMarkerCount >= 3 ||
    (!drift.is_recoverable && drift.identity_drift_detected)
  ) {
    saleToneRisk = "high";
  } else if (
    saleEchoMarkerCount > 0 ||
    overPoliteMarkerCount >= 3 ||
    leadingPoliteMarker
  ) {
    saleToneRisk = "medium";
  }

  return {
    buyer_voice_score: buyerVoiceScore,
    sale_tone_risk: saleToneRisk,
    over_polite_marker_count: overPoliteMarkerCount,
    sale_echo_marker_count: saleEchoMarkerCount,
    support_phrase_count: supportPhraseCount,
    buyer_request_marker_count: buyerRequestMarkerCount
  };
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

  // Rewrite only severe voice drift into buyer-neutral phrasing.
  const match = reply.match(/^(chị|anh)\s+đang\s+tìm\s+([^]*?)\s+ạ\s*[?.!]*$/i);
  if (match) {
    const product = match[2].trim();
    return `${selfCap} đang tìm ${product} cho công việc. ${target} gửi ${self} vài mẫu phù hợp để ${self} so sánh nhé.`;
  }

  const matchWant = reply.match(/^(chị|anh)\s+muốn\s+xem\s+([^]*?)\s+ạ\s*[?.!]*$/i);
  if (matchWant) {
    const model = matchWant[2].trim();
    return `${selfCap} muốn xem ${model}. ${target} gửi ${self} cấu hình chi tiết trước nhé.`;
  }

  const cleaned = reply.replace(/\s+ạ\s*([?.!]*)$/i, "$1").trim();
  if (cleaned !== reply) return cleaned;

  return reply;
}
