import { ConversationMemorySlots } from "./conversationMemory";
import { ConversationIdentityProfile, detectIdentityDrift, repairPronounDrift } from "./conversationIdentity";

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

export function isPriceActuallyQuoted(recentTurns: ChatTurn[], latestMessage: string): boolean {
  const saleMessages = [...recentTurns.filter(t => t.role === "sale").map(t => t.text), latestMessage];
  const joined = saleMessages.join(" ").toLowerCase();
  const PRICE_QUOTE_PATTERN = /\b\d+(?:\.\d{3})*(?:\s*(?:tr|trieu|vnd|vnđ|trđ|k|m))\b|\b\d+(?:\.\d{3}){2,}\b|\b\d+tr\d*\b/;
  return PRICE_QUOTE_PATTERN.test(joined);
}

export function isActualStockLeak(reply: string, qtyStr: string): boolean {
  const t = normalizeForMatch(reply);
  const regex = new RegExp(`\\b${qtyStr}\\b`, 'g');
  let match;
  
  const stockKeywords = ["con", "ton", "kho", "san", "hang"];
  const unitKeywords = ["cai", "chiec", "may", "bo", "con"];

  while ((match = regex.exec(t)) !== null) {
    const idx = match.index;
    const start = Math.max(0, idx - 30);
    const end = Math.min(t.length, idx + qtyStr.length + 30);
    const windowText = t.substring(start, end);
    
    const hasKeyword = stockKeywords.some(kw => {
      const kwRegex = new RegExp(`\\b${kw}\\b`);
      return kwRegex.test(windowText);
    });
    
    const hasUnit = unitKeywords.some(unit => {
      const unitRegex = new RegExp(`\\b${unit}\\b`);
      return unitRegex.test(windowText);
    });
    
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

function extractQuotedPriceText(input: string): string | null {
  const match = input.match(/\b\d+(?:[.,]\d{3})*(?:\s*(?:triệu|trieu|tr|k|m|vnd|vnđ|đ))?\b/iu);
  return match ? match[0].trim() : null;
}

function hasDeliveryAsMainQuestion(text: string): boolean {
  const t = normalizeForMatch(text);
  const hasDelivery = /\b(giao hang|giao khi nao|bao lau giao|ship|thoi gian giao|khi nao giao)\b/.test(t);
  const hasModelOrConfig = /\b(model|ma may|ma san pham|cau hinh|ram|ssd|cpu|phien ban)\b/.test(t);
  return hasDelivery && !hasModelOrConfig;
}

function hasBuyerVoiceEcho(text: string): boolean {
  const t = normalizeForMatch(text);
  return (
    /\bmau nay gia si\b/.test(t) ||
    /\b(gia si|gia nay).*(chi nhe|anh nhe)\b/.test(t) ||
    /\b(vang em|ok em|duoc em).*(chi nhe|anh nhe)\b/.test(t)
  );
}

function buildBuyerVoiceRepair(input: {
  reply: string;
  saleMessage: string;
  identity: ConversationIdentityProfile;
  nextUnresolvedTopic?: string | null;
}): { reply: string; reasons: string[] } | null {
  const normalizedReply = normalizeForMatch(input.reply);
  const self = input.identity.customer_self_pronoun;
  const target = input.identity.customer_target_pronoun;
  const selfCap = self.charAt(0).toUpperCase() + self.slice(1);
  const targetCap = target.charAt(0).toUpperCase() + target.slice(1);
  const reasons: string[] = [];

  let nextReply = input.reply;
  let workingReply = repairPronounDrift(nextReply, input.identity);
  if (workingReply !== nextReply) {
    nextReply = workingReply;
    reasons.push("buyer_voice_self_pronoun_repaired");
  }

  const hasEcho = hasBuyerVoiceEcho(nextReply);
  const mustGateDelivery =
    input.nextUnresolvedTopic === "product_model" ||
    input.nextUnresolvedTopic === "configuration";
  const deliveryMainQuestion = hasDeliveryAsMainQuestion(nextReply);

  if (!hasEcho && !deliveryMainQuestion) {
    return reasons.length > 0 ? { reply: nextReply, reasons } : null;
  }

  const quotedPriceText =
    extractQuotedPriceText(input.saleMessage) ||
    extractQuotedPriceText(nextReply) ||
    "giá sỉ này";

  if (hasEcho) {
    reasons.push("buyer_voice_sale_echo_repaired");
  }
  if (mustGateDelivery && deliveryMainQuestion) {
    reasons.push("delivery_main_topic_blocked");
  }

  const shouldAskModelFirst =
    mustGateDelivery ||
    /\bmau nay gia si\b/.test(normalizedReply) ||
    /\b(giao hang|ship|thoi gian giao)\b/.test(normalizedReply);

  if (shouldAskModelFirst) {
    return {
      reply: `Vâng ${target}, giá sỉ ${quotedPriceText} đúng không? ${targetCap} gửi ${self} model và cấu hình cụ thể trước nhé.`,
      reasons
    };
  }

  return {
    reply: `${selfCap} muốn xác nhận thêm thông tin cụ thể trước rồi mới hỏi tiếp về giao hàng nhé.`,
    reasons
  };
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

  // Guard 1: Consultant Tone Blocker
  if (hasSupportPhrases(reply)) {
    consultant_tone_blocked = true;
    let modelCode = memorySlots.selected_product_model_code || "";
    let priceStr = "";
    
    const priceMatch = reply.match(/\b\d{1,3}(\.\d{3})*(\.\d{3})?\b/);
    if (priceMatch) {
      priceStr = priceMatch[0];
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

  // Guard 2: Ambiguous Model Guard
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

  // Guard 3: Proactive Stock Leak Blocker
  if (!consultant_tone_blocked && !ambiguous_model_guard_triggered && memorySlots.product_candidates_summary) {
    const saleTextHistory = turns.filter(t => t.role === "sale").map(t => t.text).join(" ");
    
    for (const c of memorySlots.product_candidates_summary) {
      const qtyStr = String(c.stock_qty);
      const isMentionedByAI = new RegExp(`\\b${qtyStr}\\b`).test(reply);
      const wasMentionedBySale = new RegExp(`\\b${qtyStr}\\b`).test(saleTextHistory) || new RegExp(`\\b${qtyStr}\\b`).test(saleMessage);
      
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
