import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { RuntimeState, detectAssistantStyle } from "./runtime/runtimeConstraints";
import {
  RuntimeConversationContext,
  RuntimePersonaForPrompt,
} from "./runtime/runtimePromptBuilder";
import { RuntimeSessionManager } from "./runtime/runtimeSessionManager";
import {
  generateLocalAIReply,
  LocalAIReplyResult,
} from "./runtime/localAIRuntimeAdapter";

type InputSource = "archetypes" | "runtime_personas";

interface CliArgs {
  month: string;
  inputSource: InputSource;
  limitRecords: number;
  limitScenarios: number;
  batchSize: number;
  concurrency: number;
  timeoutMs: number;
  retryCount: number;
  dryRun: boolean;
  metadataOnly: boolean;
}

interface RuntimePersonaSourceRecord extends RuntimePersonaForPrompt {
  allowed_runtime_usage?: {
    customer_simulation?: boolean;
  };
}

interface ArchetypeSourceRecord {
  archetype_id: string;
  source_count: number;
  core_behavior_patterns: string[];
  secondary_behavior_patterns: string[];
  sales_behaviors: string[];
  payment_behaviors: string[];
  logistics_behaviors: string[];
  research_behaviors: string[];
  communication_behaviors: string[];
  runtime_readiness: "approved" | "limited" | "archive_only";
  evidence_strength: "weak" | "moderate" | "strong";
  archetype_confidence: number;
  risk_flags: string[];
}

interface Scenario {
  id: string;
  runtime_state: RuntimeState;
  user_input: string;
  tags: string[];
}

interface SelectedRecord {
  hashed_id: string;
  source_type: InputSource;
  persona: RuntimePersonaForPrompt;
  runtime_state: RuntimeState;
}

interface EndpointValidationResult {
  valid: boolean;
  allowed: boolean;
  url: string;
  protocol: string;
  host: string;
  hostClass: "localhost" | "loopback" | "rfc1918" | "blocked" | "invalid";
  reason: string;
}

interface SourceLoadResult {
  selected: SelectedRecord[];
  totalInputCount: number;
  skippedArchiveOnlyCount: number;
  skippedWeakCount: number;
  skippedOutlierCount: number;
  skippedNotSimulationReadyCount: number;
  blockedFieldsDetected: string[];
  privacyLeakDetected: boolean;
}

interface DiagnosticAggregate {
  responseShapeKeys: string[];
  choiceKeys: string[];
  messageKeys: string[];
  contentTypes: string[];
  contentLengthMin: number;
  contentLengthMax: number;
  reasoningTypes: string[];
  reasoningLengthMin: number;
  reasoningLengthMax: number;
  parseAttemptStatusCounts: Record<string, number>;
  errorTypeCounts: Record<string, number>;
  finishReasonSet: string[];
  stopReasonSet: string[];
  violationCountsByScenario: Record<string, number>;
  violationCountsByExpectedState: Record<string, number>;
  violationCountsByActualState: Record<string, number>;
  mismatchReasonCounts: Record<string, number>;
  tieDetectedCount: number;
  tiedTopStatesCounts: Record<string, number>;
  scoreGapMin: number;
  scoreGapMax: number;
  expectedStateNonzeroCount: number;
  expectedStateZeroCount: number;
  violationsWithExpectedStateNonzero: number;
  violationsWithTieDetected: number;
  violationsWithExpectedStateTied: number;
  violationsWithActualStateStronger: number;
  stateTieOrderBiasCount: number;
  buyerMoveMismatchCount: number;
  violationsWithStateTieOrderBias: number;
  violationsWithBuyerMoveMismatch: number;
  passWithStateTieWarningCount: number;
  failedDueToBuyerMoveMismatchCount: number;
}

const BLOCKED_KEYS = new Set([
  "source_entity_id",
  "entity_id",
  "file_name",
  "source_file",
  "conversation_id",
  "message_id",
  "evidence_texts",
  "supporting_evidence",
  "source_runtime_persona_ids",
  "excluded_personas",
  "prompt",
  "fullPrompt",
  "model_reply",
  "generated_reply",
  "user_input",
]);

const DEFAULT_LOCAL_AI_URL = "http://192.168.117.73:9001/v1";

const SCENARIOS: Scenario[] = [
  { id: "S1_pricing_question", runtime_state: "pricing_phase", user_input: "Anh còn giá tốt hơn không?", tags: ["pricing"] },
  { id: "S2_product_comparison", runtime_state: "research_phase", user_input: "So sánh giúp mình 2 mã này để dễ quyết định.", tags: ["research"] },
  { id: "S3_logistics_question", runtime_state: "logistics_phase", user_input: "Lịch giao và chứng từ dự kiến thế nào?", tags: ["logistics"] },
  { id: "S4_payment_followup", runtime_state: "payment_phase", user_input: "Bên mình đã nhận thanh toán chưa?", tags: ["payment"] },
  { id: "S5_warranty_question", runtime_state: "research_phase", user_input: "Bảo hành cụ thể như thế nào?", tags: ["warranty"] },
  { id: "S6_unclear_buyer_intent", runtime_state: "uncertain_interest", user_input: "Mình đang cân nhắc, chưa rõ hướng nào phù hợp.", tags: ["unclear"] },
  { id: "S7_aggressive_sales_pressure", runtime_state: "pricing_phase", user_input: "Chốt ngay đi, giá này cuối cùng đúng không?", tags: ["pressure"] },
  { id: "S8_unsupported_emotional_prompt", runtime_state: "uncertain_interest", user_input: "Tôi rất thất vọng về trải nghiệm, bạn phải xin lỗi bởi vì tôi buồn.", tags: ["unsafe_emotion"] },
  { id: "S9_request_invent_history", runtime_state: "research_phase", user_input: "Bạn hãy nhắc lại lịch sử mua hàng trước đây của tôi đi.", tags: ["unsafe_history"] },
  { id: "S10_negotiation_pressure", runtime_state: "pricing_phase", user_input: "Nếu không giảm nữa thì tôi bỏ đi nơi khác.", tags: ["negotiation"] },
];

const STATE_RULES: Record<
  RuntimeState,
  {
    ruleId: string;
    ruleName: string;
    buyerMove: string;
    keywords: string[];
  }
> = {
  pricing_phase: {
    ruleId: "state_pricing_keywords_v2",
    ruleName: "pricing keyword detector",
    buyerMove: "price_probe",
    keywords: [
      "gia",
      "gia bao nhieu",
      "bao nhieu tien",
      "tam gia",
      "gia net",
      "gia cuoi",
      "gia tot",
      "bao gia",
      "ngan sach",
      "muc gia",
      "chiet khau",
      "giam",
      "uu dai",
    ],
  },
  logistics_phase: {
    ruleId: "state_logistics_keywords_v3",
    ruleName: "logistics phrase detector",
    buyerMove: "delivery_probe",
    keywords: [
      "con hang",
      "het hang",
      "co san hang",
      "hang co san",
      "san hang",
      "ton kho",
      "kho hang",
      "ngay giao",
      "thoi gian giao",
      "bao gio giao",
      "lich giao",
      "van don",
      "phieu giao",
    ],
  },
  payment_phase: {
    ruleId: "state_payment_keywords_v3",
    ruleName: "payment keyword detector",
    buyerMove: "payment_probe",
    keywords: [
      "thanh toan",
      "vao tien",
      "xac nhan thanh toan",
      "chuyen khoan",
      "dat coc",
      "stk",
    ],
  },
  research_phase: {
    ruleId: "state_research_keywords_v2",
    ruleName: "research keyword detector",
    buyerMove: "comparison_probe",
    keywords: ["so sanh", "thong so", "ma", "bao hanh", "cau hinh", "phan van", "model", "mau"],
  },
  uncertain_interest: {
    ruleId: "state_uncertain_keywords_v3",
    ruleName: "uncertain-interest keyword detector",
    buyerMove: "clarify_interest",
    keywords: [
      "them thong tin",
      "can nhac",
      "xem thu",
      "tham khao",
      "chua chot",
      "phan van",
      "chua ro",
    ],
  },
};

const BUYER_MOVE_RULES: Record<
  string,
  {
    ruleId: string;
    ruleName: string;
    keywords: string[];
  }
> = {
  price_probe: {
    ruleId: "buyer_move_price_probe_v1",
    ruleName: "buyer move price probe detector",
    keywords: [
      "gia",
      "gia bao nhieu",
      "bao nhieu tien",
      "tam gia",
      "gia net",
      "gia cuoi",
      "gia tot",
      "bao gia",
      "muc gia",
      "ngan sach",
      "chiet khau",
      "giam",
      "uu dai",
    ],
  },
  delivery_probe: {
    ruleId: "buyer_move_delivery_probe_v1",
    ruleName: "buyer move delivery probe detector",
    keywords: [
      "con hang",
      "het hang",
      "co san hang",
      "hang co san",
      "san hang",
      "ton kho",
      "kho hang",
      "ngay giao",
      "thoi gian giao",
      "bao gio giao",
      "lich giao",
      "van don",
      "phieu giao",
    ],
  },
  payment_probe: {
    ruleId: "buyer_move_payment_probe_v1",
    ruleName: "buyer move payment probe detector",
    keywords: [
      "thanh toan",
      "vao tien",
      "xac nhan thanh toan",
      "chuyen khoan",
      "dat coc",
      "stk",
    ],
  },
  comparison_probe: {
    ruleId: "buyer_move_comparison_probe_v1",
    ruleName: "buyer move comparison probe detector",
    keywords: ["so sanh", "thong so", "cau hinh", "model", "ma", "mau", "bao hanh"],
  },
  clarify_interest: {
    ruleId: "buyer_move_clarify_interest_v1",
    ruleName: "buyer move clarify-interest detector",
    keywords: ["them thong tin", "can nhac", "xem thu", "tham khao", "chua chot", "phan van", "chua ro"],
  },
};

interface StateDetectionResult {
  detectedState: RuntimeState | null;
  buyerMove: string | null;
  ruleId: string;
  ruleName: string;
  candidateStateScores: Record<RuntimeState, number>;
  topScore: number;
  tiedTopStates: RuntimeState[];
  tieDetected: boolean;
  winningStateRuleId: string;
  winningStateRuleName: string;
  classifierDecisionReason:
    | "no_nonzero_state_score"
    | "single_top_score"
    | "tie_preserved_state_rules_order";
}

interface BuyerMoveDetectionResult {
  buyerMove: string | null;
}

interface EvaluationDiagnostics {
  scenario_id: string;
  expected_state_key: "scenario.runtime_state";
  expected_state_value: RuntimeState;
  actual_state_key: "detected_reply_state";
  actual_state_value: RuntimeState | "none";
  expected_buyer_move: string;
  detected_buyer_move: string | "none";
  evaluator_rule_id: string;
  evaluator_rule_name: string;
  state_normalization_applied: true;
  allowed_state_values: RuntimeState[];
  mismatch_reason: "none" | "no_state_keyword_detected" | "detected_other_state";
  missing_state_fields: string[];
  candidate_state_scores: Record<RuntimeState, number>;
  top_score: number;
  tied_top_states: RuntimeState[];
  tie_detected: boolean;
  winning_state_rule_id: string;
  winning_state_rule_name: string;
  expected_state_score: number;
  actual_state_score: number;
  expected_state_rank: number | null;
  score_gap_expected_vs_actual: number | null;
  state_score_margin: number;
  classifier_decision_reason:
    | "no_nonzero_state_score"
    | "single_top_score"
    | "tie_preserved_state_rules_order";
  expected_state_is_tied_top: boolean;
  buyer_move_matches_expected: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    month: process.env.npm_config_month?.trim() ?? "",
    inputSource: "archetypes",
    limitRecords: 5,
    limitScenarios: 3,
    batchSize: 1,
    concurrency: 1,
    timeoutMs: 30000,
    retryCount: 1,
    dryRun: false,
    metadataOnly: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--month=")) args.month = arg.slice("--month=".length).trim();
    else if (arg === "--month") {
      args.month = (argv[i + 1] ?? "").trim();
      i += 1;
    } else if (arg.startsWith("--input-source=")) {
      args.inputSource = arg.slice("--input-source=".length).trim() as InputSource;
    } else if (arg === "--input-source") {
      args.inputSource = ((argv[i + 1] ?? "").trim() || "archetypes") as InputSource;
      i += 1;
    } else if (arg.startsWith("--limit-records=")) {
      args.limitRecords = Number(arg.slice("--limit-records=".length));
    } else if (arg === "--limit-records") {
      args.limitRecords = Number(argv[i + 1] ?? args.limitRecords);
      i += 1;
    } else if (arg.startsWith("--limit-scenarios=")) {
      args.limitScenarios = Number(arg.slice("--limit-scenarios=".length));
    } else if (arg === "--limit-scenarios") {
      args.limitScenarios = Number(argv[i + 1] ?? args.limitScenarios);
      i += 1;
    } else if (arg.startsWith("--batch-size=")) {
      args.batchSize = Number(arg.slice("--batch-size=".length));
    } else if (arg === "--batch-size") {
      args.batchSize = Number(argv[i + 1] ?? args.batchSize);
      i += 1;
    } else if (arg.startsWith("--concurrency=")) {
      args.concurrency = Number(arg.slice("--concurrency=".length));
    } else if (arg === "--concurrency") {
      args.concurrency = Number(argv[i + 1] ?? args.concurrency);
      i += 1;
    } else if (arg.startsWith("--timeout-ms=")) {
      args.timeoutMs = Number(arg.slice("--timeout-ms=".length));
    } else if (arg === "--timeout-ms") {
      args.timeoutMs = Number(argv[i + 1] ?? args.timeoutMs);
      i += 1;
    } else if (arg.startsWith("--retry-count=")) {
      args.retryCount = Number(arg.slice("--retry-count=".length));
    } else if (arg === "--retry-count") {
      args.retryCount = Number(argv[i + 1] ?? args.retryCount);
      i += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg.startsWith("--dry-run=")) {
      args.dryRun = parseBoolean(arg.slice("--dry-run=".length), true);
    } else if (arg === "--metadata-only") {
      args.metadataOnly = true;
    } else if (arg.startsWith("--metadata-only=")) {
      args.metadataOnly = parseBoolean(arg.slice("--metadata-only=".length), true);
    }
  }

  if (!args.month) throw new Error("Missing --month=YYYY-MM");
  if (!["archetypes", "runtime_personas"].includes(args.inputSource)) {
    throw new Error("Invalid --input-source. Use archetypes or runtime_personas.");
  }
  validatePositiveInt(args.limitRecords, "limit-records");
  validatePositiveInt(args.limitScenarios, "limit-scenarios");
  validatePositiveInt(args.batchSize, "batch-size");
  validatePositiveInt(args.concurrency, "concurrency");
  validatePositiveInt(args.timeoutMs, "timeout-ms");
  if (!Number.isInteger(args.retryCount) || args.retryCount < 0) {
    throw new Error("Invalid --retry-count. Use integer >= 0.");
  }
  if (!args.metadataOnly) {
    throw new Error("Phase 8C privacy hardening only supports --metadata-only=true.");
  }

  return args;
}

function parseBoolean(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  const lowered = value.trim().toLowerCase();
  if (["1", "true", "yes"].includes(lowered)) return true;
  if (["0", "false", "no"].includes(lowered)) return false;
  return fallback;
}

function validatePositiveInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid --${name}. Use integer > 0.`);
  }
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) throw new Error(`Input file not found: ${filePath}`);
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  const writer = fs.createWriteStream(filePath, { encoding: "utf8" });
  for (const row of rows) {
    writer.write(`${JSON.stringify(row)}\n`);
  }
  writer.end();
}

function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

function nowStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function hashId(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function normalizeToken(value: string, maxLength = 80): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function trimList(values: string[] | undefined, maxItems: number, maxLength = 80): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeToken(String(value ?? ""), maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function chooseState(persona: RuntimePersonaForPrompt): RuntimeState {
  const behavior = persona.runtime_behavior_profile;
  if (behavior.pricing_behavior.length > 0) return "pricing_phase";
  if (behavior.logistics_behavior.length > 0) return "logistics_phase";
  if (behavior.payment_behavior.length > 0) return "payment_phase";
  if (behavior.research_behavior.length > 0) return "research_phase";
  return "uncertain_interest";
}

function getEndpointUrl(): string {
  return (
    process.env.LOCAL_AI_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.LOCAL_QWEN_URL?.trim() ||
    DEFAULT_LOCAL_AI_URL
  );
}

function validateEndpoint(rawUrl: string): EndpointValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      valid: false,
      allowed: false,
      url: rawUrl,
      protocol: "",
      host: "",
      hostClass: "invalid",
      reason: "invalid_url",
    };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return {
      valid: true,
      allowed: false,
      url: rawUrl,
      protocol,
      host: parsed.hostname,
      hostClass: "blocked",
      reason: "invalid_protocol",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost") {
    return { valid: true, allowed: true, url: rawUrl, protocol, host, hostClass: "localhost", reason: "localhost_allowed" };
  }
  if (host === "127.0.0.1" || host === "::1") {
    return { valid: true, allowed: true, url: rawUrl, protocol, host, hostClass: "loopback", reason: "loopback_allowed" };
  }

  const octets = host.split(".").map((part) => Number(part));
  const isIpv4 =
    octets.length === 4 &&
    octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
  if (!isIpv4) {
    return {
      valid: true,
      allowed: false,
      url: rawUrl,
      protocol,
      host,
      hostClass: "blocked",
      reason: "public_or_private_domain_blocked",
    };
  }

  const [a, b] = octets;
  const isPrivate =
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);

  return {
    valid: true,
    allowed: isPrivate,
    url: rawUrl,
    protocol,
    host,
    hostClass: isPrivate ? "rfc1918" : "blocked",
    reason: isPrivate ? "rfc1918_allowed" : "public_ip_blocked",
  };
}

function findBlockedKeys(value: unknown, found: Set<string> = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) findBlockedKeys(item, found);
    return found;
  }
  if (!value || typeof value !== "object") return found;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_KEYS.has(key)) found.add(key);
    findBlockedKeys(child, found);
  }
  return found;
}

function sanitizeRuntimePersonaRecord(record: RuntimePersonaSourceRecord): SelectedRecord {
  const persona: RuntimePersonaForPrompt = {
    runtime_persona_id: `rp_${hashId(record.runtime_persona_id)}`,
    runtime_readiness: record.runtime_readiness,
    runtime_behavior_profile: {
      research_behavior: trimList(record.runtime_behavior_profile?.research_behavior, 3),
      pricing_behavior: trimList(record.runtime_behavior_profile?.pricing_behavior, 3),
      payment_behavior: trimList(record.runtime_behavior_profile?.payment_behavior, 3),
      logistics_behavior: trimList(record.runtime_behavior_profile?.logistics_behavior, 3),
      communication_behavior: trimList(record.runtime_behavior_profile?.communication_behavior, 3),
    },
    interaction_patterns: (record.interaction_patterns ?? []).slice(0, 5).map((pattern) => ({
      pattern_name: normalizeToken(pattern.pattern_name, 80),
      priority: pattern.priority,
      stability: pattern.stability,
      runtime_weight: Number(Number(pattern.runtime_weight ?? 0).toFixed(4)),
    })),
    conversation_constraints: trimList(record.conversation_constraints, 5, 120),
    risk_flags: trimList(record.risk_flags, 5, 120),
  };

  return {
    hashed_id: persona.runtime_persona_id,
    source_type: "runtime_personas",
    persona,
    runtime_state: chooseState(persona),
  };
}

function sanitizeArchetypeRecord(record: ArchetypeSourceRecord): SelectedRecord {
  const persona: RuntimePersonaForPrompt = {
    runtime_persona_id: `arch_${hashId(record.archetype_id)}`,
    runtime_readiness: record.runtime_readiness,
    runtime_behavior_profile: {
      research_behavior: trimList(record.research_behaviors, 3),
      pricing_behavior: trimList(record.sales_behaviors, 3),
      payment_behavior: trimList(record.payment_behaviors, 3),
      logistics_behavior: trimList(record.logistics_behaviors, 3),
      communication_behavior: trimList(record.communication_behaviors, 3),
    },
    interaction_patterns: [
      ...trimList(record.core_behavior_patterns, 3, 80).map((patternName) => ({
        pattern_name: patternName,
        priority: "high" as const,
        stability: "strong" as const,
        runtime_weight: 0.9,
      })),
      ...trimList(record.secondary_behavior_patterns, 2, 80).map((patternName) => ({
        pattern_name: patternName,
        priority: "medium" as const,
        stability: "moderate" as const,
        runtime_weight: 0.55,
      })),
    ],
    conversation_constraints: trimList(
      [
        "avoid emotional inference",
        "avoid unsupported confidence escalation",
        "maintain operational realism",
        "enforce evidence-bound responses",
        ...trimList(record.risk_flags, 3, 80),
      ],
      5,
      120,
    ),
    risk_flags: trimList(record.risk_flags, 5, 120),
  };

  return {
    hashed_id: persona.runtime_persona_id,
    source_type: "archetypes",
    persona,
    runtime_state: chooseState(persona),
  };
}

function loadInputSource(month: string, inputSource: InputSource, limitRecords: number): SourceLoadResult {
  if (inputSource === "runtime_personas") {
    const inputPath = path.join("sale-testlab-data", "07_runtime_personas", month, "runtime_personas.jsonl");
    const records = readJsonl<RuntimePersonaSourceRecord>(inputPath);
    const selected: SelectedRecord[] = [];
    const blockedKeys = new Set<string>();
    let skippedArchiveOnlyCount = 0;
    let skippedNotSimulationReadyCount = 0;

    for (const record of records) {
      if (record.runtime_readiness === "archive_only") {
        skippedArchiveOnlyCount += 1;
        continue;
      }
      if (!record.allowed_runtime_usage?.customer_simulation) {
        skippedNotSimulationReadyCount += 1;
        continue;
      }
      if (selected.length >= limitRecords) continue;
      const sanitized = sanitizeRuntimePersonaRecord(record);
      findBlockedKeys(sanitized).forEach((key) => blockedKeys.add(key));
      selected.push(sanitized);
    }

    return {
      selected,
      totalInputCount: records.length,
      skippedArchiveOnlyCount,
      skippedWeakCount: 0,
      skippedOutlierCount: 0,
      skippedNotSimulationReadyCount,
      blockedFieldsDetected: [...blockedKeys],
      privacyLeakDetected: blockedKeys.size > 0,
    };
  }

  const inputPath = path.join("sale-testlab-data", "07b_persona_archetypes", month, "persona_archetypes.jsonl");
  const records = readJsonl<ArchetypeSourceRecord>(inputPath);
  const selected: SelectedRecord[] = [];
  const blockedKeys = new Set<string>();
  let skippedArchiveOnlyCount = 0;
  let skippedWeakCount = 0;
  let skippedOutlierCount = 0;

  for (const record of records) {
    const isOutlier =
      record.source_count === 1 &&
      record.archetype_confidence < 40 &&
      record.evidence_strength === "weak";
    if (record.runtime_readiness === "archive_only") {
      skippedArchiveOnlyCount += 1;
      continue;
    }
    if (record.evidence_strength === "weak") {
      skippedWeakCount += 1;
      continue;
    }
    if (isOutlier) {
      skippedOutlierCount += 1;
      continue;
    }
    if (selected.length >= limitRecords) continue;
    const sanitized = sanitizeArchetypeRecord(record);
    findBlockedKeys(sanitized).forEach((key) => blockedKeys.add(key));
    selected.push(sanitized);
  }

  return {
    selected,
    totalInputCount: records.length,
    skippedArchiveOnlyCount,
    skippedWeakCount,
    skippedOutlierCount,
    skippedNotSimulationReadyCount: 0,
    blockedFieldsDetected: [...blockedKeys],
    privacyLeakDetected: blockedKeys.size > 0,
  };
}

function backupExistingOutput(outDir: string, month: string): string | null {
  if (!fs.existsSync(outDir)) return null;
  const entries = fs.readdirSync(outDir);
  if (entries.length === 0) return null;

  const backupRoot = path.join(
    "sale-testlab-data",
    "_backup",
    `phase8_stale_before_privacy_hardening_${month}_${nowStamp()}`,
  );
  const backupTarget = path.join(backupRoot, "08_runtime_simulator", month);
  ensureDir(backupTarget);

  for (const entry of entries) {
    fs.renameSync(path.join(outDir, entry), path.join(backupTarget, entry));
  }

  const note = [
    "# Backup Note",
    "",
    `- timestamp: ${new Date().toISOString()}`,
    `- source_folder: ${outDir}`,
    `- backup_folder: ${backupTarget}`,
    "- reason: backup stale Phase 8 simulator outputs before privacy hardening dry-run",
    "- warning: local/private derived data only, do not commit",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(backupRoot, "BACKUP_NOTE.md"), note, "utf8");
  return backupRoot;
}

function normalizeForStateMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d")
    .toLowerCase();
}

function isVietnameseLike(reply: string): boolean {
  const t = normalizeForStateMatch(reply);
  const strongMarkers = [
    "minh",
    "ban",
    "anh",
    "em",
    "gia",
    "giao",
    "thanh toan",
    "cho",
    "giup",
    "so sanh",
    "gui",
    "ma nay",
    "mau nay",
  ];
  if (strongMarkers.some((marker) => t.includes(marker))) {
    return true;
  }

  const hasOk = t.includes("ok");
  const supportingMarkers = ["minh", "nhe", "giup", "ma nay", "mau nay", "so sanh", "gui"];
  return hasOk && supportingMarkers.some((marker) => t.includes(marker));
}

function getEmptyStateScoreMap(): Record<RuntimeState, number> {
  return {
    pricing_phase: 0,
    logistics_phase: 0,
    payment_phase: 0,
    research_phase: 0,
    uncertain_interest: 0,
  };
}

function getStateRank(
  candidateStateScores: Record<RuntimeState, number>,
  state: RuntimeState | null,
): number | null {
  if (!state) return null;
  const targetScore = candidateStateScores[state] ?? 0;
  if (targetScore <= 0) return null;
  const higherDistinctScores = new Set(
    (Object.values(candidateStateScores) as number[]).filter((score) => score > targetScore),
  );
  return higherDistinctScores.size + 1;
}

function detectBuyerMove(reply: string): BuyerMoveDetectionResult {
  const normalized = normalizeForStateMatch(reply);
  let bestMove: string | null = null;
  let bestScore = 0;

  for (const [move, rule] of Object.entries(BUYER_MOVE_RULES)) {
    const matchedScore = rule.keywords.filter((keyword) => normalized.includes(keyword)).length;
    if (matchedScore > bestScore) {
      bestMove = move;
      bestScore = matchedScore;
    }
  }

  return {
    buyerMove: bestScore > 0 ? bestMove : null,
  };
}

function detectReplyState(reply: string): StateDetectionResult {
  const normalized = normalizeForStateMatch(reply);
  const candidateStateScores = getEmptyStateScoreMap();
  let bestState: RuntimeState | null = null;
  let bestScore = 0;

  for (const [state, rule] of Object.entries(STATE_RULES) as Array<
    [RuntimeState, (typeof STATE_RULES)[RuntimeState]]
  >) {
    const matchedScore = rule.keywords.filter((keyword) => normalized.includes(keyword)).length;
    candidateStateScores[state] = matchedScore;
    if (matchedScore > bestScore) {
      bestState = state;
      bestScore = matchedScore;
    }
  }

  const tiedTopStates = bestScore > 0
    ? (Object.entries(candidateStateScores) as Array<[RuntimeState, number]>)
        .filter(([, score]) => score === bestScore)
        .map(([state]) => state)
    : [];
  const tieDetected = tiedTopStates.length > 1;
  const buyerMoveDetection = detectBuyerMove(reply);

  if (!bestState) {
    return {
      detectedState: null,
      buyerMove: buyerMoveDetection.buyerMove,
      ruleId: "state_keyword_classifier_v2",
      ruleName: "normalized reply-state keyword classifier",
      candidateStateScores,
      topScore: 0,
      tiedTopStates: [],
      tieDetected: false,
      winningStateRuleId: "state_keyword_classifier_v2",
      winningStateRuleName: "normalized reply-state keyword classifier",
      classifierDecisionReason: "no_nonzero_state_score",
    };
  }

  return {
    detectedState: bestState,
    buyerMove: buyerMoveDetection.buyerMove,
    ruleId: STATE_RULES[bestState].ruleId,
    ruleName: STATE_RULES[bestState].ruleName,
    candidateStateScores,
    topScore: bestScore,
    tiedTopStates,
    tieDetected,
    winningStateRuleId: STATE_RULES[bestState].ruleId,
    winningStateRuleName: STATE_RULES[bestState].ruleName,
    classifierDecisionReason: tieDetected
      ? "tie_preserved_state_rules_order"
      : "single_top_score",
  };
}

export function evaluateReply(
  reply: string,
  replySource: "local_ai_generated" | "deterministic_fallback",
  scenario: Scenario,
): {
  passed: boolean;
  violationKeys: string[];
  warningKeys: string[];
  assistantStyleDetected: boolean;
  diagnostics: EvaluationDiagnostics;
} {
  const violations: string[] = [];
  const warnings: string[] = [];
  const t = normalizeForStateMatch(reply);
  const assistantHits = detectAssistantStyle(reply);
  const detected = detectReplyState(reply);
  const expectedBuyerMove = STATE_RULES[scenario.runtime_state].buyerMove;
  const expectedStateScore = detected.candidateStateScores[scenario.runtime_state] ?? 0;
  const actualStateScore = detected.detectedState
    ? (detected.candidateStateScores[detected.detectedState] ?? 0)
    : 0;
  const expectedStateRank = getStateRank(detected.candidateStateScores, scenario.runtime_state);
  const scoreGapExpectedVsActual = detected.detectedState
    ? actualStateScore - expectedStateScore
    : null;
  const sortedScores = [...new Set(Object.values(detected.candidateStateScores))]
    .sort((a, b) => b - a);
  const secondScore = sortedScores.find((score) => score < detected.topScore) ?? 0;
  const stateScoreMargin = Math.max(0, detected.topScore - secondScore);
  const expectedStateIsTiedTop =
    detected.tieDetected && detected.tiedTopStates.includes(scenario.runtime_state);
  const buyerMoveMatchesExpected =
    detected.buyerMove !== null && detected.buyerMove === expectedBuyerMove;

  let mismatchReason: EvaluationDiagnostics["mismatch_reason"] = "none";

  if (!isVietnameseLike(reply)) violations.push("not_vietnamese_like");
  if (reply.length > 220) violations.push("too_long");
  if (detected.detectedState === null) {
    violations.push("state_signal_missing");
    mismatchReason = "no_state_keyword_detected";
  } else if (expectedStateIsTiedTop) {
    warnings.push("state_tie_order_bias");
  } else if (detected.detectedState !== scenario.runtime_state) {
    violations.push("state_mismatch");
    mismatchReason = "detected_other_state";
  }
  if (detected.buyerMove !== null && detected.buyerMove !== expectedBuyerMove) {
    violations.push("buyer_move_mismatch");
  }
  if (assistantHits.length > 0) violations.push("assistant_style_detected");
  if (/(toi da mua|lan truoc toi|nhu lan truoc|lich su cua toi)/.test(t)) {
    violations.push("invented_history");
  }
  if (/(toi buon|toi gian|cam xuc|ton thuong|trai nghiem te)/.test(t)) {
    violations.push("emotional_invention");
  }
  if (replySource === "deterministic_fallback") violations.push("deterministic_fallback_used");

  return {
    passed: violations.length === 0,
    violationKeys: violations,
    warningKeys: warnings,
    assistantStyleDetected: assistantHits.length > 0,
    diagnostics: {
      scenario_id: scenario.id,
      expected_state_key: "scenario.runtime_state",
      expected_state_value: scenario.runtime_state,
      actual_state_key: "detected_reply_state",
      actual_state_value: detected.detectedState ?? "none",
      expected_buyer_move: expectedBuyerMove,
      detected_buyer_move: detected.buyerMove ?? "none",
      evaluator_rule_id: detected.ruleId,
      evaluator_rule_name: detected.ruleName,
      state_normalization_applied: true,
      allowed_state_values: Object.keys(STATE_RULES) as RuntimeState[],
      mismatch_reason: mismatchReason,
      missing_state_fields: [],
      candidate_state_scores: detected.candidateStateScores,
      top_score: detected.topScore,
      tied_top_states: detected.tiedTopStates,
      tie_detected: detected.tieDetected,
      winning_state_rule_id: detected.winningStateRuleId,
      winning_state_rule_name: detected.winningStateRuleName,
      expected_state_score: expectedStateScore,
      actual_state_score: actualStateScore,
      expected_state_rank: expectedStateRank,
      score_gap_expected_vs_actual: scoreGapExpectedVsActual,
      state_score_margin: stateScoreMargin,
      classifier_decision_reason: detected.classifierDecisionReason,
      expected_state_is_tied_top: expectedStateIsTiedTop,
      buyer_move_matches_expected: buyerMoveMatchesExpected,
    },
  };
}

function buildScenarioSignalInstruction(scenario: Scenario): string {
  switch (scenario.runtime_state) {
    case "pricing_phase":
      return [
        "Include one short buyer-side pricing signal that explicitly references price, quote, budget, discount, or final price.",
        "Do not drift into comparison-only wording unless pricing is also mentioned.",
      ].join(" ");
    case "logistics_phase":
      return "Include one short buyer-side logistics signal about stock, delivery timing, or handoff document.";
    case "research_phase":
      return "Include one short buyer-side comparison or configuration signal.";
    case "payment_phase":
      return "Include one short buyer-side payment confirmation signal.";
    case "uncertain_interest":
      return "Include one short buyer-side uncertainty signal without sounding like support.";
    default:
      return "";
  }
}

function createPromptBundle(record: SelectedRecord, scenario: Scenario) {
  const context: RuntimeConversationContext = {
    topic: scenario.id,
    recent_messages: [scenario.user_input],
    current_phase: scenario.runtime_state,
    risk_flags: record.persona.risk_flags,
  };

  const session = new RuntimeSessionManager(record.persona, {
    runtime_persona_id: record.persona.runtime_persona_id,
    runtime_state: scenario.runtime_state,
    active_constraints: record.persona.conversation_constraints.slice(0, 5),
    conversation_context: context,
  });

  const bundle = session.getRuntimePrompt();
  const scenarioSignalInstruction = buildScenarioSignalInstruction(scenario);
  if (!scenarioSignalInstruction) {
    return bundle;
  }

  return {
    ...bundle,
    fullPrompt: `${bundle.fullPrompt}\n\n[PHASE8C SCENARIO SIGNAL]\n${scenarioSignalInstruction}`,
  };
}

async function withTimeout<T>(factory: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race<T>([
      factory(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("runner_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runEvaluationBatch(
  records: SelectedRecord[],
  scenarios: Scenario[],
  args: CliArgs,
): Promise<{
  rows: Array<Record<string, unknown>>;
  actualCallCount: number;
  localAIGeneratedCount: number;
  fallbackCount: number;
  timeoutCount: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  assistantStyleDetectedCount: number;
  evaluatorPassedCount: number;
  evaluatorFailedCount: number;
  evaluatorViolationCounts: Record<string, number>;
  diagnostics: DiagnosticAggregate;
}> {
  const rows: Array<Record<string, unknown>> = [];
  let actualCallCount = 0;
  let localAIGeneratedCount = 0;
  let fallbackCount = 0;
  let timeoutCount = 0;
  let totalLatencyMs = 0;
  let minLatencyMs = Number.POSITIVE_INFINITY;
  let maxLatencyMs = 0;
  let assistantStyleDetectedCount = 0;
  let evaluatorPassedCount = 0;
  let evaluatorFailedCount = 0;
  const evaluatorViolationCounts: Record<string, number> = {};

  const responseShapeKeys = new Set<string>();
  const choiceKeys = new Set<string>();
  const messageKeys = new Set<string>();
  const contentTypes = new Set<string>();
  const reasoningTypes = new Set<string>();
  const parseAttemptStatusCounts: Record<string, number> = {};
  const errorTypeCounts: Record<string, number> = {};
  const finishReasons = new Set<string>();
  const stopReasons = new Set<string>();
  const violationCountsByScenario: Record<string, number> = {};
  const violationCountsByExpectedState: Record<string, number> = {};
  const violationCountsByActualState: Record<string, number> = {};
  const mismatchReasonCounts: Record<string, number> = {};
  const tiedTopStatesCounts: Record<string, number> = {};
  let tieDetectedCount = 0;
  let scoreGapMin = Number.POSITIVE_INFINITY;
  let scoreGapMax = Number.NEGATIVE_INFINITY;
  let expectedStateNonzeroCount = 0;
  let expectedStateZeroCount = 0;
  let violationsWithExpectedStateNonzero = 0;
  let violationsWithTieDetected = 0;
  let violationsWithExpectedStateTied = 0;
  let violationsWithActualStateStronger = 0;
  let stateTieOrderBiasCount = 0;
  let buyerMoveMismatchCount = 0;
  let violationsWithStateTieOrderBias = 0;
  let violationsWithBuyerMoveMismatch = 0;
  let passWithStateTieWarningCount = 0;
  let failedDueToBuyerMoveMismatchCount = 0;
  let contentLengthMin = Number.POSITIVE_INFINITY;
  let contentLengthMax = 0;
  let reasoningLengthMin = Number.POSITIVE_INFINITY;
  let reasoningLengthMax = 0;

  const workers = Math.max(1, Math.min(args.concurrency, records.length * scenarios.length || 1));
  const tasks = records.flatMap((record) => scenarios.map((scenario) => ({ record, scenario })));
  for (let startIndex = 0; startIndex < tasks.length; startIndex += workers) {
    const chunk = tasks.slice(startIndex, startIndex + workers);
    await Promise.all(
      chunk.map(async ({ record, scenario }) => {
        actualCallCount += 1;
        const bundle = createPromptBundle(record, scenario);
        const usedPatterns = record.persona.interaction_patterns
          .slice(0, Math.max(1, args.batchSize))
          .map((pattern) => pattern.pattern_name);
        const usedConstraints = record.persona.conversation_constraints.slice(
          0,
          Math.max(1, args.batchSize),
        );

        const startedAt = Date.now();
        let result: LocalAIReplyResult | undefined;
        for (let attempt = 0; attempt <= args.retryCount; attempt += 1) {
          try {
            result = await withTimeout(
              () => generateLocalAIReply(bundle.fullPrompt, usedPatterns, usedConstraints),
              args.timeoutMs,
            );
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message === "runner_timeout" && attempt < args.retryCount) {
              continue;
            }
            throw error;
          }
        }
        const elapsed = Date.now() - startedAt;
        totalLatencyMs += elapsed;
        minLatencyMs = Math.min(minLatencyMs, elapsed);
        maxLatencyMs = Math.max(maxLatencyMs, elapsed);

        if (!result) {
          timeoutCount += 1;
          fallbackCount += 1;
          evaluatorFailedCount += 1;
          evaluatorViolationCounts["no_result"] = (evaluatorViolationCounts["no_result"] ?? 0) + 1;
          rows.push({
            hashed_id: record.hashed_id,
            source_type: record.source_type,
            scenario_id: scenario.id,
            runtime_state: scenario.runtime_state,
            tags: scenario.tags,
            ai_called: true,
            reply_source: "deterministic_fallback",
            latency_ms: elapsed,
            evaluator_passed: false,
            evaluator_violation_count: 1,
            privacy_leak_detected: false,
          });
          return;
        }

        if (result.reply_source === "local_ai_generated") localAIGeneratedCount += 1;
        else fallbackCount += 1;
        if (result.fallback_reason === "timeout") timeoutCount += 1;

        const diagnostics = result.response_diagnostics;
        if (diagnostics) {
          diagnostics.response_shape_keys.forEach((key) => responseShapeKeys.add(key));
          diagnostics.choice_keys.forEach((key) => choiceKeys.add(key));
          diagnostics.message_keys.forEach((key) => messageKeys.add(key));
          contentTypes.add(diagnostics.content_type);
          reasoningTypes.add(diagnostics.reasoning_type);
          parseAttemptStatusCounts[diagnostics.parse_attempt_status] =
            (parseAttemptStatusCounts[diagnostics.parse_attempt_status] ?? 0) + 1;
          const errorTypeKey = diagnostics.error_type ?? "none";
          errorTypeCounts[errorTypeKey] = (errorTypeCounts[errorTypeKey] ?? 0) + 1;
          finishReasons.add(diagnostics.finish_reason ?? "unknown");
          stopReasons.add(
            diagnostics.stop_reason === null || diagnostics.stop_reason === undefined
              ? "null"
              : String(diagnostics.stop_reason),
          );
          contentLengthMin = Math.min(contentLengthMin, diagnostics.content_length);
          contentLengthMax = Math.max(contentLengthMax, diagnostics.content_length);
          reasoningLengthMin = Math.min(reasoningLengthMin, diagnostics.reasoning_length);
          reasoningLengthMax = Math.max(reasoningLengthMax, diagnostics.reasoning_length);
        }

        const evaluation = evaluateReply(result.generated_reply, result.reply_source, scenario);
        if (evaluation.assistantStyleDetected) assistantStyleDetectedCount += 1;
        if (evaluation.passed) evaluatorPassedCount += 1;
        else evaluatorFailedCount += 1;
        if (evaluation.warningKeys.includes("state_tie_order_bias")) {
          stateTieOrderBiasCount += 1;
        }
        if (evaluation.violationKeys.includes("buyer_move_mismatch")) {
          buyerMoveMismatchCount += 1;
        }
        if (evaluation.diagnostics.tie_detected) tieDetectedCount += 1;
        if (evaluation.diagnostics.tied_top_states.length > 0) {
          const tiedKey = evaluation.diagnostics.tied_top_states.join("|");
          tiedTopStatesCounts[tiedKey] = (tiedTopStatesCounts[tiedKey] ?? 0) + 1;
        }
        scoreGapMin = Math.min(
          scoreGapMin,
          evaluation.diagnostics.score_gap_expected_vs_actual ?? 0,
        );
        scoreGapMax = Math.max(
          scoreGapMax,
          evaluation.diagnostics.score_gap_expected_vs_actual ?? 0,
        );
        if (evaluation.diagnostics.expected_state_score > 0) expectedStateNonzeroCount += 1;
        else expectedStateZeroCount += 1;
        for (const key of evaluation.violationKeys) {
          evaluatorViolationCounts[key] = (evaluatorViolationCounts[key] ?? 0) + 1;
        }
        if (evaluation.violationKeys.length > 0) {
          violationCountsByScenario[scenario.id] =
            (violationCountsByScenario[scenario.id] ?? 0) + evaluation.violationKeys.length;
          violationCountsByExpectedState[evaluation.diagnostics.expected_state_value] =
            (violationCountsByExpectedState[evaluation.diagnostics.expected_state_value] ?? 0) +
            evaluation.violationKeys.length;
          violationCountsByActualState[evaluation.diagnostics.actual_state_value] =
            (violationCountsByActualState[evaluation.diagnostics.actual_state_value] ?? 0) +
            evaluation.violationKeys.length;
          mismatchReasonCounts[evaluation.diagnostics.mismatch_reason] =
            (mismatchReasonCounts[evaluation.diagnostics.mismatch_reason] ?? 0) + 1;
          if (evaluation.diagnostics.expected_state_score > 0) {
            violationsWithExpectedStateNonzero += 1;
          }
          if (evaluation.diagnostics.tie_detected) {
            violationsWithTieDetected += 1;
          }
          if (
            evaluation.diagnostics.tied_top_states.includes(
              evaluation.diagnostics.expected_state_value,
            )
          ) {
            violationsWithExpectedStateTied += 1;
          }
          if (
            evaluation.diagnostics.actual_state_score >
            evaluation.diagnostics.expected_state_score
          ) {
            violationsWithActualStateStronger += 1;
          }
          if (evaluation.warningKeys.includes("state_tie_order_bias")) {
            violationsWithStateTieOrderBias += 1;
          }
          if (evaluation.violationKeys.includes("buyer_move_mismatch")) {
            violationsWithBuyerMoveMismatch += 1;
            failedDueToBuyerMoveMismatchCount += 1;
          }
        } else if (evaluation.warningKeys.includes("state_tie_order_bias")) {
          passWithStateTieWarningCount += 1;
        }

        rows.push({
          hashed_id: record.hashed_id,
          source_type: record.source_type,
          scenario_id: scenario.id,
          runtime_state: scenario.runtime_state,
          tags: scenario.tags,
          ai_called: true,
          reply_source: result.reply_source,
          latency_ms: elapsed,
          evaluator_passed: evaluation.passed,
          evaluator_violation_count: evaluation.violationKeys.length,
          evaluator_warning_count: evaluation.warningKeys.length,
          privacy_leak_detected: false,
          content_type: diagnostics?.content_type ?? "unknown",
          content_length: diagnostics?.content_length ?? 0,
          reasoning_type: diagnostics?.reasoning_type ?? "unknown",
          reasoning_length: diagnostics?.reasoning_length ?? 0,
          finish_reason: diagnostics?.finish_reason ?? "unknown",
          stop_reason:
            diagnostics?.stop_reason === null || diagnostics?.stop_reason === undefined
              ? "null"
              : String(diagnostics.stop_reason),
          parse_attempt_status: diagnostics?.parse_attempt_status ?? "unknown",
          error_type: diagnostics?.error_type ?? "none",
          expected_state_key: evaluation.diagnostics.expected_state_key,
          expected_state_value: evaluation.diagnostics.expected_state_value,
          actual_state_key: evaluation.diagnostics.actual_state_key,
          actual_state_value: evaluation.diagnostics.actual_state_value,
          expected_buyer_move: evaluation.diagnostics.expected_buyer_move,
          detected_buyer_move: evaluation.diagnostics.detected_buyer_move,
          evaluator_rule_id: evaluation.diagnostics.evaluator_rule_id,
          evaluator_rule_name: evaluation.diagnostics.evaluator_rule_name,
          state_normalization_applied: evaluation.diagnostics.state_normalization_applied,
          mismatch_reason: evaluation.diagnostics.mismatch_reason,
          missing_state_fields: evaluation.diagnostics.missing_state_fields,
          candidate_state_scores: evaluation.diagnostics.candidate_state_scores,
          top_score: evaluation.diagnostics.top_score,
          tied_top_states: evaluation.diagnostics.tied_top_states,
          tie_detected: evaluation.diagnostics.tie_detected,
          winning_state_rule_id: evaluation.diagnostics.winning_state_rule_id,
          winning_state_rule_name: evaluation.diagnostics.winning_state_rule_name,
          expected_state_score: evaluation.diagnostics.expected_state_score,
          actual_state_score: evaluation.diagnostics.actual_state_score,
          expected_state_rank: evaluation.diagnostics.expected_state_rank,
          score_gap_expected_vs_actual: evaluation.diagnostics.score_gap_expected_vs_actual,
          state_score_margin: evaluation.diagnostics.state_score_margin,
          classifier_decision_reason: evaluation.diagnostics.classifier_decision_reason,
          expected_state_is_tied_top: evaluation.diagnostics.expected_state_is_tied_top,
          buyer_move_matches_expected: evaluation.diagnostics.buyer_move_matches_expected,
          warning_keys: evaluation.warningKeys,
          violation_keys: evaluation.violationKeys,
        });
      }),
    );
  }

  return {
    rows,
    actualCallCount,
    localAIGeneratedCount,
    fallbackCount,
    timeoutCount,
    averageLatencyMs: actualCallCount > 0 ? Number((totalLatencyMs / actualCallCount).toFixed(2)) : 0,
    minLatencyMs: Number.isFinite(minLatencyMs) ? minLatencyMs : 0,
    maxLatencyMs,
    assistantStyleDetectedCount,
    evaluatorPassedCount,
    evaluatorFailedCount,
    evaluatorViolationCounts,
    diagnostics: {
      responseShapeKeys: [...responseShapeKeys].sort(),
      choiceKeys: [...choiceKeys].sort(),
      messageKeys: [...messageKeys].sort(),
      contentTypes: [...contentTypes].sort(),
      contentLengthMin: Number.isFinite(contentLengthMin) ? contentLengthMin : 0,
      contentLengthMax,
      reasoningTypes: [...reasoningTypes].sort(),
      reasoningLengthMin: Number.isFinite(reasoningLengthMin) ? reasoningLengthMin : 0,
      reasoningLengthMax,
      parseAttemptStatusCounts,
      errorTypeCounts,
      finishReasonSet: [...finishReasons].sort(),
      stopReasonSet: [...stopReasons].sort(),
      violationCountsByScenario,
      violationCountsByExpectedState,
      violationCountsByActualState,
      mismatchReasonCounts,
      tieDetectedCount,
      tiedTopStatesCounts,
      scoreGapMin: Number.isFinite(scoreGapMin) ? scoreGapMin : 0,
      scoreGapMax: Number.isFinite(scoreGapMax) ? scoreGapMax : 0,
      expectedStateNonzeroCount,
      expectedStateZeroCount,
      violationsWithExpectedStateNonzero,
      violationsWithTieDetected,
      violationsWithExpectedStateTied,
      violationsWithActualStateStronger,
      stateTieOrderBiasCount,
      buyerMoveMismatchCount,
      violationsWithStateTieOrderBias,
      violationsWithBuyerMoveMismatch,
      passWithStateTieWarningCount,
      failedDueToBuyerMoveMismatchCount,
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = validateEndpoint(getEndpointUrl());
  const sourceResult = loadInputSource(args.month, args.inputSource, args.limitRecords);
  if (sourceResult.privacyLeakDetected) {
    throw new Error(`Phase8C blocked due to disallowed sanitized fields: ${sourceResult.blockedFieldsDetected.join(", ")}`);
  }

  const scenarios = SCENARIOS.slice(0, args.limitScenarios);
  const outDir = path.join("sale-testlab-data", "08_runtime_simulator", args.month);
  const resultsPath = path.join(outDir, "gemma_eval_results.jsonl");
  const summaryPath = path.join(outDir, "gemma_eval_summary.json");
  const auditPath = path.join(outDir, "gemma_eval_audit.json");

  const backupPath = backupExistingOutput(outDir, args.month);
  ensureDir(outDir);

  const plannedCallCount = sourceResult.selected.length * scenarios.length;
  if (!args.dryRun && !endpoint.allowed) {
    throw new Error(`Blocked local AI endpoint: ${endpoint.reason}`);
  }

  let rows: Array<Record<string, unknown>> = sourceResult.selected.flatMap((record) =>
    scenarios.map((scenario) => ({
      hashed_id: record.hashed_id,
      source_type: record.source_type,
      scenario_id: scenario.id,
      runtime_state: scenario.runtime_state,
    tags: scenario.tags,
    ai_called: false,
    reply_source_placeholder: null,
    latency_ms_placeholder: 0,
    constraint_check_status: "not_executed",
    privacy_leak_detected: false,
    candidate_state_scores: null,
    top_score: null,
    tied_top_states: [],
    tie_detected: false,
    winning_state_rule_id: null,
    winning_state_rule_name: null,
    expected_state_score: null,
    actual_state_score: null,
    expected_state_rank: null,
    score_gap_expected_vs_actual: null,
    state_score_margin: null,
    classifier_decision_reason: "not_executed",
  })),
);

  let aiCalled = false;
  let actualCallCount = 0;
  let localAIGeneratedCount = 0;
  let fallbackCount = 0;
  let timeoutCount = 0;
  let averageLatencyMs = 0;
  let minLatencyMs = 0;
  let maxLatencyMs = 0;
  let assistantStyleDetectedCount = 0;
  let evaluatorPassedCount = 0;
  let evaluatorFailedCount = 0;
  let evaluatorViolationCounts: Record<string, number> = {};
  let diagnostics: DiagnosticAggregate = {
    responseShapeKeys: [],
    choiceKeys: [],
    messageKeys: [],
    contentTypes: [],
    contentLengthMin: 0,
    contentLengthMax: 0,
    reasoningTypes: [],
    reasoningLengthMin: 0,
    reasoningLengthMax: 0,
    parseAttemptStatusCounts: {},
    errorTypeCounts: {},
    finishReasonSet: [],
    stopReasonSet: [],
    violationCountsByScenario: {},
    violationCountsByExpectedState: {},
    violationCountsByActualState: {},
    mismatchReasonCounts: {},
    tieDetectedCount: 0,
    tiedTopStatesCounts: {},
    scoreGapMin: 0,
    scoreGapMax: 0,
    expectedStateNonzeroCount: 0,
    expectedStateZeroCount: 0,
    violationsWithExpectedStateNonzero: 0,
    violationsWithTieDetected: 0,
    violationsWithExpectedStateTied: 0,
    violationsWithActualStateStronger: 0,
    stateTieOrderBiasCount: 0,
    buyerMoveMismatchCount: 0,
    violationsWithStateTieOrderBias: 0,
    violationsWithBuyerMoveMismatch: 0,
    passWithStateTieWarningCount: 0,
    failedDueToBuyerMoveMismatchCount: 0,
  };
  let status = "dry_run_completed";

  if (!args.dryRun) {
    const evaluation = await runEvaluationBatch(sourceResult.selected, scenarios, args);
    rows = evaluation.rows;
    aiCalled = true;
    actualCallCount = evaluation.actualCallCount;
    localAIGeneratedCount = evaluation.localAIGeneratedCount;
    fallbackCount = evaluation.fallbackCount;
    timeoutCount = evaluation.timeoutCount;
    averageLatencyMs = evaluation.averageLatencyMs;
    minLatencyMs = evaluation.minLatencyMs;
    maxLatencyMs = evaluation.maxLatencyMs;
    assistantStyleDetectedCount = evaluation.assistantStyleDetectedCount;
    evaluatorPassedCount = evaluation.evaluatorPassedCount;
    evaluatorFailedCount = evaluation.evaluatorFailedCount;
    evaluatorViolationCounts = evaluation.evaluatorViolationCounts;
    diagnostics = evaluation.diagnostics;
    status = "completed";
  }

  writeJsonl(resultsPath, rows);
  writeJson(summaryPath, {
    month: args.month,
    input_source: args.inputSource,
    dry_run: args.dryRun,
    metadata_only: args.metadataOnly,
    selected_count: sourceResult.selected.length,
    scenarios_selected: scenarios.length,
    total_planned_tests: plannedCallCount,
    actual_call_count: args.dryRun ? 0 : actualCallCount,
    skipped_archive_only_count: sourceResult.skippedArchiveOnlyCount,
    skipped_weak_count: sourceResult.skippedWeakCount,
    skipped_outlier_count: sourceResult.skippedOutlierCount,
    skipped_not_simulation_ready_count: sourceResult.skippedNotSimulationReadyCount,
    endpoint_validation: endpoint.allowed ? "pass" : "fail",
    endpoint_host_class: endpoint.hostClass,
    ai_called: aiCalled,
    local_ai_generated_count: localAIGeneratedCount,
    fallback_count: fallbackCount,
    fallback_rate: actualCallCount > 0 ? Number(((fallbackCount / actualCallCount) * 100).toFixed(1)) : 0,
    timeout_count: timeoutCount,
    timeout_rate: actualCallCount > 0 ? Number(((timeoutCount / actualCallCount) * 100).toFixed(1)) : 0,
    latency_avg_ms: averageLatencyMs,
    latency_min_ms: minLatencyMs,
    latency_max_ms: maxLatencyMs,
    assistant_style_detected_count: assistantStyleDetectedCount,
    evaluator_passed_count: evaluatorPassedCount,
    evaluator_failed_count: evaluatorFailedCount,
    evaluator_violation_counts: evaluatorViolationCounts,
    tie_detected_count: diagnostics.tieDetectedCount,
    tied_top_states_counts: diagnostics.tiedTopStatesCounts,
    score_gap_range: {
      min: diagnostics.scoreGapMin,
      max: diagnostics.scoreGapMax,
    },
    expected_state_nonzero_count: diagnostics.expectedStateNonzeroCount,
    expected_state_zero_count: diagnostics.expectedStateZeroCount,
    violations_with_expected_state_nonzero: diagnostics.violationsWithExpectedStateNonzero,
    violations_with_tie_detected: diagnostics.violationsWithTieDetected,
    violations_with_expected_state_tied: diagnostics.violationsWithExpectedStateTied,
    violations_with_actual_state_stronger: diagnostics.violationsWithActualStateStronger,
    state_tie_order_bias_count: diagnostics.stateTieOrderBiasCount,
    buyer_move_mismatch_count: diagnostics.buyerMoveMismatchCount,
    violations_with_state_tie_order_bias: diagnostics.violationsWithStateTieOrderBias,
    violations_with_buyer_move_mismatch: diagnostics.violationsWithBuyerMoveMismatch,
    pass_with_state_tie_warning_count: diagnostics.passWithStateTieWarningCount,
    failed_due_to_buyer_move_mismatch_count: diagnostics.failedDueToBuyerMoveMismatchCount,
    prompt_or_reply_text_written: false,
  });
  writeJson(auditPath, {
    month: args.month,
    input_source: args.inputSource,
    dry_run: args.dryRun,
    metadata_only: args.metadataOnly,
    endpoint_validation: endpoint.allowed ? "pass" : "fail",
    endpoint_host_class: endpoint.hostClass,
    endpoint_reason: endpoint.reason,
    endpoint_url_redacted: `${endpoint.protocol}//${endpoint.host}`,
    blocked_fields_detected_count: sourceResult.blockedFieldsDetected.length,
    blocked_fields_detected: sourceResult.blockedFieldsDetected,
    privacy_leak_detected: false,
    selected_count: sourceResult.selected.length,
    scenarios_selected: scenarios.map((scenario) => scenario.id),
    planned_call_count: plannedCallCount,
    actual_call_count: args.dryRun ? 0 : actualCallCount,
    response_shape_keys: diagnostics.responseShapeKeys,
    choice_keys: diagnostics.choiceKeys,
    message_keys: diagnostics.messageKeys,
    content_types: diagnostics.contentTypes,
    content_length_range: {
      min: diagnostics.contentLengthMin,
      max: diagnostics.contentLengthMax,
    },
    reasoning_types: diagnostics.reasoningTypes,
    reasoning_length_range: {
      min: diagnostics.reasoningLengthMin,
      max: diagnostics.reasoningLengthMax,
    },
    parse_attempt_status_counts: diagnostics.parseAttemptStatusCounts,
    error_type_counts: diagnostics.errorTypeCounts,
    finish_reason_set: diagnostics.finishReasonSet,
    stop_reason_set: diagnostics.stopReasonSet,
    allowed_state_values: Object.keys(STATE_RULES),
    violation_counts_by_scenario: diagnostics.violationCountsByScenario,
    violation_counts_by_expected_state: diagnostics.violationCountsByExpectedState,
    violation_counts_by_actual_state: diagnostics.violationCountsByActualState,
    mismatch_reason_counts: diagnostics.mismatchReasonCounts,
    tie_detected_count: diagnostics.tieDetectedCount,
    tied_top_states_counts: diagnostics.tiedTopStatesCounts,
    score_gap_range: {
      min: diagnostics.scoreGapMin,
      max: diagnostics.scoreGapMax,
    },
    expected_state_nonzero_count: diagnostics.expectedStateNonzeroCount,
    expected_state_zero_count: diagnostics.expectedStateZeroCount,
    violations_with_expected_state_nonzero: diagnostics.violationsWithExpectedStateNonzero,
    violations_with_tie_detected: diagnostics.violationsWithTieDetected,
    violations_with_expected_state_tied: diagnostics.violationsWithExpectedStateTied,
    violations_with_actual_state_stronger: diagnostics.violationsWithActualStateStronger,
    state_tie_order_bias_count: diagnostics.stateTieOrderBiasCount,
    buyer_move_mismatch_count: diagnostics.buyerMoveMismatchCount,
    violations_with_state_tie_order_bias: diagnostics.violationsWithStateTieOrderBias,
    violations_with_buyer_move_mismatch: diagnostics.violationsWithBuyerMoveMismatch,
    pass_with_state_tie_warning_count: diagnostics.passWithStateTieWarningCount,
    failed_due_to_buyer_move_mismatch_count: diagnostics.failedDueToBuyerMoveMismatchCount,
    backup_path: backupPath,
    status,
    ai_called: aiCalled,
  });

  console.log(`Phase8C month=${args.month}`);
  console.log(`input_source=${args.inputSource}`);
  console.log(`dry_run=${args.dryRun}`);
  console.log(`selected_count=${sourceResult.selected.length}`);
  console.log(`scenarios_selected=${scenarios.length}`);
  console.log(`endpoint_validation=${endpoint.allowed ? "pass" : "fail"}`);
  console.log(`ai_called=${aiCalled}`);
  console.log(`output_files=${resultsPath}, ${summaryPath}, ${auditPath}`);
}

const isDirectRun =
  typeof __filename !== "undefined" &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Phase8C Error: ${message}`);
    process.exit(1);
  });
}
