import { ConversationIdentityProfile } from "./conversationIdentity";
import { ConversationProgress, ConversationTopic, TOPIC_ORDER } from "./conversationProgressTracker";

export interface ResponseBankInput {
  topic: ConversationTopic | null;
  nextTopic: ConversationTopic | null;
  identity: ConversationIdentityProfile;
  recentFallbackVariantIds: string[];
  recentReplies: string[];
  persona?: {
    buyer_role?: string;
    purchase_context?: string;
    behavior_rules?: string[];
    difficulty?: string;
  };
  product_context_status?: string; // Phase 12H.1-C
  is_price_quoted?: boolean; // Nhánh C
}

export interface ResponseBankResult {
  reply: string;
  variant_id: string;
  topic_used: ConversationTopic | null;
  exhausted_variants: boolean;
}

type ResponseVariant = {
  variant_id: string;
  text: string;
};

type TopicVariants = Record<ConversationTopic, ResponseVariant[]>;

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

function render(text: string, identity: ConversationIdentityProfile): string {
  const self = identity.customer_self_pronoun;
  const selfCap = self.charAt(0).toUpperCase() + self.slice(1);
  const sale = identity.customer_target_pronoun;
  const saleCap = sale.charAt(0).toUpperCase() + sale.slice(1);

  return text
    .replaceAll("{self}", self)
    .replaceAll("{self_cap}", selfCap)
    .replaceAll("{sale}", sale)
    .replaceAll("{sale_cap}", saleCap);
}

const BANK: TopicVariants = {
  product_model: [
    { variant_id: "product_model_1", text: "{self} muốn chốt rõ model trước khi đi tiếp, {sale} gửi lại mã máy giúp {self} nhé." },
    { variant_id: "product_model_2", text: "{self} cần xác nhận đúng mẫu máy rồi mới đi tiếp được." },
    { variant_id: "product_model_3", text: "{self} muốn kiểm tra lại mã máy cho chắc trước khi quyết định." },
    { variant_id: "product_model_4", text: "Mẫu này phải đúng model {self} đang xem thì mới chốt được, {sale} kiểm tra lại giúp {self} nhé." }
  ],
  configuration: [
    { variant_id: "configuration_1", text: "{self} muốn chốt lại cấu hình chính trước khi quyết định." },
    { variant_id: "configuration_2", text: "{self} cần xác nhận CPU, RAM, SSD cho đúng nhu cầu." },
    { variant_id: "configuration_3", text: "{self} muốn đối chiếu lại cấu hình để tránh nhầm." },
    { variant_id: "configuration_4", text: "Cấu hình này nếu đúng nhu cầu của {self} thì mình đi tiếp được." }
  ],
  price: [
    { variant_id: "price_1", text: "{self} muốn chốt mức giá rõ hơn cho mẫu này, {sale} báo giúp {self} thêm một mức để so sánh nhé." },
    { variant_id: "price_2", text: "{self} cần thêm mức giá cụ thể để so sánh, {sale} cho {self} xin thêm một option nữa nhé." },
    { variant_id: "price_3", text: "Giá này nếu còn linh hoạt thì {self} sẽ dễ chốt hơn, {sale} hỗ trợ {self} thêm chút nhé." },
    { variant_id: "price_4", text: "{self} đang ưu tiên một mức giá dễ cân đối hơn, {sale} gửi giúp {self} khung giá phù hợp nhé." }
  ],
  stock: [
    { variant_id: "stock_1", text: "{self} muốn kiểm tra lại mẫu này còn sẵn hàng không {sale}?" },
    { variant_id: "stock_2", text: "Mẫu này hiện còn hàng chứ {sale}? {self} cần xác nhận trước khi đi tiếp." },
    { variant_id: "stock_3", text: "{self} đang ưu tiên mẫu còn sẵn hàng để khỏi mất thời gian." },
    { variant_id: "stock_4", text: "Bên mình còn hàng cho mẫu này không {sale}, {self} cần chốt nhanh." }
  ],
  delivery: [
    { variant_id: "delivery_1", text: "{self} muốn biết mốc giao cụ thể để chủ động kế hoạch." },
    { variant_id: "delivery_2", text: "{self} cần xác nhận thời gian giao rồi mới quyết." },
    { variant_id: "delivery_3", text: "Nếu giao sớm được thì {self} sẽ dễ chốt hơn." },
    { variant_id: "delivery_4", text: "{sale} cho {self} xin mốc giao rõ hơn nhé." }
  ],
  warranty: [
    { variant_id: "warranty_1", text: "{self} cần rõ chính sách bảo hành để yên tâm chốt." },
    { variant_id: "warranty_2", text: "{self} muốn xem phần bảo hành trước khi đi tiếp." },
    { variant_id: "warranty_3", text: "Bảo hành càng rõ thì {self} càng dễ quyết." },
    { variant_id: "warranty_4", text: "{sale} cho {self} xin thông tin bảo hành cụ thể nhé." }
  ],
  payment: [
    { variant_id: "payment_1", text: "{self} cần thông tin thanh toán để xử lý bước tiếp theo." },
    { variant_id: "payment_2", text: "{self} muốn xác nhận phần thanh toán trước khi chốt." },
    { variant_id: "payment_3", text: "Nếu thanh toán ổn thì {self} sẽ đi tiếp." },
    { variant_id: "payment_4", text: "{sale} gửi giúp {self} thông tin thanh toán rõ hơn nhé." }
  ],
  invoice_or_document: [
    { variant_id: "invoice_or_document_1", text: "{self} cần xác nhận phần hóa đơn/chứng từ giúp {self} nhé." },
    { variant_id: "invoice_or_document_2", text: "{self} cần giấy tờ rõ ràng trước khi chốt." },
    { variant_id: "invoice_or_document_3", text: "Nếu có hóa đơn đầy đủ thì {self} sẽ dễ xử lý hơn." },
    { variant_id: "invoice_or_document_4", text: "{sale} cho {self} xin thông tin chứng từ đi kèm nhé." }
  ],
  next_step: [
    { variant_id: "next_step_1", text: "Nếu ổn rồi thì {self} chốt bước tiếp theo luôn {sale} nhé." },
    { variant_id: "next_step_2", text: "{self} muốn đi sang bước tiếp theo cho gọn." },
    { variant_id: "next_step_3", text: "{self} đã nắm đủ phần chính, giờ mình chốt tiếp nhé." },
    { variant_id: "next_step_4", text: "{sale} hỗ trợ {self} bước cuối để chốt nhanh hơn nhé." }
  ]
};

function tokenSet(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter(Boolean)
  );
}

function overlapScore(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  let overlap = 0;
  for (const token of ta) {
    if (tb.has(token)) overlap += 1;
  }
  return overlap / Math.max(1, Math.min(ta.size, tb.size));
}

function chooseBestVariant(
  variants: ResponseVariant[],
  recentFallbackVariantIds: string[],
  recentReplies: string[]
): ResponseVariant {
  const recentIdSet = new Set(recentFallbackVariantIds.slice(-3));
  const candidates = variants.filter((v) => !recentIdSet.has(v.variant_id));
  const pool = candidates.length > 0 ? candidates : variants;

  let best = pool[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of pool) {
    const similarity = recentReplies.length === 0
      ? 0
      : Math.max(...recentReplies.slice(-3).map((prev) => overlapScore(candidate.text, prev)));
    const tieBreak = normalize(candidate.variant_id).length;
    const score = similarity * 1000 + tieBreak / 1000;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

export type VoiceGroup =
  | "price_sensitive"
  | "corporate_buyer"
  | "reseller"
  | "internal_it"
  | "hesitant_buyer"
  | "urgent_buyer"
  | "standard";

export function inferVoiceGroup(persona?: {
  buyer_role?: string;
  purchase_context?: string;
  behavior_rules?: string[];
  difficulty?: string;
}): VoiceGroup {
  if (!persona) return "standard";
  const role = (persona.buyer_role || "").toLowerCase();
  const context = (persona.purchase_context || "").toLowerCase();
  const rules = (persona.behavior_rules || []).map((r) => r.toLowerCase()).join(" ");

  if (
    role.includes("thu mua") ||
    role.includes("purchasing") ||
    context.includes("cong ty") ||
    context.includes("vat") ||
    context.includes("hoa don") ||
    rules.includes("trinh duyet") ||
    rules.includes("hoa don")
  ) {
    return "corporate_buyer";
  }
  if (
    role.includes("dai ly") ||
    role.includes("reseller") ||
    role.includes("si") ||
    context.includes("ban lai") ||
    context.includes("dai ly")
  ) {
    return "reseller";
  }
  if (
    role.includes("it") ||
    role.includes("ky thuat") ||
    role.includes("admin") ||
    role.includes("he thong")
  ) {
    return "internal_it";
  }
  if (
    context.includes("gap") ||
    context.includes("som") ||
    context.includes("ngay trong ngay") ||
    rules.includes("gap")
  ) {
    return "urgent_buyer";
  }
  if (
    rules.includes("gia re") ||
    rules.includes("mac ca") ||
    rules.includes("chiet khau") ||
    rules.includes("ngan sach han hep") ||
    context.includes("tiet kiem")
  ) {
    return "price_sensitive";
  }
  if (
    rules.includes("phan van") ||
    rules.includes("tham khao") ||
    rules.includes("can nhac") ||
    rules.includes("luong lu")
  ) {
    return "hesitant_buyer";
  }
  return "standard";
}

function hasGatedTerms(text: string): boolean {
  const t = normalize(text);
  const gatedPatterns = [
    "mau nay",
    "model nay",
    "giu mau nay",
    "chot mau nay",
    "stk",
    "so tai khoan",
    "thanh toan",
    "chuyen khoan",
    "chot luon"
  ];
  return gatedPatterns.some(pat => t.includes(pat));
}

function hasSupportPhrases(text: string): boolean {
  const t = normalize(text);
  const supportPhrases = [
    "em ho tro giu mau nay",
    "minh ho tro",
    "ben minh ho tro",
    "ben em dang san hang"
  ];
  return supportPhrases.some(pat => t.includes(pat));
}

function gateResponseBankResult(result: ResponseBankResult, input: ResponseBankInput): ResponseBankResult {
  const isSpecific = input.product_context_status === "specific";
  const hasGated = hasGatedTerms(result.reply);
  const hasSupport = hasSupportPhrases(result.reply);
  
  // Nhánh C: Gating price negotiation variants if no price has been quoted
  const isPriceTopic = input.nextTopic === "price" || input.topic === "price" || result.topic_used === "price" || result.variant_id.includes("price") || result.variant_id.includes("price_sensitive");
  const hasPriceObjectionTerms = /gia nay|gia do|gia vay|linh hoat|giam them|bot them|de chot hon/.test(normalize(result.reply));
  
  if (isPriceTopic && hasPriceObjectionTerms && input.is_price_quoted === false) {
    const self = input.identity.customer_self_pronoun;
    const selfCap = self.charAt(0).toUpperCase() + self.slice(1);
    const sale = input.identity.customer_target_pronoun;
    const saleCap = sale.charAt(0).toUpperCase() + sale.slice(1);
    
    return {
      reply: `${selfCap} chưa thấy ${sale} báo giá cụ thể nên chưa so sánh được. ${saleCap} gửi ${self} vài mẫu phù hợp kèm giá sỉ để ${self} xem trước nhé.`,
      variant_id: "product_context_gating_price_request",
      topic_used: result.topic_used,
      exhausted_variants: result.exhausted_variants
    };
  }
  
  if (hasSupport || (!isSpecific && hasGated)) {
    const self = input.identity.customer_self_pronoun;
    const selfCap = self.charAt(0).toUpperCase() + self.slice(1);
    const sale = input.identity.customer_target_pronoun;
    const saleCap = sale.charAt(0).toUpperCase() + sale.slice(1);
    const safeClarificationFallback = `${selfCap} chưa chốt model cụ thể đâu ${sale}. ${saleCap} gửi ${self} vài mẫu phù hợp để ${self} so sánh giá sỉ với cấu hình trước nhé.`;
    
    return {
      reply: safeClarificationFallback,
      variant_id: "product_context_gating_clarify",
      topic_used: result.topic_used,
      exhausted_variants: result.exhausted_variants
    };
  }
  return result;
}

export function buildResponseBankReply(input: ResponseBankInput): ResponseBankResult {
  return gateResponseBankResult(buildResponseBankReplyInternal(input), input);
}

function buildResponseBankReplyInternal(input: ResponseBankInput): ResponseBankResult {
  const topic = input.nextTopic || input.topic;
  const fallbackTopic = topic ?? "next_step";
  
  const voiceGroup = inferVoiceGroup(input.persona);

  // Apply voice group specific overrides
  if (voiceGroup === "corporate_buyer") {
    if (fallbackTopic === "payment" || fallbackTopic === "invoice_or_document" || fallbackTopic === "next_step") {
      const s = input.identity.customer_self_pronoun;
      const sCap = s.charAt(0).toUpperCase() + s.slice(1);
      const t = input.identity.customer_target_pronoun;
      return {
        reply: `${sCap} cần ${t} gửi giúp ${s} báo giá công ty kèm thông tin tài khoản và thủ tục xuất hóa đơn VAT để trình duyệt nhé.`,
        variant_id: `voice_corporate_fallback`,
        topic_used: fallbackTopic,
        exhausted_variants: false
      };
    }
  } else if (voiceGroup === "price_sensitive") {
    if (fallbackTopic === "price") {
      const s = input.identity.customer_self_pronoun;
      const sCap = s.charAt(0).toUpperCase() + s.slice(1);
      const t = input.identity.customer_target_pronoun;
      return {
        reply: `Giá này bên ${t} còn mức chiết khấu nào tốt hơn nữa không? Nếu ổn thì gửi ${s} báo giá để xem chốt luôn nhé.`,
        variant_id: `voice_price_sensitive_fallback`,
        topic_used: fallbackTopic,
        exhausted_variants: false
      };
    }
  } else if (voiceGroup === "urgent_buyer") {
    if (fallbackTopic === "payment" || fallbackTopic === "next_step" || fallbackTopic === "stock") {
      const s = input.identity.customer_self_pronoun;
      const sCap = s.charAt(0).toUpperCase() + s.slice(1);
      const t = input.identity.customer_target_pronoun;
      return {
        reply: `Nếu mẫu này còn sẵn hàng thì ${t} giữ trước giúp ${s} nhé, gửi ${s} thông tin thanh toán để ${s} chuyển khoản xử lý sớm nha.`,
        variant_id: `voice_urgent_fallback`,
        topic_used: fallbackTopic,
        exhausted_variants: false
      };
    }
  } else if (voiceGroup === "reseller") {
    if (fallbackTopic === "price" || fallbackTopic === "next_step") {
      const s = input.identity.customer_self_pronoun;
      const sCap = s.charAt(0).toUpperCase() + s.slice(1);
      const t = input.identity.customer_target_pronoun;
      return {
        reply: `Bên đại lý của ${s} lấy số lượng thì có chính sách giá sỉ đặc biệt không ${t}? Gửi ${s} báo giá chi tiết nhé.`,
        variant_id: `voice_reseller_fallback`,
        topic_used: fallbackTopic,
        exhausted_variants: false
      };
    }
  } else if (voiceGroup === "internal_it") {
    if (fallbackTopic === "configuration" || fallbackTopic === "product_model") {
      const s = input.identity.customer_self_pronoun;
      const sCap = s.charAt(0).toUpperCase() + s.slice(1);
      const t = input.identity.customer_target_pronoun;
      return {
        reply: `${sCap} bên kỹ thuật nội bộ cần kiểm tra kỹ cấu hình chi tiết và tính tương thích, ${t} gửi thông số chuẩn giúp ${s} nhé.`,
        variant_id: `voice_it_fallback`,
        topic_used: fallbackTopic,
        exhausted_variants: false
      };
    }
  } else if (voiceGroup === "hesitant_buyer") {
    if (fallbackTopic === "price" || fallbackTopic === "next_step") {
      const s = input.identity.customer_self_pronoun;
      const sCap = s.charAt(0).toUpperCase() + s.slice(1);
      const t = input.identity.customer_target_pronoun;
      return {
        reply: `${sCap} đang cân nhắc và so sánh thêm giữa vài phương án, ${t} cứ gửi trước thông tin để ${s} xem kỹ nhé.`,
        variant_id: `voice_hesitant_fallback`,
        topic_used: fallbackTopic,
        exhausted_variants: false
      };
    }
  }

  const variants = BANK[fallbackTopic];
  const chosen = chooseBestVariant(variants, input.recentFallbackVariantIds, input.recentReplies);
  const reply = render(chosen.text, input.identity).replace(/^Dạ\s+/i, "");

  return {
    reply,
    variant_id: chosen.variant_id,
    topic_used: fallbackTopic,
    exhausted_variants: new Set(input.recentFallbackVariantIds.slice(-3)).size >= variants.length
  };
}

export function listResponseBankTopics(): ConversationTopic[] {
  return TOPIC_ORDER.slice();
}
