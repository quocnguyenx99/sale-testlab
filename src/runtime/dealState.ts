import { ConversationProgress, ConversationTopic } from "./conversationProgressTracker";

export type DealOutcome =
  | "not_ready"
  | "quote_requested"
  | "ready_to_close"
  | "payment_info_requested"
  | "hold_requested"
  | "customer_committed"
  | "pending_approval"
  | "pending_payment"
  | "closed_won_simulated"
  | "closed_lost"
  | "stalled";

export type TrainingSuccess =
  | "in_progress"
  | "partial_success"
  | "success"
  | "failed";

export interface DealState {
  buying_signals: string[];
  closing_signals: string[];
  objection_signals: string[];

  deal_outcome: DealOutcome;
  outcome_confidence: number;

  should_end_session: boolean;
  end_reason: string | null;

  next_best_action: string | null;

  training_success: TrainingSuccess;
}

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

// TASK 2 — Signal Detectors
export function detectCustomerBuyingSignals(text: string): string[] {
  const t = normalize(text);
  const signals: string[] = [];

  if (/\b(giu|khoa|dat)\s+(?:giup|ho|cho|dum)?\s*(may|hang|don)?\b/.test(t) || t.includes("giu may") || t.includes("giu hang")) {
    signals.push("hold_request_signal");
  }
  if ((t.includes("bao gia") || t.includes("cau hinh")) && /\b(gui|xin|cho|lay|trinh|xem|khao)\b/.test(t)) {
    signals.push("quote_request_signal");
  }
  if ((t.includes("stk") || t.includes("so tai khoan") || t.includes("tai khoan") || t.includes("chuyen khoan") || t.includes("thanh toan")) && /\b(gui|xin|cho|lay|chuyen|ck)\b/.test(t)) {
    signals.push("payment_request_signal");
  }
  if (
    /\b(lay|chot|mua)\s+(?:giup\s+(?:anh\s+|chi\s+|em\s+|minh\s+)?|ho\s+|cho\s+(?:anh\s+|chi\s+|em\s+|minh\s+)?|luon\s+)?(?:mau|may|dong|cai|em)?\s*(nay|nay\s*nhe|luon)\b/.test(t) ||
    /\b(anh|chi|em|minh)\s+(lay|chot|lay\s+mau\s+nay|chot\s+mau\s+nay)\b/.test(t)
  ) {
    signals.push("purchase_intent_signal");
  }
  if (t.includes("hoa don") || t.includes("vat") || t.includes("hd do")) {
    signals.push("invoice_request_signal");
  }
  if ((t.includes("giao") || t.includes("ship")) && (t.includes("hom nay") || t.includes("trong ngay") || t.includes("luon"))) {
    signals.push("urgent_delivery_signal");
  }
  if (t.includes("con hang") || t.includes("san hang") || t.includes("co san") || t.includes("con may")) {
    signals.push("stock_check_signal");
  }

  return signals;
}

export function detectCustomerClosingSignals(text: string): string[] {
  const t = normalize(text);
  const signals: string[] = [];

  if (
    /\b(anh\s+lay|chi\s+lay|chot\s+mau\s+nay|chot\s+may|lay\s+mau\s+nay|chot\s+luon)\b/.test(t) ||
    (t.includes("chot") && t.includes("mau nay")) ||
    (t.includes("lay") && t.includes("mau nay"))
  ) {
    signals.push("explicit_model_commitment");
  }
  if (
    t.includes("thong tin thanh toan") ||
    t.includes("gui stk") ||
    t.includes("chuyen khoan luon") ||
    t.includes("ck luon") ||
    t.includes("chuyen khoan nhe") ||
    t.includes("gui stk luon")
  ) {
    signals.push("explicit_payment_commitment");
  }
  if (
    t.includes("xuat hoa don giup") ||
    t.includes("xuat vat giup") ||
    t.includes("lay hoa don nhe") ||
    t.includes("xuat hd cong ty")
  ) {
    signals.push("explicit_invoice_commitment");
  }
  if (
    t.includes("giu may giup") ||
    t.includes("giu hang giup") ||
    t.includes("giu giup") ||
    t.includes("giu hang nhe")
  ) {
    signals.push("explicit_hold_commitment");
  }

  return signals;
}

export function detectCustomerObjectionSignals(text: string): string[] {
  const t = normalize(text);
  const signals: string[] = [];

  const hasPriceObjection = 
    t.includes("dat") || 
    t.includes("cao") ||
    t.includes("bot khong") || 
    t.includes("giam gia") || 
    t.includes("giam gia khong") ||
    t.includes("gia vay") ||
    t.includes("gia nay");

  if ((t.includes("gia") && hasPriceObjection) || t.includes("dat") || t.includes("cao qua")) {
    signals.push("price_objection_signal");
  }
  if (
    t.includes("de xem them") || 
    t.includes("can nhac them") || 
    t.includes("khao sat them") || 
    t.includes("tim hieu them") ||
    t.includes("de anh xem") ||
    t.includes("de chi xem") ||
    t.includes("de em xem") ||
    t.includes("de xem lai") ||
    t.includes("tinh lai") ||
    t.includes("de tinh lai") ||
    t.includes("de anh tinh") ||
    t.includes("de chi tinh")
  ) {
    signals.push("consideration_delay_signal");
  }
  if (
    t.includes("sep chua duyet") || 
    t.includes("cho duyet") || 
    t.includes("cho trinh") || 
    t.includes("trinh sep") || 
    t.includes("phai trinh") ||
    t.includes("hoi lai cong ty")
  ) {
    signals.push("approval_delay_signal");
  }
  if (
    t.includes("khong mua") ||
    t.includes("khong lay nua") ||
    t.includes("mua ben khac") ||
    t.includes("huy don") ||
    t.includes("khong can nua") ||
    t.includes("de sau nhe") ||
    t.includes("de sau nha") ||
    t.includes("luc khac")
  ) {
    signals.push("explicit_lost_signal");
  }

  return signals;
}

export function detectSaleSignals(text: string): string[] {
  const t = normalize(text);
  const signals: string[] = [];

  if (/\b(gui\s+bao\s+gia|day\s+la\s+bao\s+gia|gui\s+hoa\s+don|xuat\s+vat)\b/.test(t)) {
    signals.push("sale_offered_quote");
  }
  if (/\b(so\s+tai\s+khoan|stk|chuyen\s+khoan|ngan\s+hang|vietcombank|techcombank|bidv|acb|vietinbank|mbbank)\b/.test(t)) {
    signals.push("sale_offered_payment");
  }
  if (/\b(bao\s+hanh\s+\d+|hang\s+chinh\s+hang|zin)\b/.test(t)) {
    signals.push("sale_offered_warranty");
  }
  if (/\b(gia\s+la|gia\s+chot|trieu|vnd)\b/.test(t)) {
    signals.push("sale_offered_price");
  }

  return signals;
}

// TASK 3 — Outcome Evaluator
export function evaluateDealOutcome(params: {
  progress: ConversationProgress;
  recent_turns: Array<{ role: "sale" | "customer_ai"; text: string }>;
  buying_signals: string[];
  closing_signals: string[];
  objection_signals: string[];
  completion_ready: boolean;
  missing_topics: string[];
  product_context_status?: string; // Phase 12H.1-C
}): { deal_outcome: DealOutcome; outcome_confidence: number } {
  const lastCustomerTurn = [...params.recent_turns].reverse().find(t => t.role === "customer_ai");
  const lastCustomerText = lastCustomerTurn ? normalize(lastCustomerTurn.text) : "";

  // 1. Check closed_lost first (explicit refusal)
  if (params.objection_signals.includes("explicit_lost_signal")) {
    return { deal_outcome: "closed_lost", outcome_confidence: 0.95 };
  }

  const isProductSpecific = params.product_context_status === "specific" || params.product_context_status === undefined;

  // 2. Check closed_won_simulated
  // Requires explicit customer commitment and price must be resolved (not missing)
  const hasCommitment = 
    params.closing_signals.includes("explicit_model_commitment") ||
    params.closing_signals.includes("explicit_payment_commitment") ||
    params.closing_signals.includes("explicit_hold_commitment") ||
    lastCustomerText.includes("chot luon") ||
    lastCustomerText.includes("chot giup") ||
    lastCustomerText.includes("chot buoc cuoi") ||
    lastCustomerText.includes("anh lay") ||
    lastCustomerText.includes("chi lay");
  
  const priceResolved = !params.missing_topics.includes("price");

  if (hasCommitment && priceResolved) {
    if (isProductSpecific) {
      return { deal_outcome: "closed_won_simulated", outcome_confidence: 0.9 };
    } else {
      return { deal_outcome: "quote_requested", outcome_confidence: 0.8 };
    }
  }

  // 3. Check pending_payment / payment_info_requested
  // Triggered by customer asking for STK / payment info
  if (params.buying_signals.includes("payment_request_signal") || params.closing_signals.includes("explicit_payment_commitment")) {
    if (isProductSpecific) {
      return { deal_outcome: "payment_info_requested", outcome_confidence: 0.85 };
    } else {
      return { deal_outcome: "quote_requested", outcome_confidence: 0.8 };
    }
  }

  // 4. Check hold_requested
  if (params.buying_signals.includes("hold_request_signal") || params.closing_signals.includes("explicit_hold_commitment")) {
    if (isProductSpecific) {
      return { deal_outcome: "hold_requested", outcome_confidence: 0.85 };
    } else {
      return { deal_outcome: "quote_requested", outcome_confidence: 0.8 };
    }
  }

  // 5. Check pending_approval
  if (params.objection_signals.includes("approval_delay_signal")) {
    return { deal_outcome: "pending_approval", outcome_confidence: 0.8 };
  }

  // 6. Check quote_requested
  if (params.buying_signals.includes("quote_request_signal") || params.closing_signals.includes("explicit_invoice_commitment")) {
    return { deal_outcome: "quote_requested", outcome_confidence: 0.8 };
  }

  // 7. Check customer_committed (general purchase intent signal from customer)
  if (params.buying_signals.includes("purchase_intent_signal")) {
    return { deal_outcome: "customer_committed", outcome_confidence: 0.75 };
  }

  // 8. Check stalled (using advanced logic in evaluateStalled)
  const isStalled = evaluateStalled(params);
  if (isStalled) {
    return { deal_outcome: "stalled", outcome_confidence: 0.75 };
  }

  // 9. Check ready_to_close
  if (params.completion_ready) {
    return { deal_outcome: "ready_to_close", outcome_confidence: 0.8 };
  }

  return { deal_outcome: "not_ready", outcome_confidence: 0.5 };
}

function evaluateStalled(params: {
  recent_turns: Array<{ role: "sale" | "customer_ai"; text: string }>;
  buying_signals: string[];
  closing_signals: string[];
  objection_signals: string[];
  missing_topics: string[];
}): boolean {
  const totalTurns = params.recent_turns.length;
  if (totalTurns < 6) return false;

  const customerTurns = params.recent_turns.filter(t => t.role === "customer_ai");
  if (customerTurns.length < 3) return false;

  // Check if there are no new signals in the last 3 customer turns
  const last3CustomerTexts = customerTurns.slice(-3).map(t => normalize(t.text));
  let hasAnySignals = false;
  for (const text of last3CustomerTexts) {
    if (
      detectCustomerBuyingSignals(text).length > 0 ||
      detectCustomerClosingSignals(text).length > 0
    ) {
      hasAnySignals = true;
      break;
    }
  }

  // If customer is actively sending buying/closing signals, it's not stalled
  if (hasAnySignals) return false;

  // Check if customer replies are repetitive/weak (e.g. asking same thing or extremely short)
  const lastText = last3CustomerTexts[last3CustomerTexts.length - 1];
  const secondLastText = last3CustomerTexts[last3CustomerTexts.length - 2];
  
  const isRepetitive = lastText.length < 35 && lastText === secondLastText;
  const isTooShort = last3CustomerTexts.every(t => t.length < 25);

  // If there are price/stock objections and customer repeats delay signals
  let hasObjections = false;
  for (const text of last3CustomerTexts) {
    if (detectCustomerObjectionSignals(text).length > 0) {
      hasObjections = true;
      break;
    }
  }

  if ((isRepetitive || isTooShort) && totalTurns >= 6) {
    return true;
  }

  if (hasObjections && totalTurns >= 8) {
    return true;
  }

  return false;
}

// TASK 4 — Session End Rule
export function shouldEndSession(params: {
  deal_outcome: DealOutcome;
  missing_topics: string[];
  recent_turns: Array<{ role: "sale" | "customer_ai"; text: string }>;
}): { should_end_session: boolean; end_reason: string | null } {
  // Strong terminal outcomes always end the session
  if (params.deal_outcome === "closed_won_simulated") {
    return { should_end_session: true, end_reason: "closed_won_simulated" };
  }
  if (params.deal_outcome === "closed_lost") {
    return { should_end_session: true, end_reason: "closed_lost" };
  }
  if (params.deal_outcome === "stalled") {
    return { should_end_session: true, end_reason: "stalled" };
  }

  // Check if core topics (price, stock) are resolved (not missing)
  const coreResolved = !params.missing_topics.includes("price") && !params.missing_topics.includes("stock");

  // payment_info_requested ends only if core resolved (next action clear)
  if (params.deal_outcome === "payment_info_requested" && coreResolved) {
    return { should_end_session: true, end_reason: "payment_info_requested_terminal" };
  }

  // hold_requested ends only if core resolved (next action clear)
  if (params.deal_outcome === "hold_requested" && coreResolved) {
    return { should_end_session: true, end_reason: "hold_requested_terminal" };
  }

  // pending_approval ends only if core resolved (next action/quote clear)
  if (params.deal_outcome === "pending_approval" && coreResolved) {
    return { should_end_session: true, end_reason: "pending_approval_terminal" };
  }

  // Default: do not end session
  return { should_end_session: false, end_reason: null };
}

// TASK 5 — Training Success Evaluation
export function evaluateTrainingSuccess(params: {
  deal_outcome: DealOutcome;
  should_end_session: boolean;
  recent_turns_count: number;
}): TrainingSuccess {
  if (params.deal_outcome === "closed_won_simulated" || params.deal_outcome === "customer_committed") {
    return "success";
  }
  if (
    params.deal_outcome === "payment_info_requested" ||
    params.deal_outcome === "hold_requested" ||
    params.deal_outcome === "pending_approval" ||
    params.deal_outcome === "quote_requested"
  ) {
    return "partial_success";
  }
  if (params.deal_outcome === "closed_lost" || params.deal_outcome === "stalled") {
    return "failed";
  }
  return "in_progress";
}

// NEXT BEST ACTION
export function getNextBestAction(deal_outcome: DealOutcome, missing_topics: string[]): string | null {
  if (deal_outcome === "closed_won_simulated") return "Giao hàng và chăm sóc sau bán hàng";
  if (deal_outcome === "closed_lost") return "Tìm hiểu nguyên nhân từ chối / Lưu trữ khách hàng tiềm năng";
  if (deal_outcome === "stalled") return "Gửi ưu đãi đặc biệt hoặc thay đổi giải pháp tiếp cận";

  if (missing_topics.includes("product_model") || missing_topics.includes("configuration")) {
    return "Xác nhận cấu hình và tư vấn model cụ thể";
  }
  if (missing_topics.includes("price")) {
    return "Báo giá rõ ràng kèm chính sách ưu đãi";
  }
  if (missing_topics.includes("stock")) {
    return "Xác nhận tình trạng hàng sẵn và tồn kho";
  }
  if (missing_topics.includes("delivery")) {
    return "Đề xuất thời gian và phương thức giao hàng";
  }
  if (missing_topics.includes("payment")) {
    return "Cung cấp thông tin tài khoản chuyển khoản (STK)";
  }
  if (missing_topics.includes("invoice_or_document")) {
    return "Hỏi thông tin xuất hóa đơn công ty (VAT)";
  }

  if (deal_outcome === "ready_to_close") {
    return "Chủ động gửi thông tin thanh toán và đề xuất chốt đơn hàng";
  }

  return "Tương tác và làm rõ thêm nhu cầu khách hàng";
}

// MAIN ENTRY POINT FOR RUNTIME
export function processDealState(params: {
  progress: ConversationProgress;
  recent_turns: Array<{ role: "sale" | "customer_ai"; text: string }>;
  completion_ready: boolean;
  missing_topics: string[];
  product_context_status?: string; // Phase 12H.1-C
}): DealState {
  const lastCustomerTurn = [...params.recent_turns].reverse().find(t => t.role === "customer_ai");
  const lastCustomerText = lastCustomerTurn ? lastCustomerTurn.text : "";
  const lastSaleTurn = [...params.recent_turns].reverse().find(t => t.role === "sale");
  const lastSaleText = lastSaleTurn ? lastSaleTurn.text : "";

  // 1. Detect signals
  const buying_signals = detectCustomerBuyingSignals(lastCustomerText);
  const closing_signals = detectCustomerClosingSignals(lastCustomerText);
  const objection_signals = detectCustomerObjectionSignals(lastCustomerText);

  // 2. Evaluate Outcome
  const outcomeResult = evaluateDealOutcome({
    progress: params.progress,
    recent_turns: params.recent_turns,
    buying_signals,
    closing_signals,
    objection_signals,
    completion_ready: params.completion_ready,
    missing_topics: params.missing_topics,
    product_context_status: params.product_context_status
  });

  // 3. Evaluate End Session
  const endResult = shouldEndSession({
    deal_outcome: outcomeResult.deal_outcome,
    missing_topics: params.missing_topics,
    recent_turns: params.recent_turns
  });

  // 4. Evaluate Training Success
  const training_success = evaluateTrainingSuccess({
    deal_outcome: outcomeResult.deal_outcome,
    should_end_session: endResult.should_end_session,
    recent_turns_count: params.recent_turns.length
  });

  // 5. Next Best Action
  const next_best_action = getNextBestAction(outcomeResult.deal_outcome, params.missing_topics);

  return {
    buying_signals,
    closing_signals,
    objection_signals,
    deal_outcome: outcomeResult.deal_outcome,
    outcome_confidence: outcomeResult.outcome_confidence,
    should_end_session: endResult.should_end_session,
    end_reason: endResult.end_reason,
    next_best_action,
    training_success
  };
}

export function getTerminalReply(outcome: DealOutcome, identity: { customer_self_pronoun: string; customer_target_pronoun: string }): string | null {
  const self = identity.customer_self_pronoun;
  const selfCap = self.charAt(0).toUpperCase() + self.slice(1);
  const target = identity.customer_target_pronoun;
  
  if (outcome === "closed_won_simulated") {
    return `Ok ${target}, vậy ${target} gửi giúp ${self} thông tin thanh toán để ${self} chuyển khoản chốt luôn nhé.`;
  }
  if (outcome === "closed_lost") {
    return `Cảm ơn ${target}, để ${self} xem thêm hoặc cân nhắc lại rồi báo sau nhé.`;
  }
  if (outcome === "stalled") {
    return `Ok ${target}, để ${self} xem lại thông tin cấu hình rồi có gì nhắn lại sau nha.`;
  }
  if (outcome === "pending_approval") {
    return `${selfCap} sẽ trình lại thông tin này cho bộ phận nội bộ xem xét trước, có gì ${self} phản hồi ${target} sau nhé.`;
  }
  if (outcome === "payment_info_requested") {
    return `Ok ${target}, ${self} chốt mẫu này nhé. ${target} gửi giúp ${self} số tài khoản để ${self} thanh toán chuyển khoản nhé.`;
  }
  if (outcome === "hold_requested") {
    return `Vậy ${target} hỗ trợ giữ máy giúp ${self} nhé, để ${self} sắp xếp thanh toán sớm.`;
  }
  return null;
}
