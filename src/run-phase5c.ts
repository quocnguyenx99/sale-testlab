import * as fs from "fs";
import * as path from "path";
import {
  pruneContextRelationships,
  type ContextualRecord
} from "./pipeline/relationshipPruner";

type Phase5CArgs = { month: string };

function parseCliArgs(argv: string[]): Phase5CArgs {
  let month = "";
  for (const arg of argv) {
    if (arg.startsWith("--month=")) month = arg.slice("--month=".length);
  }
  if (!month && process.env.npm_config_month) month = process.env.npm_config_month;
  if (!month) throw new Error("Missing required arg: --month=YYYY-MM");
  return { month };
}

function parseJsonl<T>(filePath: string): T[] {
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
      // deterministic skip
    }
  }
  return out;
}

async function runPhase5C(args: Phase5CArgs): Promise<void> {
  const dataDir = path.resolve("sale-testlab-data");
  const inputPath = path.join(dataDir, "05b_context", args.month, "contextual_relationships.jsonl");
  const outDir = path.join(dataDir, "05c_pruned", args.month);
  const outPruned = path.join(outDir, "pruned_relationships.jsonl");
  const outSummary = path.join(outDir, "pruning_summary.json");
  const outAudit = path.join(outDir, "pruning_audit.json");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const records = parseJsonl<ContextualRecord>(inputPath);
  const { records: pruned, summary, audit } = pruneContextRelationships(records);

  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(
    outPruned,
    pruned.length ? `${pruned.map((r) => JSON.stringify(r)).join("\n")}\n` : "",
    "utf8"
  );
  await fs.promises.writeFile(outSummary, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  for (const p of [outPruned, outSummary, outAudit]) {
    if (!fs.existsSync(p)) throw new Error(`Output file missing: ${p}`);
    const stat = fs.statSync(p);
    console.log(`[PHASE5C_FILE] ${path.basename(p)} size=${stat.size}`);
  }

  const topKept = pruned
    .flatMap((r) =>
      r.pruned_relationships
        .filter((x) => x.pruning_status !== "pruned")
        .map((x) => ({ entity_id: r.entity_id, relationship_name: x.relationship_name, relevance_score: x.relevance_score }))
    )
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 20);

  const topPruned = pruned
    .flatMap((r) =>
      r.pruned_relationships
        .filter((x) => x.pruning_status === "pruned")
        .map((x) => ({ entity_id: r.entity_id, relationship_name: x.relationship_name, relevance_score: x.relevance_score, pruning_reason: x.pruning_reason }))
    )
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 20);

  const preview = pruned.slice(0, 5).map((r) => ({
    entity_id: r.entity_id,
    relationships_before: r.relationships_before,
    relationships_after: r.relationships_after,
    kept_count: r.pruned_relationships.filter((x) => x.pruning_status === "kept").length,
    downgraded_count: r.pruned_relationships.filter((x) => x.pruning_status === "downgraded").length,
    pruned_count: r.pruned_relationships.filter((x) => x.pruning_status === "pruned").length
  }));

  console.log("[PHASE5C_TOP_KEPT]");
  console.log(JSON.stringify(topKept, null, 2));
  console.log("[PHASE5C_TOP_PRUNED]");
  console.log(JSON.stringify(topPruned, null, 2));
  console.log("[PHASE5C_PREVIEW] first_5_entities=");
  console.log(JSON.stringify(preview, null, 2));
  console.log("[PHASE5C_SUMMARY]");
  console.log(JSON.stringify(summary, null, 2));
  console.log("[PHASE5C_AUDIT]");
  console.log(JSON.stringify(audit, null, 2));
}

runPhase5C(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[ERROR] Phase5C failed: ${message}`);
  process.exitCode = 1;
});

