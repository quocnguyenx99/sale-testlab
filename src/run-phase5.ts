import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  addBehaviorSessionToAggregation,
  createBehaviorAggregationState,
  finalizeBehaviorAggregation,
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

function safeJsonParse<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
}

async function backupExistingPhase5Output(
  baseDir: string,
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
    baseDir,
    "_backup",
    `phase5_stale_before_stream_fix_${month}_${timestamp}`
  );
  const backupTarget = path.join(backupRoot, "05_aggregated", month);

  await fs.promises.mkdir(path.dirname(backupTarget), { recursive: true });
  await fs.promises.cp(outDir, backupTarget, { recursive: true });
  await fs.promises.rm(outDir, { recursive: true, force: true });
  return backupTarget;
}

async function writeJsonlStream(filePath: string, rows: unknown[]): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const stream = fs.createWriteStream(filePath, { encoding: "utf8" });

  try {
    for (const row of rows) {
      const line = `${JSON.stringify(row)}\n`;
      if (!stream.write(line, "utf8")) {
        await new Promise<void>((resolve) => stream.once("drain", resolve));
      }
    }
  } catch (error) {
    stream.destroy(error as Error);
    throw error;
  }

  await new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.on("finish", resolve);
    stream.end();
  });
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

  const backupTarget = await backupExistingPhase5Output(baseDir, args.month, outDir);
  const aggregationState = createBehaviorAggregationState();
  let inputRecordCount = 0;
  let invalidJsonLineCount = 0;

  const inputStream = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  try {
    for await (const rawLine of rl) {
      const line = rawLine.trim();
      if (!line) continue;

      const parsed = safeJsonParse<BehaviorSessionRecord>(line);
      if (!parsed) {
        invalidJsonLineCount += 1;
        continue;
      }

      addBehaviorSessionToAggregation(aggregationState, parsed);
      inputRecordCount += 1;
    }
  } finally {
    rl.close();
  }

  const { records, summary, audit } = finalizeBehaviorAggregation(
    aggregationState,
    args.month
  );

  await fs.promises.mkdir(outDir, { recursive: true });
  await writeJsonlStream(outAggregatedPath, records);
  await fs.promises.writeFile(outSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(outAuditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  for (const p of [outAggregatedPath, outSummaryPath, outAuditPath]) {
    if (!fs.existsSync(p)) throw new Error(`Output file missing: ${p}`);
    const stat = fs.statSync(p);
    console.log(`[PHASE5_FILE] ${path.basename(p)} size=${stat.size}`);
  }
  if (backupTarget) {
    console.log(`[PHASE5_BACKUP] ${backupTarget}`);
  }

  console.log("[PHASE5_SUMMARY]");
  console.log(
    JSON.stringify(
      {
        input_records: inputRecordCount,
        invalid_json_line_count: invalidJsonLineCount,
        total_entities: summary.total_entities,
        total_aggregated_patterns: summary.total_aggregated_patterns,
        high_confidence_patterns: summary.high_confidence_patterns,
        weak_patterns: summary.weak_patterns
      },
      null,
      2
    )
  );
  console.log("[PHASE5_AUDIT]");
  console.log(
    JSON.stringify(
      {
        contradictory_pattern_count: audit.contradictory_pattern_count,
        weak_single_session_pattern_count: audit.weak_single_session_pattern_count,
        unstable_pattern_count: audit.unstable_pattern_count,
        over_aggregated_pattern_count: audit.over_aggregated_pattern_count,
        unsupported_high_confidence_pattern_count:
          audit.unsupported_high_confidence_pattern_count,
        context_conflict_count: audit.context_conflict_count,
        entities_with_no_patterns: audit.entities_with_no_patterns
      },
      null,
      2
    )
  );
}

runPhase5(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[ERROR] Phase5 failed: ${message}`);
  process.exitCode = 1;
});
