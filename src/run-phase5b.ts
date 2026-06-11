import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  buildContextualRelationships,
  type AggregatedBehaviorRecord
} from "./pipeline/contextRelationshipBuilder";

type Phase5BArgs = { month: string };

type SummaryAccumulator = {
  total_entities: number;
  total_relationships: number;
  relationship_family_counts: Record<string, number>;
  dominant_context_distribution: Record<string, number>;
  relationship_name_counts: Record<string, number>;
  strong_relationship_count: number;
  weak_relationship_count: number;
  stable_context_entities: number;
  mixed_context_entities: number;
};

type AuditAccumulator = {
  contradictory_relationship_count: number;
  weak_relationship_count: number;
  unstable_sequence_count: number;
  over_connected_entity_count: number;
  unsupported_relationship_count: number;
  context_conflict_count: number;
  risk_flags_summary: Record<string, number>;
};

function parseCliArgs(argv: string[]): Phase5BArgs {
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

function incr(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

function createSummaryAccumulator(): SummaryAccumulator {
  return {
    total_entities: 0,
    total_relationships: 0,
    relationship_family_counts: {},
    dominant_context_distribution: {},
    relationship_name_counts: {},
    strong_relationship_count: 0,
    weak_relationship_count: 0,
    stable_context_entities: 0,
    mixed_context_entities: 0
  };
}

function createAuditAccumulator(): AuditAccumulator {
  return {
    contradictory_relationship_count: 0,
    weak_relationship_count: 0,
    unstable_sequence_count: 0,
    over_connected_entity_count: 0,
    unsupported_relationship_count: 0,
    context_conflict_count: 0,
    risk_flags_summary: {}
  };
}

function updateAccumulators(
  summaryAcc: SummaryAccumulator,
  auditAcc: AuditAccumulator,
  record: {
    context_relationships: Array<{
      relationship_name: string;
      relationship_family: string;
      stability: "weak" | "moderate" | "strong";
      relationship_strength: number;
      supporting_sessions: string[];
    }>;
    dominant_contexts: Record<string, number>;
    risk_flags: string[];
  }
): void {
  summaryAcc.total_entities += 1;

  let dominantContext = "mixed_context";
  let dominantValue = -1;
  for (const [key, value] of Object.entries(record.dominant_contexts)) {
    if (value > dominantValue) {
      dominantContext = key;
      dominantValue = value;
    }
  }
  incr(summaryAcc.dominant_context_distribution, dominantContext, 1);
  if (dominantContext === "mixed_context") summaryAcc.mixed_context_entities += 1;
  if (record.context_relationships.some((rel) => rel.stability !== "weak")) {
    summaryAcc.stable_context_entities += 1;
  }

  summaryAcc.total_relationships += record.context_relationships.length;
  for (const rel of record.context_relationships) {
    incr(summaryAcc.relationship_family_counts, rel.relationship_family, 1);
    incr(summaryAcc.relationship_name_counts, rel.relationship_name, 1);
    if (rel.stability === "strong") summaryAcc.strong_relationship_count += 1;
    if (rel.stability === "weak") summaryAcc.weak_relationship_count += 1;

    if (rel.stability === "weak") auditAcc.weak_relationship_count += 1;
    if (rel.relationship_family === "sequential" && rel.stability === "weak") {
      auditAcc.unstable_sequence_count += 1;
    }
    if (rel.relationship_strength >= 0.85 && rel.supporting_sessions.length < 2) {
      auditAcc.unsupported_relationship_count += 1;
    }
  }

  if (record.context_relationships.length > 12) {
    auditAcc.over_connected_entity_count += 1;
  }
  if (record.risk_flags.some((flag) => flag.includes("contradiction:"))) {
    auditAcc.contradictory_relationship_count += 1;
  }
  if (record.risk_flags.some((flag) => flag.includes("context_conflict:"))) {
    auditAcc.context_conflict_count += 1;
  }
  for (const flag of record.risk_flags) {
    incr(auditAcc.risk_flags_summary, flag, 1);
  }
}

function finalizeSummary(summaryAcc: SummaryAccumulator) {
  const topRelationships = Object.entries(summaryAcc.relationship_name_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([relationship_name, count]) => ({ relationship_name, count }));

  return {
    total_entities: summaryAcc.total_entities,
    total_relationships: summaryAcc.total_relationships,
    relationship_family_counts: summaryAcc.relationship_family_counts,
    dominant_context_distribution: summaryAcc.dominant_context_distribution,
    top_relationships: topRelationships,
    strong_relationship_count: summaryAcc.strong_relationship_count,
    weak_relationship_count: summaryAcc.weak_relationship_count,
    stable_context_entities: summaryAcc.stable_context_entities,
    mixed_context_entities: summaryAcc.mixed_context_entities
  };
}

function finalizeAudit(auditAcc: AuditAccumulator) {
  return {
    contradictory_relationship_count: auditAcc.contradictory_relationship_count,
    weak_relationship_count: auditAcc.weak_relationship_count,
    unstable_sequence_count: auditAcc.unstable_sequence_count,
    over_connected_entity_count: auditAcc.over_connected_entity_count,
    unsupported_relationship_count: auditAcc.unsupported_relationship_count,
    context_conflict_count: auditAcc.context_conflict_count,
    risk_flags_summary: auditAcc.risk_flags_summary
  };
}

async function backupExistingPhase5BOutput(
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
    `phase5b_stale_before_stream_fix_${month}_${timestamp}`
  );
  const backupTarget = path.join(backupRoot, "05b_context", month);

  await fs.promises.mkdir(path.dirname(backupTarget), { recursive: true });
  await fs.promises.cp(outDir, backupTarget, { recursive: true });
  await fs.promises.rm(outDir, { recursive: true, force: true });
  return backupTarget;
}

async function runPhase5B(args: Phase5BArgs): Promise<void> {
  const dataDir = path.resolve("sale-testlab-data");
  const inputDir = path.join(dataDir, "05_aggregated", args.month);
  const inputPath = path.join(inputDir, "aggregated_behavior.jsonl");

  const outDir = path.join(dataDir, "05b_context", args.month);
  const outRelationshipsPath = path.join(outDir, "contextual_relationships.jsonl");
  const outSummaryPath = path.join(outDir, "context_summary.json");
  const outAuditPath = path.join(outDir, "context_audit.json");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const backupTarget = await backupExistingPhase5BOutput(dataDir, args.month, outDir);
  const summaryAcc = createSummaryAccumulator();
  const auditAcc = createAuditAccumulator();
  let inputRecordCount = 0;
  let invalidJsonLineCount = 0;

  await fs.promises.mkdir(outDir, { recursive: true });
  const outputStream = fs.createWriteStream(outRelationshipsPath, { encoding: "utf8" });
  const inputStream = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  try {
    for await (const rawLine of rl) {
      const line = rawLine.trim();
      if (!line) continue;

      const entity = safeJsonParse<AggregatedBehaviorRecord>(line);
      if (!entity) {
        invalidJsonLineCount += 1;
        continue;
      }

      const built = buildContextualRelationships([entity]);
      const record = built.records[0];
      if (!record) continue;

      updateAccumulators(summaryAcc, auditAcc, record);
      inputRecordCount += 1;

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
  const audit = finalizeAudit(auditAcc);

  await fs.promises.writeFile(outSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(outAuditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  for (const p of [outRelationshipsPath, outSummaryPath, outAuditPath]) {
    if (!fs.existsSync(p)) throw new Error(`Output file missing: ${p}`);
    const stat = fs.statSync(p);
    console.log(`[PHASE5B_FILE] ${path.basename(p)} size=${stat.size}`);
  }
  if (backupTarget) {
    console.log(`[PHASE5B_BACKUP] ${backupTarget}`);
  }

  console.log("[PHASE5B_SUMMARY]");
  console.log(
    JSON.stringify(
      {
        input_records: inputRecordCount,
        invalid_json_line_count: invalidJsonLineCount,
        total_entities: summary.total_entities,
        total_relationships: summary.total_relationships,
        strong_relationship_count: summary.strong_relationship_count,
        weak_relationship_count: summary.weak_relationship_count
      },
      null,
      2
    )
  );
  console.log("[PHASE5B_AUDIT]");
  console.log(
    JSON.stringify(
      {
        contradictory_relationship_count: audit.contradictory_relationship_count,
        unstable_sequence_count: audit.unstable_sequence_count,
        over_connected_entity_count: audit.over_connected_entity_count,
        unsupported_relationship_count: audit.unsupported_relationship_count,
        context_conflict_count: audit.context_conflict_count
      },
      null,
      2
    )
  );
}

runPhase5B(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[ERROR] Phase5B failed: ${message}`);
  process.exitCode = 1;
});
