import * as fs from "fs";
import * as path from "path";
import {
  aggregateBehaviorByConversation,
  type BehaviorSessionRecord
} from "./pipeline/behaviorAggregator";

type Phase5Args = { month: string };

function parseCliArgs(argv: string[]): Phase5Args {
  let month = "";
  for (const arg of argv) {
    if (arg.startsWith("--month=")) month = arg.slice("--month=".length);
  }
  if (!month && process.env.npm_config_month) month = process.env.npm_config_month;
  if (!month) throw new Error("Missing required arg: --month=YYYY-MM");
  return { month };
}

function parseJsonlFile<T>(filePath: string): T[] {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: T[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // Deterministic skip for invalid lines.
    }
  }
  return out;
}

async function runPhase5(args: Phase5Args): Promise<void> {
  const baseDir = path.resolve("sale-testlab-data");
  const inputDir = path.join(baseDir, "04_behavior", args.month);
  const inputPath = path.join(inputDir, "behavior_signals.jsonl");
  const outDir = path.join(baseDir, "05_aggregated", args.month);
  const outAggregatedPath = path.join(outDir, "aggregated_behavior.jsonl");
  const outSummaryPath = path.join(outDir, "aggregation_summary.json");
  const outAuditPath = path.join(outDir, "aggregation_audit.json");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const sessions = parseJsonlFile<BehaviorSessionRecord>(inputPath);
  const { records, summary, audit } = aggregateBehaviorByConversation(sessions, args.month);

  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(
    outAggregatedPath,
    records.length ? `${records.map((r) => JSON.stringify(r)).join("\n")}\n` : "",
    "utf8"
  );
  await fs.promises.writeFile(outSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(outAuditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  for (const p of [outAggregatedPath, outSummaryPath, outAuditPath]) {
    if (!fs.existsSync(p)) throw new Error(`Output file missing: ${p}`);
    const stat = fs.statSync(p);
    console.log(`[PHASE5_FILE] ${path.basename(p)} size=${stat.size}`);
  }

  // Masked-safe preview (no raw message text fields in phase5 objects)
  const preview = records.slice(0, 5).map((r) => ({
    entity_id: r.entity_id,
    aggregation_window: r.aggregation_window,
    session_count: r.session_count,
    message_count: r.message_count,
    aggregated_pattern_count: r.aggregated_patterns.length,
    top_pattern_names: r.aggregated_patterns.slice(0, 3).map((p) => p.pattern_name),
    risk_flags: r.risk_flags
  }));

  console.log("[PHASE5_PREVIEW] first_5_records_masked=");
  console.log(JSON.stringify(preview, null, 2));
  console.log("[PHASE5_SUMMARY]");
  console.log(JSON.stringify(summary, null, 2));
  console.log("[PHASE5_AUDIT]");
  console.log(JSON.stringify(audit, null, 2));
}

runPhase5(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[ERROR] Phase5 failed: ${message}`);
  process.exitCode = 1;
});

