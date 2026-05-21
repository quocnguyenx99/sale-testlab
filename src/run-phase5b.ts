import * as fs from "fs";
import * as path from "path";
import {
  buildContextualRelationships,
  type AggregatedBehaviorRecord
} from "./pipeline/contextRelationshipBuilder";

type Phase5BArgs = { month: string };

function parseCliArgs(argv: string[]): Phase5BArgs {
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
  const rows: T[] = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line) as T);
    } catch {
      // deterministic skip
    }
  }
  return rows;
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

  const entities = parseJsonlFile<AggregatedBehaviorRecord>(inputPath);
  const { records, summary, audit } = buildContextualRelationships(entities);

  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(
    outRelationshipsPath,
    records.length ? `${records.map((r) => JSON.stringify(r)).join("\n")}\n` : "",
    "utf8"
  );
  await fs.promises.writeFile(outSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(outAuditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  for (const p of [outRelationshipsPath, outSummaryPath, outAuditPath]) {
    if (!fs.existsSync(p)) throw new Error(`Output file missing: ${p}`);
    const stat = fs.statSync(p);
    console.log(`[PHASE5B_FILE] ${path.basename(p)} size=${stat.size}`);
  }

  const preview = records.slice(0, 5).map((r) => ({
    entity_id: r.entity_id,
    relationship_count: r.context_relationships.length,
    dominant_contexts: r.dominant_contexts,
    top_relationships: r.context_relationships.slice(0, 3).map((x) => x.relationship_name),
    risk_flags: r.risk_flags
  }));
  console.log("[PHASE5B_PREVIEW] first_5_records=");
  console.log(JSON.stringify(preview, null, 2));
  console.log("[PHASE5B_SUMMARY]");
  console.log(JSON.stringify(summary, null, 2));
  console.log("[PHASE5B_AUDIT]");
  console.log(JSON.stringify(audit, null, 2));
}

runPhase5B(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[ERROR] Phase5B failed: ${message}`);
  process.exitCode = 1;
});

