import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

interface ClassifiedMessage {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content_type: string;
  text: string;
  raw_content: Record<string, unknown> | string | null;
  created_at: string;
  message_category: string;
  confidence: number;
}

interface SessionInput {
  session_id: string;
  conversation_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  message_count: number;
  sender_ids: string[];
  sender_names: string[];
  dominant_category: string;
  categories: Record<string, number>;
  content_types: Record<string, number>;
  avg_confidence: number;
  has_sales_signal: boolean;
  has_accounting_signal: boolean;
  has_internal_operation: boolean;
  has_persona_signal: boolean;
  messages: ClassifiedMessage[];
}

interface BehaviorSignal {
  signal_name: string;
  signal_family: string;
  confidence: number;
  evidence_strength: "weak" | "moderate" | "strong";
  evidence_message_ids: string[];
  evidence_texts: string[];
  trigger_rules: string[];
  why_triggered: string;
}

interface TimingFeatures {
  duration_minutes: number;
  avg_gap_minutes: number;
  min_gap_minutes: number;
  max_gap_minutes: number;
  gap_buckets: {
    "0-1m": number;
    "1-5m": number;
    "5-30m": number;
    "30m+": number;
  };
  has_reengagement_after_gap: boolean;
}

interface CommunicationFeatures {
  avg_text_length: number;
  max_text_length: number;
  min_text_length: number;
  short_ack_count: number;
  detailed_question_count: number;
  low_context_reply_count: number;
}

interface SessionBehaviorRecord {
  session_id: string;
  conversation_id: string;
  message_count: number;
  dominant_category: string;
  avg_confidence: number;
  timing_features: TimingFeatures;
  communication_features: CommunicationFeatures;
  behavior_signals: BehaviorSignal[];
}

interface Phase4Args {
  month: string;
}

interface Phase4RuntimeStats {
  invalid_date_count: number;
  sessions_with_missing_messages: number;
  invalid_json_line_count: number;
}

interface SummaryAccumulator {
  total_sessions: number;
  total_behavior_signals: number;
  signal_family_counts: Record<string, number>;
  signal_name_counts: Record<string, number>;
  sessions_with_sales_signals: number;
  sessions_with_operational_signals: number;
  sessions_with_logistics_signals: number;
  sessions_with_timing_signals: number;
}

interface AuditAccumulator {
  sessions_with_no_signals: number;
  weak_signal_count: number;
  contradictory_signal_count: number;
  low_evidence_signal_count: number;
  high_confidence_low_evidence_count: number;
  empty_evidence_text_count: number;
  weak_single_evidence_count: number;
  high_confidence_single_evidence_count: number;
  signal_session_presence: Record<string, number>;
}

const ACK_TERMS = [
  "dạ",
  "ok",
  "rồi",
  "vâng",
  "có rồi",
  "em gửi",
  "gửi rồi",
  "done",
  "ib",
  "yes",
  "👍"
];

const OPERATIONAL_CODE_RE = /\b[A-Z]{3}_[A-Z0-9]{2,5}_[A-Z]{2,3}_[A-Z0-9]+\b/g;
const ORDER_CODE_RE = /\bX[0-9]{9,}-[A-Z]\b/g;

function parseCliArgs(argv: string[]): Phase4Args {
  let month = "";
  for (const arg of argv) {
    if (arg.startsWith("--month=")) month = arg.slice("--month=".length);
  }
  if (!month && process.env.npm_config_month) month = process.env.npm_config_month;
  if (!month) throw new Error("Missing required arg: --month=YYYY-MM");
  return { month };
}

function safeJsonParse<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
}

function normalizeText(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function toMs(ts: string): number | null {
  if (!ts) return null;
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T");
  const v = Date.parse(iso);
  return Number.isNaN(v) ? null : v;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function incr(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function pickRawField(raw: Record<string, unknown> | string | null, key: string): string {
  if (!raw || typeof raw !== "object") return "";
  const v = raw[key];
  return v == null ? "" : String(v);
}

function messageSurfaceText(m: ClassifiedMessage): string {
  const title = pickRawField(m.raw_content, "title");
  const caption = pickRawField(m.raw_content, "caption");
  const fileName = pickRawField(m.raw_content, "fileName");
  return [m.text ?? "", title, caption, fileName].filter(Boolean).join(" ");
}

function containsAny(text: string, patterns: string[]): string[] {
  const norm = normalizeText(text);
  return patterns.filter((p) => norm.includes(normalizeText(p)));
}

function matchesAnyRegex(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function containsAlphabeticToken(text: string): boolean {
  return /[a-zA-ZÀ-ỹ]/.test(text);
}

function calcTimingFeatures(messages: ClassifiedMessage[], stats: Phase4RuntimeStats): TimingFeatures {
  const sorted = [...messages].sort((a, b) => {
    const ams = toMs(a.created_at) ?? 0;
    const bms = toMs(b.created_at) ?? 0;
    return ams - bms;
  });

  const timestamps: number[] = [];
  for (const m of sorted) {
    const ms = toMs(m.created_at);
    if (ms == null) {
      stats.invalid_date_count += 1;
      continue;
    }
    timestamps.push(ms);
  }

  let duration = 0;
  const gaps: number[] = [];
  if (timestamps.length >= 2) {
    duration = (timestamps[timestamps.length - 1] - timestamps[0]) / 60000;
    for (let i = 1; i < timestamps.length; i += 1) {
      gaps.push((timestamps[i] - timestamps[i - 1]) / 60000);
    }
  }

  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const minGap = gaps.length ? Math.min(...gaps) : 0;
  const maxGap = gaps.length ? Math.max(...gaps) : 0;

  const buckets = { "0-1m": 0, "1-5m": 0, "5-30m": 0, "30m+": 0 };
  for (const g of gaps) {
    if (g < 1) buckets["0-1m"] += 1;
    else if (g < 5) buckets["1-5m"] += 1;
    else if (g < 30) buckets["5-30m"] += 1;
    else buckets["30m+"] += 1;
  }

  return {
    duration_minutes: Number(duration.toFixed(4)),
    avg_gap_minutes: Number(avgGap.toFixed(4)),
    min_gap_minutes: Number(minGap.toFixed(4)),
    max_gap_minutes: Number(maxGap.toFixed(4)),
    gap_buckets: buckets,
    has_reengagement_after_gap: gaps.some((g) => g >= 30)
  };
}

function hasStrongContextKeyword(text: string): boolean {
  const strongKeywords = [
    "xin gia",
    "bao gia",
    "gia",
    "con hang",
    "ton kho",
    "bao hanh",
    "model",
    "ma",
    "unc",
    "tod",
    "cod",
    "duyet phieu",
    "coc",
    "treo don",
    "xin ma khach",
    "kho",
    "xuat kho",
    "giao",
    "van chuyen",
    "vat",
    "co cq",
    "check tien"
  ];
  const norm = normalizeText(text);
  return strongKeywords.some((k) => norm.includes(k));
}

function isShortAck(text: string): boolean {
  const norm = normalizeText(text).trim();
  if (!norm) return false;
  return ACK_TERMS.some((t) => norm === normalizeText(t));
}

function isDetailedQuestion(text: string): boolean {
  const norm = normalizeText(text);
  return (
    text.length > 80 &&
    (text.includes("?") ||
      norm.includes("khong") ||
      norm.includes("chua") ||
      norm.includes("sao") ||
      norm.includes("the nao"))
  );
}

function calcCommunicationFeatures(messages: ClassifiedMessage[]): CommunicationFeatures {
  const texts = messages.map((m) => (m.text ?? "").trim());
  const lengths = texts.map((t) => t.length);
  const avgLen = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const maxLen = lengths.length ? Math.max(...lengths) : 0;
  const minLen = lengths.length ? Math.min(...lengths) : 0;

  let shortAckCount = 0;
  let detailedQuestionCount = 0;
  let lowContextReplyCount = 0;

  for (const t of texts) {
    if (isShortAck(t)) shortAckCount += 1;
    if (isDetailedQuestion(t)) detailedQuestionCount += 1;
    if (
      t.length > 0 &&
      t.length <= 15 &&
      containsAlphabeticToken(t) &&
      !isShortAck(t) &&
      !hasStrongContextKeyword(t)
    ) {
      lowContextReplyCount += 1;
    }
  }

  return {
    avg_text_length: Number(avgLen.toFixed(4)),
    max_text_length: maxLen,
    min_text_length: minLen,
    short_ack_count: shortAckCount,
    detailed_question_count: detailedQuestionCount,
    low_context_reply_count: lowContextReplyCount
  };
}

function evidenceStrengthForSignal(
  signalName: string,
  evidenceCount: number,
  triggerRules: string[]
): "weak" | "moderate" | "strong" {
  const strongSignals = new Set([
    "operational_code_present",
    "sends_unc",
    "requests_tod_removal"
  ]);
  if (strongSignals.has(signalName)) return "strong";
  if (
    triggerRules.some(
      (r) =>
        normalizeText(r).includes("unc") ||
        normalizeText(r).includes("gỡ tod") ||
        normalizeText(r).includes("gỡ cod")
    )
  ) {
    return "strong";
  }
  if (evidenceCount >= 2) return "moderate";
  return "weak";
}

function signalConfidence(
  signalName: string,
  base: number,
  evidenceCount: number,
  weak: boolean,
  forceLowCap = false
): number {
  const boosted = base + Math.max(0, evidenceCount - 1) * 0.1;
  let capped = clamp(boosted, 0, 1);
  if (weak) capped = Math.min(capped, 0.55);
  if (forceLowCap) capped = Math.min(capped, 0.35);
  const strongSingleAllowed = new Set([
    "operational_code_present",
    "sends_unc",
    "requests_tod_removal"
  ]);
  if (evidenceCount <= 1 && !strongSingleAllowed.has(signalName)) {
    capped = Math.min(capped, 0.8);
  }
  return Number(capped.toFixed(4));
}

function makeSignal(
  name: string,
  family: string,
  evidence: Array<{ id: string; text: string; rules: string[] }>,
  baseConfidence: number,
  weak: boolean,
  why: string,
  forceLowCap = false
): BehaviorSignal {
  const evidenceMessageIds = Array.from(new Set(evidence.map((e) => e.id)));
  const evidenceTexts = Array.from(new Set(evidence.map((e) => e.text))).slice(0, 10);
  const triggerRules = Array.from(new Set(evidence.flatMap((e) => e.rules)));
  const strength = evidenceStrengthForSignal(name, evidenceMessageIds.length, triggerRules);
  return {
    signal_name: name,
    signal_family: family,
    confidence: signalConfidence(
      name,
      baseConfidence,
      evidenceMessageIds.length,
      weak,
      forceLowCap
    ),
    evidence_strength: strength,
    evidence_message_ids: evidenceMessageIds,
    evidence_texts: evidenceTexts,
    trigger_rules: triggerRules,
    why_triggered: `${why}; evidence_count=${evidenceMessageIds.length}`
  };
}

function extractSignals(
  session: SessionInput,
  timing: TimingFeatures,
  comm: CommunicationFeatures
): BehaviorSignal[] {
  const evidenceMap: Record<string, Array<{ id: string; text: string; rules: string[] }>> = {};

  function addEvidence(signal: string, id: string, text: string, rules: string[]): void {
    evidenceMap[signal] = evidenceMap[signal] ?? [];
    evidenceMap[signal].push({ id, text, rules });
  }

  const salesPriceIntent = [
    "xin giá",
    "báo giá",
    "cho giá",
    "giá bao nhiêu",
    "giá sao",
    "giá tốt không"
  ];
  const salesPriceNegative = ["giảm cọc", "hoàn cọc", "cọc"];
  const salesStock = ["còn hàng", "hết kho", "có hàng", "tồn kho"];
  const salesWarranty = ["bảo hành"];
  const bulkPurchase = ["số lượng", "lấy mấy cái", "lấy khoảng", "mua nhiều"];
  const productInquiry = ["model", "mã này", "thinkpad", "lenovo", "dell", "hp", "máy in", "laptop"];
  const productInquiryIntent = ["?", "có mã", "mã này", "cho em xin", "còn mã", "model nào"];

  const sendsUnc = ["unc"];
  const paymentCheckStrong = [
    "check tiền",
    "có tiền",
    "chưa có tiền",
    "vô tiền",
    "vào tiền",
    "nhận được tiền",
    "chuyển khoản",
    "ck chưa",
    "ck rồi"
  ];
  const paymentCheckWeak = ["ck"];
  const todRemoval = ["gỡ tod", "gỡ cod"];
  const internalCoord = ["duyệt phiếu", "cọc", "treo đơn", "xin mã khách", "nhập ủng hộ"];

  const warehouseCoord = ["kho", "xuất kho", "còn kho", "hết kho"];
  const deliveryFollowup = ["giao", "giao hàng", "lịch chi", "vận chuyển"];
  const docRequest = ["xuất hóa đơn", "co cq", "vat"];

  let operationalCodeCount = 0;
  let paymentRelatedCount = 0;
  let productInquiryCount = 0;

  for (const m of session.messages) {
    const surface = messageSurfaceText(m);
    const normSurface = normalizeText(surface);
    const snippet = surface.slice(0, 180);

    const priceIntentRules = containsAny(surface, salesPriceIntent);
    const priceNegativeRules = containsAny(surface, salesPriceNegative);
    const hasPriceIntent = priceIntentRules.length > 0 && priceNegativeRules.length === 0;
    const stockRules = containsAny(surface, salesStock);
    const warrantyRules = containsAny(surface, salesWarranty);
    const bulkRules = containsAny(surface, bulkPurchase);
    const productRules = containsAny(surface, productInquiry);
    const productIntentRules = containsAny(surface, productInquiryIntent);
    const hasProductInquiry = productRules.length > 0 && productIntentRules.length > 0;

    if (hasPriceIntent) addEvidence("asks_price", m.message_id, snippet, priceIntentRules);
    if (stockRules.length) addEvidence("asks_stock", m.message_id, snippet, stockRules);
    if (warrantyRules.length) addEvidence("asks_warranty", m.message_id, snippet, warrantyRules);
    if (bulkRules.length) addEvidence("bulk_purchase_signal", m.message_id, snippet, bulkRules);
    if (hasProductInquiry) {
      addEvidence(
        "product_model_inquiry",
        m.message_id,
        snippet,
        [...productRules, ...productIntentRules]
      );
      productInquiryCount += 1;
    }

    const uncRules = containsAny(surface, sendsUnc);
    const paymentStrongRules = containsAny(surface, paymentCheckStrong);
    const paymentWeakRules = containsAny(surface, paymentCheckWeak);
    const hasPaymentContext = paymentStrongRules.length > 0;
    const todRules = containsAny(surface, todRemoval);
    const coordRules = containsAny(surface, internalCoord);

    if (uncRules.length) addEvidence("sends_unc", m.message_id, snippet, uncRules);
    if (
      hasPaymentContext ||
      (paymentWeakRules.length > 0 && /ck\\s*(chua|roi)/i.test(normSurface))
    ) {
      const rules = hasPaymentContext ? paymentStrongRules : ["ck contextualized"];
      addEvidence("requests_payment_check", m.message_id, snippet, rules);
      paymentRelatedCount += 1;
    }
    if (todRules.length) {
      addEvidence("requests_tod_removal", m.message_id, snippet, todRules);
      paymentRelatedCount += 1;
    }
    if (coordRules.length) addEvidence("internal_coordination", m.message_id, snippet, coordRules);

    const whRules = containsAny(surface, warehouseCoord);
    const deliveryRules = containsAny(surface, deliveryFollowup);
    const docRules = containsAny(surface, docRequest);

    if (whRules.length) addEvidence("warehouse_coordination", m.message_id, snippet, whRules);
    if (deliveryRules.length) addEvidence("delivery_followup", m.message_id, snippet, deliveryRules);
    if (docRules.length) addEvidence("document_request", m.message_id, snippet, docRules);

    const opCodeHits = [...surface.matchAll(OPERATIONAL_CODE_RE), ...surface.matchAll(ORDER_CODE_RE)];
    if (opCodeHits.length > 0) {
      operationalCodeCount += opCodeHits.length;
      addEvidence(
        "operational_code_present",
        m.message_id,
        snippet,
        opCodeHits.map((h) => h[0])
      );
    }

    if (isShortAck(m.text ?? "")) {
      addEvidence("short_ack", m.message_id, snippet, ["ack_dictionary"]);
    }
    if (isDetailedQuestion(m.text ?? "")) {
      addEvidence("detailed_question", m.message_id, snippet, [
        "len>80",
        "question_or_interrogative"
      ]);
    }
    const trimmed = (m.text ?? "").trim();
    const hasOpCode = matchesAnyRegex(surface, [OPERATIONAL_CODE_RE, ORDER_CODE_RE]);
    const blockedTerms = [
      "unc",
      "tod",
      "cod",
      "kho",
      "giao",
      "giá",
      "báo giá",
      "model",
      "mã",
      "check tiền"
    ];
    const hasBlocked = containsAny(surface, blockedTerms).length > 0;
    const hasAlphabetic = containsAlphabeticToken(trimmed);
    const isContextLightReply =
      trimmed.length > 0 &&
      trimmed.length <= 15 &&
      hasAlphabetic &&
      !isShortAck(trimmed) &&
      !hasOpCode &&
      !hasStrongContextKeyword(normSurface) &&
      !hasBlocked;
    if (isContextLightReply) {
      addEvidence("low_context_reply", m.message_id, snippet, [
        "context_light_reply",
        "len<=15",
        "no_strong_keyword"
      ]);
    }
  }

  const signals: BehaviorSignal[] = [];

  function pushIfExists(
    name: string,
    family: string,
    base: number,
    weak: boolean,
    why: string,
    lowCap = false
  ): void {
    const ev = evidenceMap[name] ?? [];
    if (ev.length === 0) return;
    signals.push(makeSignal(name, family, ev, base, weak, why, lowCap));
  }

  pushIfExists("asks_price", "sales", 0.5, true, "Sales price intent matched");
  pushIfExists("asks_stock", "sales", 0.5, true, "Stock inquiry matched");
  pushIfExists("asks_warranty", "sales", 0.5, true, "Warranty inquiry matched");
  pushIfExists("bulk_purchase_signal", "sales", 0.52, true, "Bulk purchase phrasing matched");
  pushIfExists("product_model_inquiry", "sales", 0.55, true, "Product/model inquiry matched");

  pushIfExists("sends_unc", "operational", 0.9, false, "UNC transfer evidence matched");
  {
    const ev = evidenceMap.requests_payment_check ?? [];
    if (ev.length > 0) {
      const hasStrongPaymentPhrase = ev.some((e) =>
        e.rules.some((r) => {
          const n = normalizeText(r);
          return (
            n.includes("check tien") ||
            n.includes("co tien") ||
            n.includes("chua co tien") ||
            n.includes("vo tien") ||
            n.includes("vao tien") ||
            n.includes("nhan duoc tien") ||
            n.includes("chuyen khoan") ||
            n.includes("ck chua") ||
            n.includes("ck roi")
          );
        })
      );
      signals.push(
        makeSignal(
          "requests_payment_check",
          "operational",
          ev,
          hasStrongPaymentPhrase ? 0.85 : 0.55,
          !hasStrongPaymentPhrase,
          "Payment check language matched"
        )
      );
    }
  }
  pushIfExists("requests_tod_removal", "operational", 0.9, false, "TOD/COD removal request matched");
  pushIfExists("internal_coordination", "operational", 0.8, false, "Internal coordination actions matched");
  pushIfExists("operational_code_present", "operational", 0.9, false, "Operational/order code regex matched");

  pushIfExists("warehouse_coordination", "logistics", 0.58, true, "Warehouse coordination terms matched");
  pushIfExists("delivery_followup", "logistics", 0.58, true, "Delivery follow-up terms matched");
  pushIfExists("document_request", "logistics", 0.58, true, "Document request terms matched");

  pushIfExists("short_ack", "communication", 0.32, true, "Short acknowledgement detected", true);
  pushIfExists("detailed_question", "communication", 0.55, true, "Detailed question pattern detected");
  pushIfExists("low_context_reply", "communication", 0.25, true, "Low-context short reply detected", true);

  if (timing.avg_gap_minutes > 0 && timing.avg_gap_minutes <= 1 && session.message_count >= 4) {
    const ev = session.messages.slice(0, 3).map((m) => ({
      id: m.message_id,
      text: (m.text ?? "").slice(0, 120),
      rules: ["avg_gap<=1"]
    }));
    signals.push(
      makeSignal(
        "high_frequency_exchange",
        "timing",
        ev,
        0.62,
        false,
        "Average gap indicates high-frequency exchange"
      )
    );
  }
  if (timing.avg_gap_minutes >= 5) {
    const ev = session.messages.slice(0, 3).map((m) => ({
      id: m.message_id,
      text: (m.text ?? "").slice(0, 120),
      rules: ["avg_gap>=5"]
    }));
    signals.push(
      makeSignal(
        "slow_paced_exchange",
        "timing",
        ev,
        0.62,
        false,
        "Average gap indicates slow-paced exchange"
      )
    );
  }
  if (timing.has_reengagement_after_gap) {
    const ev = session.messages.slice(0, 3).map((m) => ({
      id: m.message_id,
      text: (m.text ?? "").slice(0, 120),
      rules: ["any_gap>=30m"]
    }));
    signals.push(
      makeSignal(
        "reengagement_after_gap",
        "timing",
        ev,
        0.72,
        false,
        "Detected re-engagement after long gap"
      )
    );
  }

  if (session.message_count >= 10) {
    const ev = session.messages.slice(0, 3).map((m) => ({
      id: m.message_id,
      text: (m.text ?? "").slice(0, 120),
      rules: ["message_count>=10"]
    }));
    signals.push(
      makeSignal(
        "long_session",
        "session_structure",
        ev,
        0.68,
        false,
        "Long session threshold reached"
      )
    );
  }

  const hasOperational = [
    "sends_unc",
    "requests_payment_check",
    "requests_tod_removal",
    "internal_coordination",
    "operational_code_present"
  ].some((n) => (evidenceMap[n] ?? []).length > 0);
  const hasLogOrSales = [
    "warehouse_coordination",
    "delivery_followup",
    "document_request",
    "asks_price",
    "asks_stock",
    "product_model_inquiry",
    "bulk_purchase_signal"
  ].some((n) => (evidenceMap[n] ?? []).length > 0);
  if (hasOperational && hasLogOrSales) {
    const ev = session.messages.slice(0, 4).map((m) => ({
      id: m.message_id,
      text: (m.text ?? "").slice(0, 120),
      rules: ["operational+logistics_or_sales"]
    }));
    signals.push(
      makeSignal(
        "mixed_operation_session",
        "session_structure",
        ev,
        0.7,
        false,
        "Both operational and logistics/sales evidence present"
      )
    );
  }

  if (operationalCodeCount > 1) {
    const ev = evidenceMap.operational_code_present ?? [];
    signals.push(
      makeSignal(
        "repeated_operational_code_session",
        "session_structure",
        ev,
        0.86,
        false,
        "Operational codes repeated in session"
      )
    );
  }
  if (paymentRelatedCount > 1) {
    const ev = [
      ...(evidenceMap.requests_payment_check ?? []),
      ...(evidenceMap.requests_tod_removal ?? [])
    ];
    signals.push(
      makeSignal(
        "repeated_payment_followup_session",
        "session_structure",
        ev,
        0.84,
        false,
        "Payment follow-up signals repeated"
      )
    );
  }
  if (productInquiryCount > 1) {
    const ev = evidenceMap.product_model_inquiry ?? [];
    signals.push(
      makeSignal(
        "repeated_product_inquiry_session",
        "session_structure",
        ev,
        0.7,
        false,
        "Product inquiry repeated"
      )
    );
  }

  void comm;
  return signals;
}

function createSummaryAccumulator(): SummaryAccumulator {
  return {
    total_sessions: 0,
    total_behavior_signals: 0,
    signal_family_counts: {},
    signal_name_counts: {},
    sessions_with_sales_signals: 0,
    sessions_with_operational_signals: 0,
    sessions_with_logistics_signals: 0,
    sessions_with_timing_signals: 0
  };
}

function updateSummaryAccumulator(acc: SummaryAccumulator, record: SessionBehaviorRecord): void {
  acc.total_sessions += 1;
  acc.total_behavior_signals += record.behavior_signals.length;

  let hasSales = false;
  let hasOp = false;
  let hasLog = false;
  let hasTiming = false;

  for (const signal of record.behavior_signals) {
    incr(acc.signal_family_counts, signal.signal_family, 1);
    incr(acc.signal_name_counts, signal.signal_name, 1);
    if (signal.signal_family === "sales") hasSales = true;
    if (signal.signal_family === "operational") hasOp = true;
    if (signal.signal_family === "logistics") hasLog = true;
    if (signal.signal_family === "timing") hasTiming = true;
  }

  if (hasSales) acc.sessions_with_sales_signals += 1;
  if (hasOp) acc.sessions_with_operational_signals += 1;
  if (hasLog) acc.sessions_with_logistics_signals += 1;
  if (hasTiming) acc.sessions_with_timing_signals += 1;
}

function finalizeSummary(acc: SummaryAccumulator): Record<string, unknown> {
  const topSignals = Object.entries(acc.signal_name_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([signal_name, count]) => ({ signal_name, count }));

  return {
    total_sessions: acc.total_sessions,
    total_behavior_signals: acc.total_behavior_signals,
    signal_family_counts: acc.signal_family_counts,
    signal_name_counts: acc.signal_name_counts,
    avg_signals_per_session: acc.total_sessions
      ? Number((acc.total_behavior_signals / acc.total_sessions).toFixed(4))
      : 0,
    top_signals: topSignals,
    sessions_with_sales_signals: acc.sessions_with_sales_signals,
    sessions_with_operational_signals: acc.sessions_with_operational_signals,
    sessions_with_logistics_signals: acc.sessions_with_logistics_signals,
    sessions_with_timing_signals: acc.sessions_with_timing_signals
  };
}

function createAuditAccumulator(): AuditAccumulator {
  return {
    sessions_with_no_signals: 0,
    weak_signal_count: 0,
    contradictory_signal_count: 0,
    low_evidence_signal_count: 0,
    high_confidence_low_evidence_count: 0,
    empty_evidence_text_count: 0,
    weak_single_evidence_count: 0,
    high_confidence_single_evidence_count: 0,
    signal_session_presence: {}
  };
}

function updateAuditAccumulator(acc: AuditAccumulator, record: SessionBehaviorRecord): void {
  if (record.behavior_signals.length === 0) acc.sessions_with_no_signals += 1;

  const names = new Set(record.behavior_signals.map((s) => s.signal_name));
  if (names.has("high_frequency_exchange") && names.has("slow_paced_exchange")) {
    acc.contradictory_signal_count += 1;
  }

  const presentNames = new Set<string>();
  for (const signal of record.behavior_signals) {
    presentNames.add(signal.signal_name);
    if (signal.confidence <= 0.55) acc.weak_signal_count += 1;
    if (signal.evidence_message_ids.length <= 1) acc.low_evidence_signal_count += 1;
    if (signal.confidence >= 0.85 && signal.evidence_message_ids.length <= 1) {
      acc.high_confidence_low_evidence_count += 1;
    }
    if ((signal.evidence_texts ?? []).some((t) => !String(t ?? "").trim())) {
      acc.empty_evidence_text_count += 1;
    }
    if (signal.evidence_strength === "weak" && signal.evidence_message_ids.length <= 1) {
      acc.weak_single_evidence_count += 1;
    }
    if (signal.confidence >= 0.85 && signal.evidence_message_ids.length <= 1) {
      acc.high_confidence_single_evidence_count += 1;
    }
  }

  for (const name of presentNames) {
    incr(acc.signal_session_presence, name, 1);
  }
}

function finalizeAudit(
  acc: AuditAccumulator,
  summaryAcc: SummaryAccumulator,
  stats: Phase4RuntimeStats
): Record<string, unknown> {
  const overTriggeredCounts: Record<string, number> = {};
  const threshold = summaryAcc.total_sessions * 0.3;
  for (const [name, cnt] of Object.entries(acc.signal_session_presence)) {
    if (cnt > threshold) overTriggeredCounts[name] = cnt;
  }

  const riskFlagsSummary = {
    no_signal_sessions: acc.sessions_with_no_signals,
    high_confidence_low_evidence: acc.high_confidence_low_evidence_count,
    invalid_dates: stats.invalid_date_count,
    missing_messages_sessions: stats.sessions_with_missing_messages
  };

  const signalPrecisionWarnings: string[] = [];
  if ((overTriggeredCounts.low_context_reply ?? 0) > summaryAcc.total_sessions * 0.3) {
    signalPrecisionWarnings.push("low_context_reply appears over-triggered");
  }
  if ((overTriggeredCounts.asks_price ?? 0) > summaryAcc.total_sessions * 0.25) {
    signalPrecisionWarnings.push("asks_price appears over-triggered");
  }
  if (acc.high_confidence_single_evidence_count > 0) {
    signalPrecisionWarnings.push("high-confidence single-evidence signals remain");
  }

  return {
    total_sessions: summaryAcc.total_sessions,
    sessions_with_no_signals: acc.sessions_with_no_signals,
    weak_signal_count: acc.weak_signal_count,
    contradictory_signal_count: acc.contradictory_signal_count,
    low_evidence_signal_count: acc.low_evidence_signal_count,
    high_confidence_low_evidence_count: acc.high_confidence_low_evidence_count,
    empty_evidence_text_count: acc.empty_evidence_text_count,
    weak_single_evidence_count: acc.weak_single_evidence_count,
    high_confidence_single_evidence_count: acc.high_confidence_single_evidence_count,
    over_triggered_signal_counts: overTriggeredCounts,
    signal_precision_warnings: signalPrecisionWarnings,
    risk_flags_summary: riskFlagsSummary,
    invalid_date_count: stats.invalid_date_count,
    sessions_with_missing_messages: stats.sessions_with_missing_messages
  };
}

async function backupExistingPhase4Output(
  dataDir: string,
  month: string,
  outDir: string
): Promise<string | null> {
  if (!fs.existsSync(outDir)) return null;

  const existingFiles = await fs.promises.readdir(outDir);
  if (existingFiles.length === 0) return null;

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "_");
  const backupRoot = path.join(
    dataDir,
    "_backup",
    `phase4_stale_before_stream_fix_${month}_${timestamp}`
  );
  const backupTarget = path.join(backupRoot, "04_behavior", month);

  await fs.promises.mkdir(path.dirname(backupTarget), { recursive: true });
  await fs.promises.cp(outDir, backupTarget, { recursive: true });
  await fs.promises.rm(outDir, { recursive: true, force: true });
  return backupTarget;
}

async function runPhase4(args: Phase4Args): Promise<void> {
  const dataDir = path.resolve("sale-testlab-data");
  const inputPath = path.join(dataDir, "03_sessions", args.month, "sessions.jsonl");
  const outDir = path.join(dataDir, "04_behavior", args.month);
  const signalsPath = path.join(outDir, "behavior_signals.jsonl");
  const summaryPath = path.join(outDir, "behavior_summary.json");
  const auditPath = path.join(outDir, "behavior_audit.json");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const backupTarget = await backupExistingPhase4Output(dataDir, args.month, outDir);

  const runtimeStats: Phase4RuntimeStats = {
    invalid_date_count: 0,
    sessions_with_missing_messages: 0,
    invalid_json_line_count: 0
  };

  const summaryAcc = createSummaryAccumulator();
  const auditAcc = createAuditAccumulator();

  await fs.promises.mkdir(outDir, { recursive: true });
  const outputStream = fs.createWriteStream(signalsPath, { encoding: "utf8" });
  const inputStream = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  try {
    for await (const rawLine of rl) {
      const line = rawLine.trim();
      if (!line) continue;

      const session = safeJsonParse<SessionInput>(line);
      if (!session) {
        runtimeStats.invalid_json_line_count += 1;
        continue;
      }

      let record: SessionBehaviorRecord;
      if (!Array.isArray(session.messages) || session.messages.length === 0) {
        runtimeStats.sessions_with_missing_messages += 1;
        record = {
          session_id: session.session_id,
          conversation_id: session.conversation_id,
          message_count: session.message_count ?? 0,
          dominant_category: session.dominant_category ?? "unknown",
          avg_confidence: session.avg_confidence ?? 0,
          timing_features: {
            duration_minutes: 0,
            avg_gap_minutes: 0,
            min_gap_minutes: 0,
            max_gap_minutes: 0,
            gap_buckets: { "0-1m": 0, "1-5m": 0, "5-30m": 0, "30m+": 0 },
            has_reengagement_after_gap: false
          },
          communication_features: {
            avg_text_length: 0,
            max_text_length: 0,
            min_text_length: 0,
            short_ack_count: 0,
            detailed_question_count: 0,
            low_context_reply_count: 0
          },
          behavior_signals: []
        };
      } else {
        const timing = calcTimingFeatures(session.messages, runtimeStats);
        const communication = calcCommunicationFeatures(session.messages);
        const behaviorSignals = extractSignals(session, timing, communication);

        record = {
          session_id: session.session_id,
          conversation_id: session.conversation_id,
          message_count: session.message_count,
          dominant_category: session.dominant_category,
          avg_confidence: session.avg_confidence,
          timing_features: timing,
          communication_features: communication,
          behavior_signals: behaviorSignals
        };
      }

      updateSummaryAccumulator(summaryAcc, record);
      updateAuditAccumulator(auditAcc, record);

      const serialized = `${JSON.stringify(record)}\n`;
      if (!outputStream.write(serialized, "utf8")) {
        await new Promise<void>((resolve) => outputStream.once("drain", resolve));
      }
    }
  } finally {
    rl.close();
  }

  await new Promise<void>((resolve, reject) => {
    outputStream.on("error", reject);
    outputStream.on("finish", resolve);
    outputStream.end();
  });

  const summary = finalizeSummary(summaryAcc);
  const audit = finalizeAudit(auditAcc, summaryAcc, runtimeStats);

  await fs.promises.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  for (const p of [signalsPath, summaryPath, auditPath]) {
    if (!fs.existsSync(p)) throw new Error(`Output file missing: ${p}`);
    const stat = fs.statSync(p);
    console.log(`[PHASE4_FILE] ${path.basename(p)} size=${stat.size}`);
  }
  if (backupTarget) {
    console.log(`[PHASE4_BACKUP] ${backupTarget}`);
  }

  console.log("[PHASE4_SUMMARY]");
  console.log(
    JSON.stringify(
      {
        total_sessions: summary.total_sessions,
        total_behavior_signals: summary.total_behavior_signals,
        avg_signals_per_session: summary.avg_signals_per_session,
        top_signals: summary.top_signals
      },
      null,
      2
    )
  );

  console.log("[PHASE4_AUDIT]");
  console.log(
    JSON.stringify(
      {
        total_sessions: audit.total_sessions,
        sessions_with_no_signals: audit.sessions_with_no_signals,
        weak_signal_count: audit.weak_signal_count,
        contradictory_signal_count: audit.contradictory_signal_count,
        low_evidence_signal_count: audit.low_evidence_signal_count,
        high_confidence_low_evidence_count: audit.high_confidence_low_evidence_count,
        invalid_json_line_count: runtimeStats.invalid_json_line_count,
        invalid_date_count: audit.invalid_date_count,
        sessions_with_missing_messages: audit.sessions_with_missing_messages
      },
      null,
      2
    )
  );
}

runPhase4(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[ERROR] Phase4 failed: ${message}`);
  process.exitCode = 1;
});
