import { ConversationIdentityProfile, detectIdentityDrift } from "./conversationIdentity";
import { detectRepeatedFreeFormLoop, detectRepeatedTopicAsking, isGenericConfirmationIntent, isRepeatedGenericFallback } from "./repetitionGuard";
import {
  ConversationProgress,
  ConversationTopic,
  TOPIC_ORDER,
  ensureConversationProgress,
  getTopicProgress
} from "./conversationProgressTracker";

export type CompletionRecommendedAction =
  | "ask_for_quote"
  | "ask_for_payment_info"
  | "ask_to_hold_product"
  | "ask_for_invoice_quote"
  | "end_session";

export interface ConversationCompletionState {
  completion_ready: boolean;
  completion_reason: string;
  missing_topics: ConversationTopic[];
  resolved_topics: ConversationTopic[];
  recommended_action: CompletionRecommendedAction;
  completion_blocked_by_product_context?: boolean;
  completion_block_reason?: string;
}

export interface ConversationCompletionInput {
  conversation_progress: ConversationProgress;
  identity_profile: ConversationIdentityProfile;
  next_unresolved_topic: ConversationTopic | null;
  recent_turns: Array<{ role: "sale" | "customer_ai"; text: string }>;
}

export interface CompletionReplyResult {
  reply: string;
  variant_id: string;
  topic_used: ConversationTopic | null;
}

const REQUIRED_TOPICS: ConversationTopic[] = ["product_model", "configuration", "price", "stock"];
const OPTIONAL_TOPICS: ConversationTopic[] = ["delivery", "warranty", "invoice_or_document", "payment"];

type ClosingVariant = {
  variant_id: string;
  text: string;
};

const CLOSING_BANK: Record<CompletionRecommendedAction, ClosingVariant[]> = {
  ask_for_quote: [
    { variant_id: "close_quote_1", text: "Vậy {sale} gửi giúp {self} báo giá và cấu hình chi tiết nhé." },
    { variant_id: "close_quote_2", text: "Vậy {sale} cho {self} xin báo giá kèm cấu hình rõ hơn nhé." }
  ],
  ask_for_payment_info: [
    { variant_id: "close_payment_1", text: "Vậy {sale} gửi giúp {self} thông tin thanh toán nhé." },
    { variant_id: "close_payment_2", text: "Vậy {sale} cho {self} xin thông tin thanh toán để chốt tiếp nhé." }
  ],
  ask_to_hold_product: [
    { variant_id: "close_hold_1", text: "Vậy {sale} giữ giúp {self} mẫu này, {self} chốt sớm nhé." },
    { variant_id: "close_hold_2", text: "Vậy {sale} hỗ trợ giữ mẫu này cho {self} nhé." }
  ],
  ask_for_invoice_quote: [
    { variant_id: "close_invoice_1", text: "Vậy {sale} gửi giúp {self} báo giá và thông tin xuất hóa đơn công ty nhé." },
    { variant_id: "close_invoice_2", text: "Vậy {sale} cho {self} xin báo giá kèm thông tin hóa đơn nhé." }
  ],
  end_session: [
    { variant_id: "close_end_1", text: "Vậy {sale} chốt giúp {self} bước cuối luôn nhé." },
    { variant_id: "close_end_2", text: "Vậy {sale} hỗ trợ {self} chốt đơn luôn nhé." }
  ]
};

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

function isResolved(progress: ConversationProgress, topic: ConversationTopic): boolean {
  const state = getTopicProgress(progress, topic);
  return state.answered || state.confirmed;
}

function getResolvedTopics(progress: ConversationProgress): ConversationTopic[] {
  return TOPIC_ORDER.filter((topic) => isResolved(progress, topic));
}

function getMissingTopics(progress: ConversationProgress): ConversationTopic[] {
  return TOPIC_ORDER.filter((topic) => !isResolved(progress, topic));
}

function hasRequiredCompletion(progress: ConversationProgress): boolean {
  const modelResolved = isResolved(progress, "product_model") || isResolved(progress, "configuration");
  return modelResolved && isResolved(progress, "price") && isResolved(progress, "stock");
}

function hasUsefulOptionalCompletion(progress: ConversationProgress): boolean {
  return OPTIONAL_TOPICS.some((topic) => isResolved(progress, topic));
}

function hasAllMajorTopics(progress: ConversationProgress): boolean {
  return [...REQUIRED_TOPICS, ...OPTIONAL_TOPICS].every((topic) => isResolved(progress, topic));
}

function pickRecommendedAction(progress: ConversationProgress): CompletionRecommendedAction {
  const modelResolved = isResolved(progress, "product_model") || isResolved(progress, "configuration");
  const priceResolved = isResolved(progress, "price");
  const stockResolved = isResolved(progress, "stock");
  const paymentResolved = isResolved(progress, "payment");
  const invoiceResolved = isResolved(progress, "invoice_or_document");
  const deliveryResolved = isResolved(progress, "delivery");
  const warrantyResolved = isResolved(progress, "warranty");

  if (!priceResolved) return "ask_for_quote";
  if (!stockResolved) return "ask_to_hold_product";
  if (!modelResolved) return "ask_for_quote";
  if (!paymentResolved) return "ask_for_payment_info";
  if (!invoiceResolved) return "ask_for_invoice_quote";
  if (!deliveryResolved || !warrantyResolved) return "ask_to_hold_product";
  return "end_session";
}

function pickCompletionReason(progress: ConversationProgress): string {
  if (hasAllMajorTopics(progress)) return "all_major_topics_resolved";
  if (!hasRequiredCompletion(progress)) {
    const missingRequired: ConversationTopic[] = [];
    if (!(isResolved(progress, "product_model") || isResolved(progress, "configuration"))) missingRequired.push("product_model_or_configuration");
    if (!isResolved(progress, "price")) missingRequired.push("price");
    if (!isResolved(progress, "stock")) missingRequired.push("stock");
    return `missing_required:${missingRequired.join(",")}`;
  }
  if (!hasUsefulOptionalCompletion(progress)) return "required_topics_resolved_missing_optional";
  return "required_topics_resolved_with_optional_info";
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter(Boolean));
  const tb = new Set(normalize(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const token of ta) {
    if (tb.has(token)) overlap += 1;
  }
  return overlap / Math.max(1, Math.min(ta.size, tb.size));
}

function chooseVariant(
  variants: ClosingVariant[],
  recentReplies: string[]
): ClosingVariant {
  let best = variants[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const variant of variants) {
    const similarity = recentReplies.length === 0
      ? 0
      : Math.max(...recentReplies.slice(-3).map((prev) => tokenOverlapScore(variant.text, prev)));
    const tieBreak = normalize(variant.variant_id).length;
    const score = similarity * 1000 + tieBreak / 1000;
    if (score < bestScore) {
      bestScore = score;
      best = variant;
    }
  }
  return best;
}

function hasQuestionIntent(text: string): boolean {
  const t = normalize(text);
  return (
    text.includes("?") ||
    /\b(khong|sao|the nao|bao nhieu|khi nao|duoc khong|chua|gi)\b/.test(t) ||
    /\b(gui lai|bao gia lai|cho xin lai|gui giup|cho minh xin|cho em xin|gui cho)\b/.test(t)
  );
}

const REOPEN_PATTERNS: Record<ConversationTopic, RegExp[]> = {
  product_model: [/\b(model|ma may|may nao|dong nao)\b/],
  configuration: [/\b(cau hinh|i3|i5|i7|i9|ram|ssd|gen)\b/],
  price: [/\b(gia|bao gia|bao nhieu|trieu|vnd|vnđ|chi phi)\b/],
  stock: [/\b(con hang|san hang|co san|kho|con|co)\b/],
  delivery: [/\b(giao|ship|khi nao|mai giao|hom nay|chua giao)\b/],
  warranty: [/\b(bao hanh|bao lau)\b/],
  payment: [/\b(stk|so tai khoan|chuyen khoan|thanh toan|dat coc|coc|cod)\b/],
  invoice_or_document: [/\b(hoa don|vat|chung tu|xuat duoc|xuat hd)\b/],
  next_step: [/\b(chot|giu hang|buoc tiep theo)\b/]
};

function hasObjectionIntent(text: string): boolean {
  const t = normalize(text);
  const objectionKeywords = [
    "gia hoi cao", "gia cao", "dat nhi", "hoi dat", "dat qua", "gia vay cao", "gia nay", "gia vay em", "gia vay chi", "gia nay de",
    "de anh xem", "de chi xem", "de em xem", "can nhac", "de xem lai", "tinh lai", "de tinh lai", "de anh tinh", "de chi tinh",
    "sep chua duyet", "cho duyet", "cho trinh", "trinh sep", "phai trinh", "hoi lai cong ty", "hoi lai sop", "hoi lai shop",
    "khong mua", "khong lay nua", "mua ben khac", "huy don", "khong can nua", "de sau nhe", "de sau nha", "luc khac"
  ];
  return objectionKeywords.some(kw => t.includes(normalize(kw)));
}

export function detectReopenedAnsweredTopics(
  candidateReply: string,
  progress: ConversationProgress
): ConversationTopic[] {
  if (!hasQuestionIntent(candidateReply)) return [];
  if (hasObjectionIntent(candidateReply)) return [];
  const t = normalize(candidateReply);
  const safeProgress = ensureConversationProgress(progress);
  const reopened: ConversationTopic[] = [];
  for (const topic of TOPIC_ORDER) {
    const state = getTopicProgress(safeProgress, topic);
    if (!(state.answered || state.confirmed)) continue;
    const patterns = REOPEN_PATTERNS[topic];
    if (patterns.some((pattern) => pattern.test(t))) {
      reopened.push(topic);
    }
  }
  return reopened;
}

export function evaluateConversationCompletion(
  input: ConversationCompletionInput,
  productContextStatus?: "unknown" | "vague" | "specific",
  hasSelectedModel?: boolean,
  stockStatus?: "in_stock" | "out_of_stock" | "unknown"
): ConversationCompletionState {
  const resolved_topics = getResolvedTopics(input.conversation_progress);
  const missing_topics = getMissingTopics(input.conversation_progress);
  let completion_ready = hasRequiredCompletion(input.conversation_progress) && hasUsefulOptionalCompletion(input.conversation_progress);
  const recommended_action = pickRecommendedAction(input.conversation_progress);
  const completion_reason = pickCompletionReason(input.conversation_progress);

  let completion_blocked_by_product_context = false;
  let completion_block_reason: string | undefined = undefined;

  if (productContextStatus === "unknown") {
    completion_ready = false;
    completion_blocked_by_product_context = true;
    completion_block_reason = "product_context_unknown";
  } else if (productContextStatus === "vague") {
    if (!hasSelectedModel) {
      completion_ready = false;
      completion_blocked_by_product_context = true;
      completion_block_reason = "product_context_vague_not_specific";
    }
  } else if (productContextStatus === "specific") {
    if (stockStatus === "out_of_stock") {
      completion_ready = false;
      completion_blocked_by_product_context = true;
      completion_block_reason = "product_stock_out_of_stock";
    }
  }

  return {
    completion_ready,
    completion_reason,
    missing_topics,
    resolved_topics,
    recommended_action: completion_ready && hasAllMajorTopics(input.conversation_progress)
      ? "end_session"
      : recommended_action,
    completion_blocked_by_product_context,
    completion_block_reason
  };
}

export function buildCompletionReply(input: {
  completion: ConversationCompletionState;
  identity: ConversationIdentityProfile;
  recentReplies: string[];
  nextUnresolvedTopic: ConversationTopic | null;
}): CompletionReplyResult {
  const topic = input.nextUnresolvedTopic;

  if (input.completion.completion_blocked_by_product_context) {
    if (input.completion.completion_block_reason === "product_stock_out_of_stock") {
      return {
        reply: render("Mẫu này hiện hết hàng rồi hả {sale}? Vậy {sale} gửi {self} mẫu tương đương còn hàng với giá sỉ gần gần giúp {self} nhé.", input.identity),
        variant_id: "product_context_gating_out_of_stock",
        topic_used: topic
      };
    }
    return {
      reply: render("{self_cap} chưa chốt model cụ thể đâu {sale}. {sale_cap} gửi {self} vài mẫu phù hợp để {self} so sánh giá sỉ với cấu hình trước nhé.", input.identity),
      variant_id: "product_context_gating_clarify",
      topic_used: topic
    };
  }

  const action = input.completion.completion_ready ? "end_session" : input.completion.recommended_action;
  const variants = CLOSING_BANK[action];
  const chosen = chooseVariant(variants, input.recentReplies);
  const reply = render(chosen.text, input.identity);

  return {
    reply,
    variant_id: chosen.variant_id,
    topic_used: topic
  };
}

export function shouldForceCompletionReply(input: {
  candidateReply: string;
  completion: ConversationCompletionState;
  progress: ConversationProgress;
  identity: ConversationIdentityProfile;
  recentReplies: string[];
  nextUnresolvedTopic: ConversationTopic | null;
}): boolean {
  if (hasObjectionIntent(input.candidateReply)) {
    return false;
  }

  if (input.completion.completion_ready) return true;
  if (input.nextUnresolvedTopic === "next_step") return true;

  const reopenedTopics = detectReopenedAnsweredTopics(input.candidateReply, input.progress);
  if (reopenedTopics.length > 0) return true;

  const repeatedTopics = detectRepeatedTopicAsking(input.candidateReply, input.progress);
  if (repeatedTopics.length > 0) return true;
  if (isGenericConfirmationIntent(input.candidateReply)) return true;
  if (isRepeatedGenericFallback(input.candidateReply, input.recentReplies)) return true;
  if (detectRepeatedFreeFormLoop(input.candidateReply, input.recentReplies)) return true;
  if (detectIdentityDrift(input.candidateReply, input.identity).identity_drift_detected) return true;
  return false;
}
