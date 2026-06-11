import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { RuntimeState, detectAssistantStyle } from "./runtime/runtimeConstraints";
import { RuntimeSessionManager } from "./runtime/runtimeSessionManager";
import {
  RuntimeConversationContext,
  RuntimePersonaForPrompt,
} from "./runtime/runtimePromptBuilder";
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
  source_entity_id?: string;
  runtime_version?: string;
  runtime_usefulness_score?: number;
  primary_contexts?: string[];
  allowed_runtime_usage?: {
    sales_training?: boolean;
    customer_simulation?: boolean;
    objection_training?: boolean;
    negotiation_training?: boolean;
  };
}

interface ArchetypeSourceRecord {
  archetype_id: string;
  archetype_name: string;
  source_runtime_persona_ids?: string[];
  source_count: number;
  approved_source_count: number;
  limited_source_count: number;
  dominant_contexts?: string[];
  core_behavior_patterns: string[];
  secondary_behavior_patterns: string[];
  sales_behaviors: string[];
  payment_behaviors: string[];
  logistics_behaviors: string[];
  research_behaviors: string[];
  communication_behaviors: string[];
  difficulty_hint: "easy" | "medium" | "hard";
  runtime_readiness: "approved" | "limited" | "archive_only";
  evidence_strength: "weak" | "moderate" | "strong";
  archetype_confidence: number;
  risk_flags: string[];
  excluded_personas?: string[];
}

interface SelectedRecord {
  hashed_id: string;
  source_type: InputSource;
  runtime_state: RuntimeState;
  synthetic_seed_message: string;
  persona: RuntimePersonaForPrompt;
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
  trimmedContentLengthMin: number;
  trimmedContentLengthMax: number;
  startsWithJsonObjectCount: number;
  startsWithMarkdownFenceCount: number;
  parseAttemptStatusCounts: Record<string, number>;
  missingRequiredFields: string[];
  errorTypeCounts: Record<string, number>;
  replySourceCounts: Record<string, number>;
  reasoningTypes: string[];
  reasoningLengthMin: number;
  reasoningLengthMax: number;
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
]);

const DEFAULT_LOCAL_AI_URL = "http://192.168.117.73:9001/v1";

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
    throw new Error("Phase 8 privacy hardening only supports --metadata-only=true.");
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
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }
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

function buildSyntheticSeedMessage(state: RuntimeState): string {
  if (state === "pricing_phase") return "Anh còn giá tốt hơn không?";
  if (state === "logistics_phase") return "Lịch giao và chứng từ thế nào vậy?";
  if (state === "payment_phase") return "Bên mình đã nhận thanh toán chưa?";
  if (state === "research_phase") return "Mã nào phù hợp hơn để mình so sánh?";
  if (state === "operational_followup") return "Bạn cập nhật giúp tiến độ xử lý hiện tại.";
  if (state === "passive_followup") return "Mình theo dõi tiếp, có gì cập nhật giúp nhé.";
  return "Mình cần thêm thông tin để quyết định.";
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
    return {
      valid: true,
      allowed: true,
      url: rawUrl,
      protocol,
      host,
      hostClass: "loopback",
      reason: "loopback_allowed",
    };
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
    interaction_patterns: (record.interaction_patterns ?? [])
      .slice(0, 5)
      .map((pattern) => ({
        pattern_name: normalizeToken(pattern.pattern_name, 80),
        priority: pattern.priority,
        stability: pattern.stability,
        runtime_weight: Number(Number(pattern.runtime_weight ?? 0).toFixed(4)),
      })),
    conversation_constraints: trimList(record.conversation_constraints, 5, 120),
    risk_flags: trimList(record.risk_flags, 5, 120),
  };

  const runtimeState = chooseState(persona);
  return {
    hashed_id: persona.runtime_persona_id,
    source_type: "runtime_personas",
    runtime_state: runtimeState,
    synthetic_seed_message: buildSyntheticSeedMessage(runtimeState),
    persona,
  };
}

function sanitizeArchetypeRecord(record: ArchetypeSourceRecord): SelectedRecord {
  const interactionPatterns = [
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
  ];

  const baseConstraints = [
    "avoid emotional inference",
    "avoid unsupported confidence escalation",
    "maintain operational realism",
    "enforce evidence-bound responses",
  ];

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
    interaction_patterns: interactionPatterns,
    conversation_constraints: trimList(
      [...baseConstraints, ...trimList(record.risk_flags, 3, 80)],
      5,
      120,
    ),
    risk_flags: trimList(record.risk_flags, 5, 120),
  };

  const runtimeState = chooseState(persona);
  return {
    hashed_id: persona.runtime_persona_id,
    source_type: "archetypes",
    runtime_state: runtimeState,
    synthetic_seed_message: buildSyntheticSeedMessage(runtimeState),
    persona,
  };
}

function loadInputSource(month: string, inputSource: InputSource, limitRecords: number): SourceLoadResult {
  if (inputSource === "runtime_personas") {
    const inputPath = path.join(
      "sale-testlab-data",
      "07_runtime_personas",
      month,
      "runtime_personas.jsonl",
    );
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

  const inputPath = path.join(
    "sale-testlab-data",
    "07b_persona_archetypes",
    month,
    "persona_archetypes.jsonl",
  );
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

function createPromptBundle(record: SelectedRecord) {
  const context: RuntimeConversationContext = {
    topic: record.runtime_state,
    recent_messages: [record.synthetic_seed_message],
    current_phase: record.runtime_state,
    risk_flags: record.persona.risk_flags,
  };

  const session = new RuntimeSessionManager(record.persona, {
    runtime_persona_id: record.persona.runtime_persona_id,
    runtime_state: record.runtime_state,
    active_constraints: record.persona.conversation_constraints.slice(0, 5),
    conversation_context: context,
  });

  return session.getRuntimePrompt();
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

async function runGenerationBatch(
  records: SelectedRecord[],
  args: CliArgs,
): Promise<{
  aiCalled: boolean;
  localGeneratedCount: number;
  fallbackCount: number;
  timeoutCount: number;
  assistantStyleDetectedCount: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  diagnostics: DiagnosticAggregate;
  status: "completed";
}> {
  let localGeneratedCount = 0;
  let fallbackCount = 0;
  let timeoutCount = 0;
  let assistantStyleDetectedCount = 0;
  let totalLatency = 0;
  let minLatencyMs = Number.POSITIVE_INFINITY;
  let maxLatencyMs = 0;
  const responseShapeKeys = new Set<string>();
  const choiceKeys = new Set<string>();
  const messageKeys = new Set<string>();
  const contentTypes = new Set<string>();
  const missingRequiredFields = new Set<string>();
  const reasoningTypes = new Set<string>();
  const parseAttemptStatusCounts: Record<string, number> = {};
  const errorTypeCounts: Record<string, number> = {};
  const replySourceCounts: Record<string, number> = {};
  let contentLengthMin = Number.POSITIVE_INFINITY;
  let contentLengthMax = 0;
  let trimmedContentLengthMin = Number.POSITIVE_INFINITY;
  let trimmedContentLengthMax = 0;
  let reasoningLengthMin = Number.POSITIVE_INFINITY;
  let reasoningLengthMax = 0;
  let startsWithJsonObjectCount = 0;
  let startsWithMarkdownFenceCount = 0;

  const workers = Math.max(1, Math.min(args.concurrency, records.length));
  for (let startIndex = 0; startIndex < records.length; startIndex += workers) {
    const chunk = records.slice(startIndex, startIndex + workers);
    await Promise.all(
      chunk.map(async (record) => {
        const bundle = createPromptBundle(record);
        const usedPatterns = record.persona.interaction_patterns
          .slice(0, Math.max(1, args.batchSize))
          .map((pattern) => pattern.pattern_name);
        const usedConstraints = record.persona.conversation_constraints.slice(
          0,
          Math.max(1, args.batchSize),
        );

        const startedAt = Date.now();
        let result: LocalAIReplyResult | undefined;
        let timedOut = false;
        for (let attempt = 0; attempt <= args.retryCount; attempt += 1) {
          try {
            result = await withTimeout(
              () => generateLocalAIReply(bundle.fullPrompt, usedPatterns, usedConstraints),
              args.timeoutMs,
            );
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message === "runner_timeout") {
              timedOut = true;
              if (attempt < args.retryCount) continue;
            }
            throw error;
          }
        }
        const elapsed = Date.now() - startedAt;
        totalLatency += elapsed;
        minLatencyMs = Math.min(minLatencyMs, elapsed);
        maxLatencyMs = Math.max(maxLatencyMs, elapsed);
        if (!result) {
          timeoutCount += 1;
          fallbackCount += 1;
          return;
        }
        if (timedOut) timeoutCount += 1;
        if (detectAssistantStyle(result.generated_reply).length > 0) {
          assistantStyleDetectedCount += 1;
        }
        const diagnostics = result.response_diagnostics;
        if (diagnostics) {
          diagnostics.response_shape_keys.forEach((key) => responseShapeKeys.add(key));
          diagnostics.choice_keys.forEach((key) => choiceKeys.add(key));
          diagnostics.message_keys.forEach((key) => messageKeys.add(key));
          contentTypes.add(diagnostics.content_type);
          diagnostics.missing_required_fields.forEach((field) => missingRequiredFields.add(field));
          reasoningTypes.add(diagnostics.reasoning_type);
          parseAttemptStatusCounts[diagnostics.parse_attempt_status] =
            (parseAttemptStatusCounts[diagnostics.parse_attempt_status] ?? 0) + 1;
          const errorTypeKey = diagnostics.error_type ?? "none";
          errorTypeCounts[errorTypeKey] = (errorTypeCounts[errorTypeKey] ?? 0) + 1;
          const replySourceKey = result.reply_source;
          replySourceCounts[replySourceKey] = (replySourceCounts[replySourceKey] ?? 0) + 1;
          contentLengthMin = Math.min(contentLengthMin, diagnostics.content_length);
          contentLengthMax = Math.max(contentLengthMax, diagnostics.content_length);
          trimmedContentLengthMin = Math.min(
            trimmedContentLengthMin,
            diagnostics.trimmed_content_length,
          );
          trimmedContentLengthMax = Math.max(
            trimmedContentLengthMax,
            diagnostics.trimmed_content_length,
          );
          reasoningLengthMin = Math.min(reasoningLengthMin, diagnostics.reasoning_length);
          reasoningLengthMax = Math.max(reasoningLengthMax, diagnostics.reasoning_length);
          if (diagnostics.starts_with_json_object) startsWithJsonObjectCount += 1;
          if (diagnostics.starts_with_markdown_fence) startsWithMarkdownFenceCount += 1;
        }
        if (result.reply_source === "local_ai_generated") localGeneratedCount += 1;
        else fallbackCount += 1;
      }),
    );
  }

  return {
    aiCalled: true,
    localGeneratedCount,
    fallbackCount,
    timeoutCount,
    assistantStyleDetectedCount,
    averageLatencyMs:
      records.length > 0 ? Number((totalLatency / records.length).toFixed(2)) : 0,
    minLatencyMs: Number.isFinite(minLatencyMs) ? minLatencyMs : 0,
    maxLatencyMs,
    diagnostics: {
      responseShapeKeys: [...responseShapeKeys].sort(),
      choiceKeys: [...choiceKeys].sort(),
      messageKeys: [...messageKeys].sort(),
      contentTypes: [...contentTypes].sort(),
      contentLengthMin: Number.isFinite(contentLengthMin) ? contentLengthMin : 0,
      contentLengthMax,
      trimmedContentLengthMin: Number.isFinite(trimmedContentLengthMin)
        ? trimmedContentLengthMin
        : 0,
      trimmedContentLengthMax,
      startsWithJsonObjectCount,
      startsWithMarkdownFenceCount,
      parseAttemptStatusCounts,
      missingRequiredFields: [...missingRequiredFields].sort(),
      errorTypeCounts,
      replySourceCounts,
      reasoningTypes: [...reasoningTypes].sort(),
      reasoningLengthMin: Number.isFinite(reasoningLengthMin) ? reasoningLengthMin : 0,
      reasoningLengthMax,
    },
    status: "completed",
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = validateEndpoint(getEndpointUrl());
  const sourceResult = loadInputSource(args.month, args.inputSource, args.limitRecords);
  const outDir = path.join("sale-testlab-data", "08_runtime_simulator", args.month);
  const selectionPath = path.join(outDir, "runtime_simulation_selection.json");
  const auditPath = path.join(outDir, "runtime_simulation_audit.json");

  const privacyLeakDetected =
    sourceResult.privacyLeakDetected || sourceResult.blockedFieldsDetected.length > 0;
  if (args.dryRun && privacyLeakDetected) {
    throw new Error(
      `Dry-run blocked due to disallowed sanitized fields: ${sourceResult.blockedFieldsDetected.join(", ")}`,
    );
  }

  const backupPath = backupExistingOutput(outDir, args.month);
  ensureDir(outDir);

  let aiCalled = false;
  let localGeneratedCount = 0;
  let fallbackCount = 0;
  let timeoutCount = 0;
  let assistantStyleDetectedCount = 0;
  let averageLatencyMs = 0;
  let minLatencyMs = 0;
  let maxLatencyMs = 0;
  let diagnostics: DiagnosticAggregate = {
    responseShapeKeys: [],
    choiceKeys: [],
    messageKeys: [],
    contentTypes: [],
    contentLengthMin: 0,
    contentLengthMax: 0,
    trimmedContentLengthMin: 0,
    trimmedContentLengthMax: 0,
    startsWithJsonObjectCount: 0,
    startsWithMarkdownFenceCount: 0,
    parseAttemptStatusCounts: {},
    missingRequiredFields: [],
    errorTypeCounts: {},
    replySourceCounts: {},
    reasoningTypes: [],
    reasoningLengthMin: 0,
    reasoningLengthMax: 0,
  };
  let status: "dry_run_completed" | "completed" = "dry_run_completed";

  if (!args.dryRun) {
    if (!endpoint.allowed) {
      throw new Error(`Blocked local AI endpoint: ${endpoint.reason}`);
    }
    const generation = await runGenerationBatch(sourceResult.selected, args);
    aiCalled = generation.aiCalled;
    localGeneratedCount = generation.localGeneratedCount;
    fallbackCount = generation.fallbackCount;
    timeoutCount = generation.timeoutCount;
    assistantStyleDetectedCount = generation.assistantStyleDetectedCount;
    averageLatencyMs = generation.averageLatencyMs;
    minLatencyMs = generation.minLatencyMs;
    maxLatencyMs = generation.maxLatencyMs;
    diagnostics = generation.diagnostics;
    status = generation.status;
  }

  writeJson(selectionPath, {
    month: args.month,
    input_source: args.inputSource,
    selected_count: sourceResult.selected.length,
    skipped_count:
      sourceResult.skippedArchiveOnlyCount +
      sourceResult.skippedWeakCount +
      sourceResult.skippedOutlierCount +
      sourceResult.skippedNotSimulationReadyCount,
    skipped_archive_only_count: sourceResult.skippedArchiveOnlyCount,
    skipped_weak_count: sourceResult.skippedWeakCount,
    skipped_outlier_count: sourceResult.skippedOutlierCount,
    skipped_not_simulation_ready_count: sourceResult.skippedNotSimulationReadyCount,
    selected_ids_hashed: sourceResult.selected.map((record) => record.hashed_id),
    metadata_only: args.metadataOnly,
    dry_run: args.dryRun,
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
    privacy_leak_detected: privacyLeakDetected,
    blocked_fields_detected_count: sourceResult.blockedFieldsDetected.length,
    blocked_fields_detected: sourceResult.blockedFieldsDetected,
    selected_count: sourceResult.selected.length,
    total_input_count: sourceResult.totalInputCount,
    skipped_archive_only_count: sourceResult.skippedArchiveOnlyCount,
    skipped_weak_count: sourceResult.skippedWeakCount,
    skipped_outlier_count: sourceResult.skippedOutlierCount,
    skipped_not_simulation_ready_count: sourceResult.skippedNotSimulationReadyCount,
    ai_called: aiCalled,
    local_ai_generated_count: localGeneratedCount,
    fallback_count_placeholder: fallbackCount,
    fallback_rate: sourceResult.selected.length > 0
      ? Number(((fallbackCount / sourceResult.selected.length) * 100).toFixed(1))
      : 0,
    timeout_count_placeholder: timeoutCount,
    timeout_rate: sourceResult.selected.length > 0
      ? Number(((timeoutCount / sourceResult.selected.length) * 100).toFixed(1))
      : 0,
    latency_ms_placeholder: averageLatencyMs,
    latency_min_ms: minLatencyMs,
    latency_max_ms: maxLatencyMs,
    assistant_style_detected_count_placeholder: assistantStyleDetectedCount,
    response_shape_keys: diagnostics.responseShapeKeys,
    choice_keys: diagnostics.choiceKeys,
    message_keys: diagnostics.messageKeys,
    content_types: diagnostics.contentTypes,
    content_length_range: {
      min: diagnostics.contentLengthMin,
      max: diagnostics.contentLengthMax,
    },
    trimmed_content_length_range: {
      min: diagnostics.trimmedContentLengthMin,
      max: diagnostics.trimmedContentLengthMax,
    },
    starts_with_json_object_count: diagnostics.startsWithJsonObjectCount,
    starts_with_markdown_fence_count: diagnostics.startsWithMarkdownFenceCount,
    parse_attempt_status_counts: diagnostics.parseAttemptStatusCounts,
    missing_required_fields: diagnostics.missingRequiredFields,
    error_type_counts: diagnostics.errorTypeCounts,
    reply_source_counts: diagnostics.replySourceCounts,
    reasoning_types: diagnostics.reasoningTypes,
    reasoning_length_range: {
      min: diagnostics.reasoningLengthMin,
      max: diagnostics.reasoningLengthMax,
    },
    backup_path: backupPath,
    report10_missing_in_repo_before_this_run: !fs.existsSync(
      path.join("docs", "audits", "phase12h3b", "REPORT_10_PHASE8_QWEN_PLAN.md"),
    ),
    status,
    warnings: endpoint.allowed ? [] : ["endpoint_not_allowed_for_real_run"],
  });

  console.log(`Phase8 month=${args.month}`);
  console.log(`input_source=${args.inputSource}`);
  console.log(`dry_run=${args.dryRun}`);
  console.log(`selected_count=${sourceResult.selected.length}`);
  console.log(`endpoint_validation=${endpoint.allowed ? "pass" : "fail"}`);
  console.log(`privacy_leak_detected=${privacyLeakDetected}`);
  console.log(`ai_called=${aiCalled}`);
  console.log(`output_files=${selectionPath}, ${auditPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Phase8 Error: ${message}`);
  process.exit(1);
});
