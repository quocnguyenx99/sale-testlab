import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { RuntimeState } from "./runtime/runtimeConstraints";
import { RuntimePersonaForPrompt } from "./runtime/runtimePromptBuilder";

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
  { id: "S1_pricing_question", runtime_state: "pricing_phase", tags: ["pricing"] },
  { id: "S2_product_comparison", runtime_state: "research_phase", tags: ["research"] },
  { id: "S3_logistics_question", runtime_state: "logistics_phase", tags: ["logistics"] },
  { id: "S4_payment_followup", runtime_state: "payment_phase", tags: ["payment"] },
  { id: "S5_warranty_question", runtime_state: "research_phase", tags: ["warranty"] },
  { id: "S6_unclear_buyer_intent", runtime_state: "uncertain_interest", tags: ["unclear"] },
  { id: "S7_aggressive_sales_pressure", runtime_state: "pricing_phase", tags: ["pressure"] },
  { id: "S8_unsupported_emotional_prompt", runtime_state: "uncertain_interest", tags: ["unsafe_emotion"] },
  { id: "S9_request_invent_history", runtime_state: "research_phase", tags: ["unsafe_history"] },
  { id: "S10_negotiation_pressure", runtime_state: "pricing_phase", tags: ["negotiation"] },
];

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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dryRun) {
    throw new Error("Phase8C non-dry-run is blocked until separate approval.");
  }

  const endpoint = validateEndpoint(getEndpointUrl());
  const sourceResult = loadInputSource(args.month, args.inputSource, args.limitRecords);
  if (sourceResult.privacyLeakDetected) {
    throw new Error(
      `Dry-run blocked due to disallowed sanitized fields: ${sourceResult.blockedFieldsDetected.join(", ")}`,
    );
  }

  const scenarios = SCENARIOS.slice(0, args.limitScenarios);
  const outDir = path.join("sale-testlab-data", "08_runtime_simulator", args.month);
  const resultsPath = path.join(outDir, "gemma_eval_results.jsonl");
  const summaryPath = path.join(outDir, "gemma_eval_summary.json");
  const auditPath = path.join(outDir, "gemma_eval_audit.json");

  const backupPath = backupExistingOutput(outDir, args.month);
  ensureDir(outDir);

  const rows = sourceResult.selected.flatMap((record) =>
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
    })),
  );

  writeJsonl(resultsPath, rows);
  writeJson(summaryPath, {
    month: args.month,
    input_source: args.inputSource,
    dry_run: true,
    metadata_only: args.metadataOnly,
    selected_count: sourceResult.selected.length,
    scenarios_selected: scenarios.length,
    total_planned_tests: rows.length,
    skipped_archive_only_count: sourceResult.skippedArchiveOnlyCount,
    skipped_weak_count: sourceResult.skippedWeakCount,
    skipped_outlier_count: sourceResult.skippedOutlierCount,
    skipped_not_simulation_ready_count: sourceResult.skippedNotSimulationReadyCount,
    endpoint_validation: endpoint.allowed ? "pass" : "fail",
    endpoint_host_class: endpoint.hostClass,
    ai_called: false,
    prompt_or_reply_text_written: false,
  });
  writeJson(auditPath, {
    month: args.month,
    input_source: args.inputSource,
    dry_run: true,
    metadata_only: args.metadataOnly,
    endpoint_validation: endpoint.allowed ? "pass" : "fail",
    endpoint_reason: endpoint.reason,
    endpoint_url_redacted: `${endpoint.protocol}//${endpoint.host}`,
    blocked_fields_detected_count: sourceResult.blockedFieldsDetected.length,
    blocked_fields_detected: sourceResult.blockedFieldsDetected,
    privacy_leak_detected: false,
    selected_count: sourceResult.selected.length,
    scenarios_selected: scenarios.map((scenario) => scenario.id),
    backup_path: backupPath,
    status: "dry_run_completed",
    ai_called: false,
  });

  console.log(`Phase8C month=${args.month}`);
  console.log(`input_source=${args.inputSource}`);
  console.log(`dry_run=${args.dryRun}`);
  console.log(`selected_count=${sourceResult.selected.length}`);
  console.log(`scenarios_selected=${scenarios.length}`);
  console.log(`endpoint_validation=${endpoint.allowed ? "pass" : "fail"}`);
  console.log(`ai_called=false`);
  console.log(`output_files=${resultsPath}, ${summaryPath}, ${auditPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Phase8C Error: ${message}`);
  process.exit(1);
});
