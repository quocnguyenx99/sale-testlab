import { ConversationMemorySlots } from "./conversationMemory";
import { ConversationIdentityProfile, repairPronounDrift } from "./conversationIdentity";

export interface ChatTurn {
  role: "sale" | "customer_ai";
  text: string;
  state?: string;
}

export type RuntimeReplySource =
  | "local_ai_generated"
  | "local_ai_rewritten"
  | "deterministic_fallback";

export function normalizeForMatch(input: string): string {
  return (input || "")
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDirectQuestion(text: string): boolean {
  const t = normalizeForMatch(text);
  return text.includes("?") || /\b(nao|gi|khong|chua|may)\b/.test(t);
}

type PriceQuoteCandidate = {
  raw: string;
  index: number;
  normalized: string;
};

const PRICE_QUOTE_CANDIDATE_REGEX =
  /\b\d{1,3}(?:[.,]\d{3})+(?:\s*(?:vnd|vnđ|đ))?\b|\b\d+(?:[.,]\d+)?\s*(?:triệu|trieu|tr|k|vnd|vnđ|đ)\b|\b\d+(?:[.,]\d+)?m\b/giu;

function isBlockedNumericPriceContext(input: string, candidate: PriceQuoteCandidate): boolean {
  const normalizedInput = normalizeForMatch(input);
  const candidateOffset = normalizedInput.indexOf(candidate.normalized);
  const index = candidateOffset >= 0 ? candidateOffset : candidate.index;
  const start = Math.max(0, index - 24);
  const end = Math.min(normalizedInput.length, index + candidate.normalized.length + 24);
  const windowText = normalizedInput.slice(start, end);

  if (/\b\d+\s*-\s*\d+\b/.test(windowText)) return true;
  if (new RegExp(`${candidate.normalized}\\s*(?:gb|tb|ram|ssd|hdd|cpu|core|gen)\\b`).test(windowText)) return true;
  if (new RegExp(`${candidate.normalized}\\s*(?:mau|option|dong may|dong|cai|chiec|bo)\\b`).test(windowText)) return true;
  if (new RegExp(`\\bi[3579]\\s*/\\s*${candidate.normalized}\\b`).test(windowText)) return true;
  if (/\bi[3579]\b/.test(windowText) || /\bryzen\s*\d+\b/.test(windowText)) return true;

  return false;
}

function extractQuotedPriceText(input: string): string | null {
  const matches = Array.from(input.matchAll(PRICE_QUOTE_CANDIDATE_REGEX));
  for (const match of matches) {
    const raw = match[0]?.trim();
    if (!raw) continue;
    const candidate: PriceQuoteCandidate = {
      raw,
      index: match.index ?? 0,
      normalized: normalizeForMatch(raw)
    };
    if (isBlockedNumericPriceContext(input, candidate)) {
      continue;
    }
    return raw;
  }
  return null;
}

export function isPriceActuallyQuoted(recentTurns: ChatTurn[], latestMessage: string): boolean {
  const saleMessages = [...recentTurns.filter(t => t.role === "sale").map(t => t.text), latestMessage];
  return saleMessages.some(message => extractQuotedPriceText(message) !== null);
}

export function isActualStockLeak(reply: string, qtyStr: string): boolean {
  const t = normalizeForMatch(reply);
  const regex = new RegExp(`\\b${qtyStr}\\b`, "g");
  let match: RegExpExecArray | null;

  const stockKeywords = ["con", "ton", "kho", "san", "hang"];
  const unitKeywords = ["cai", "chiec", "may", "bo", "con"];

  while ((match = regex.exec(t)) !== null) {
    const idx = match.index;
    const start = Math.max(0, idx - 30);
    const end = Math.min(t.length, idx + qtyStr.length + 30);
    const windowText = t.substring(start, end);

    const hasKeyword = stockKeywords.some(kw => new RegExp(`\\b${kw}\\b`).test(windowText));
    const hasUnit = unitKeywords.some(unit => new RegExp(`\\b${unit}\\b`).test(windowText));

    if (hasKeyword && hasUnit) {
      return true;
    }
  }
  return false;
}

export function hasGatedTerms(text: string): boolean {
  const t = normalizeForMatch(text);
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

export function hasSupportPhrases(text: string): boolean {
  const t = normalizeForMatch(text);
  const supportPhrases = [
    "em ho tro giu mau nay",
    "minh ho tro",
    "ben minh ho tro",
    "ben em dang san hang"
  ];
  return supportPhrases.some(pat => t.includes(pat));
}

export interface SafetyGuardsResult {
  reply: string;
  finalReplySource: RuntimeReplySource;
  guardTriggered: boolean;
  reasons: string[];
  ambiguous_model_guard_triggered: boolean;
  stock_quantity_hidden_from_customer: boolean;
  consultant_tone_blocked: boolean;
}

function hasDeliveryAsMainQuestion(text: string): boolean {
  const t = normalizeForMatch(text);
  const hasDelivery = /\b(giao hang|giao khi nao|bao lau giao|ship|thoi gian giao|khi nao giao)\b/.test(t);
  const hasModelOrConfig = /\b(model|ma may|ma san pham|cau hinh|ram|ssd|cpu|phien ban)\b/.test(t);
  return hasDelivery && !hasModelOrConfig;
}

function hasBuyerVoiceEcho(text: string, saleMessage: string): boolean {
  const t = normalizeForMatch(text);
  const sale = normalizeForMatch(saleMessage);
  const repeatsSaleStyleMessage =
    sale.length > 0 &&
    /\b(anh nhe|chi nhe)\b/.test(sale) &&
    t.includes(sale);

  return (
    repeatsSaleStyleMessage ||
    /\b(mau nay|model nay).{0,40}\b(gia si|gia nay)\b.{0,20}\b(chi nhe|anh nhe)\b/.test(t) ||
    /\bem\s+(ho tro|bao gia|tu van)\b/.test(t)
  );
}

function buildModelConfigRedirect(identity: ConversationIdentityProfile, includePrice: boolean): string {
  const self = identity.customer_self_pronoun;
  const target = identity.customer_target_pronoun;
  const targetCap = target.charAt(0).toUpperCase() + target.slice(1);
  if (includePrice) {
    return `${targetCap} gửi ${self} model, cấu hình cụ thể với giá trước nhé, rồi mình chốt thời gian giao sau.`;
  }
  return `${targetCap} gửi ${self} model và cấu hình cụ thể trước nhé, rồi mình bàn tiếp giá và giao hàng sau.`;
}

function replaceDeliveryQuestionWithRedirect(
  reply: string,
  identity: ConversationIdentityProfile,
  includePrice: boolean
): string {
  const deliveryCueRegex = /\b(vậy\s+)?(thời gian giao hàng|thoi gian giao|giao hàng|giao hang|giao khi nào|giao khi nao|bao lâu giao|bao lau giao|khi nào giao|khi nao giao|ship)\b/iu;
  const deliverySentenceRegex = /(^|[.!?]\s*)([^.!?]*\b(giao hàng|giao hang|giao khi nào|giao khi nao|bao lâu giao|bao lau giao|ship|thời gian giao|thoi gian giao|khi nào giao|khi nao giao)\b[^.!?]*[.!?]?)/iu;
  const redirect = buildModelConfigRedirect(identity, includePrice);
  const cueMatch = reply.match(deliveryCueRegex);
  if (cueMatch && cueMatch.index !== undefined) {
    const prefix = reply.slice(0, cueMatch.index).trim().replace(/[,:;\s]+$/u, "");
    if (prefix.length > 0) {
      const normalizedPrefix = /[.!?]$/.test(prefix) ? prefix : `${prefix}.`;
      return `${normalizedPrefix} ${redirect}`;
    }
  }
  if (deliverySentenceRegex.test(reply)) {
    const stripped = reply.replace(deliverySentenceRegex, "$1").trim().replace(/\s+/g, " ");
    if (stripped.length > 0) {
      const normalized = /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
      return `${normalized} ${redirect}`;
    }
    return redirect;
  }
  return `${reply.trim()} ${redirect}`.trim();
}

function buildBuyerVoiceRepair(input: {
  reply: string;
  saleMessage: string;
  identity: ConversationIdentityProfile;
  nextUnresolvedTopic?: string | null;
}): { reply: string; reasons: string[] } | null {
  const self = input.identity.customer_self_pronoun;
  const target = input.identity.customer_target_pronoun;
  const targetCap = target.charAt(0).toUpperCase() + target.slice(1);
  const reasons: string[] = [];

  let nextReply = input.reply;
  const repairedPronounReply = repairPronounDrift(nextReply, input.identity);
  if (repairedPronounReply !== nextReply) {
    nextReply = repairedPronounReply;
    reasons.push("buyer_voice_self_pronoun_repaired");
  }

  const hasEcho = hasBuyerVoiceEcho(nextReply, input.saleMessage);
  const mustGateDelivery =
    input.nextUnresolvedTopic === "product_model" ||
    input.nextUnresolvedTopic === "configuration" ||
    input.nextUnresolvedTopic === "price";
  const deliveryMainQuestion = hasDeliveryAsMainQuestion(nextReply);

  if (!hasEcho && !deliveryMainQuestion) {
    return reasons.length > 0 ? { reply: nextReply, reasons } : null;
  }

  const quotedPriceText =
    extractQuotedPriceText(input.saleMessage) ||
    extractQuotedPriceText(nextReply);

  if (hasEcho) {
    reasons.push("buyer_voice_sale_echo_repaired");
  }
  if (mustGateDelivery && deliveryMainQuestion) {
    reasons.push("delivery_main_topic_blocked");
  }

  if (hasEcho) {
    const askPrice = quotedPriceText ? `giá sỉ ${quotedPriceText} đúng không? ` : "";
    return {
      reply: `Vâng ${target}, ${askPrice}${targetCap} gửi ${self} model và cấu hình cụ thể trước nhé.`
        .replace(/\s+/g, " ")
        .trim(),
      reasons
    };
  }

  if (deliveryMainQuestion && mustGateDelivery) {
    return {
      reply: replaceDeliveryQuestionWithRedirect(nextReply, input.identity, Boolean(quotedPriceText)),
      reasons
    };
  }

  return reasons.length > 0 ? { reply: nextReply, reasons } : null;
}

export function applySafetyGuards(
  candidateReply: string,
  memorySlots: ConversationMemorySlots,
  identity: ConversationIdentityProfile,
  saleMessage: string,
  turns: ChatTurn[],
  nextUnresolvedTopic: string | null = null
): SafetyGuardsResult {
  let reply = candidateReply;
  let finalReplySource: RuntimeReplySource = "local_ai_generated";
  let guardTriggered = false;
  const reasons: string[] = [];

  let ambiguous_model_guard_triggered = false;
  let stock_quantity_hidden_from_customer = false;
  let consultant_tone_blocked = false;

  const isSpecific = memorySlots.product_context_status === "specific";

  const buyerVoiceRepair = buildBuyerVoiceRepair({
    reply,
    saleMessage,
    identity,
    nextUnresolvedTopic
  });
  if (buyerVoiceRepair) {
    reply = buyerVoiceRepair.reply;
    finalReplySource = "local_ai_rewritten";
    guardTriggered = true;
    reasons.push(...buyerVoiceRepair.reasons);
  }

  if (hasSupportPhrases(reply)) {
    consultant_tone_blocked = true;
    let modelCode = memorySlots.selected_product_model_code || "";
    let priceStr = "";

    const priceMatch = extractQuotedPriceText(reply);
    if (priceMatch) {
      priceStr = priceMatch;
    } else if (memorySlots.product_candidates_summary && memorySlots.product_candidates_summary.length > 0) {
      const p = memorySlots.product_candidates_summary.find(c => c.model_code === modelCode);
      if (p && p.price_si) {
        priceStr = p.price_si.toLocaleString("vi-VN");
      }
    }

    if (!modelCode) modelCode = "mẫu này";
    if (!priceStr) priceStr = "giá sỉ";

    const self = identity.customer_self_pronoun;
    const target = identity.customer_target_pronoun;

    reply = `À mã ${modelCode} còn hàng đúng không ${target}? Giá sỉ ${priceStr} thì ${target} báo thêm giúp ${self} thời gian giao nhé.`;
    finalReplySource = "deterministic_fallback";
    guardTriggered = true;
    reasons.push("consultant_tone_blocked");
  }

  if (!consultant_tone_blocked && !isSpecific && hasGatedTerms(reply)) {
    ambiguous_model_guard_triggered = true;

    const self = identity.customer_self_pronoun;
    const selfCap = self.charAt(0).toUpperCase() + self.slice(1);
    const sale = identity.customer_target_pronoun;
    const saleCap = sale.charAt(0).toUpperCase() + sale.slice(1);

    reply = `${selfCap} chưa chốt model cụ thể đâu ${sale}. ${saleCap} gửi ${self} vài mẫu phù hợp để ${self} so sánh giá sỉ với cấu hình trước nhé.`;
    finalReplySource = "deterministic_fallback";
    guardTriggered = true;
    reasons.push("ambiguous_model_guard_triggered");
  }

  if (!consultant_tone_blocked && !ambiguous_model_guard_triggered && memorySlots.product_candidates_summary) {
    const saleTextHistory = turns.filter(t => t.role === "sale").map(t => t.text).join(" ");

    for (const c of memorySlots.product_candidates_summary) {
      const qtyStr = String(c.stock_qty);
      const isMentionedByAI = new RegExp(`\\b${qtyStr}\\b`).test(reply);
      const wasMentionedBySale =
        new RegExp(`\\b${qtyStr}\\b`).test(saleTextHistory) ||
        new RegExp(`\\b${qtyStr}\\b`).test(saleMessage);

      if (isMentionedByAI && !wasMentionedBySale && isActualStockLeak(reply, qtyStr)) {
        stock_quantity_hidden_from_customer = true;
        const self = identity.customer_self_pronoun;
        const target = identity.customer_target_pronoun;

        reply = `Mẫu này còn hàng không ${target}? Nếu ${self} lấy vài cái thì bên ${target} có đủ không?`;
        finalReplySource = "deterministic_fallback";
        guardTriggered = true;
        reasons.push("stock_leak_blocked");
        break;
      }
    }
  }

  return {
    reply,
    finalReplySource,
    guardTriggered,
    reasons,
    ambiguous_model_guard_triggered,
    stock_quantity_hidden_from_customer,
    consultant_tone_blocked
  };
}
