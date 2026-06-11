import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  pruneContextRelationships,
  type PruningAudit,
  type PruningSummary,
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

function createEmptySummary(): PruningSummary {
  return {
    total_entities: 0,
    relationships_before: 0,
    relationships_after: 0,
    relationships_pruned: 0,
    relationships_downgraded: 0,
    relationships_kept: 0,
    high_value_relationships: 0,
    medium_value_relationships: 0,
    low_value_relationships: 0,
    timing_noise_removed: 0,
    average_relationships_per_entity_before: 0,
    average_relationships_per_entity_after: 0
  };
}

function createEmptyAudit(): PruningAudit {
  return {
    overconnected_entities_before: 0,
    overconnected_entities_after: 0,
    timing_only_relationships_removed: 0,
    weak_relationships_removed: 0,
    operational_relationships_preserved: 0,
    sales_relationships_preserved: 0,
    high_value_relationship_loss: 0,
    risk_flags_summary: {}
  };
}

function mergeSummary(target: PruningSummary, source: PruningSummary): void {
  target.total_entities += source.total_entities;
  target.relationships_before += source.relationships_before;
  target.relationships_after += source.relationships_after;
  target.relationships_pruned += source.relationships_pruned;
  target.relationships_downgraded += source.relationships_downgraded;
  target.relationships_kept += source.relationships_kept;
  target.high_value_relationships += source.high_value_relationships;
  target.medium_value_relationships += source.medium_value_relationships;
  target.low_value_relationships += source.low_value_relationships;
  target.timing_noise_removed += source.timing_noise_removed;
}

function mergeAudit(target: PruningAudit, source: PruningAudit): void {
  target.overconnected_entities_before += source.overconnected_entities_before;
  target.overconnected_entities_after += source.overconnected_entities_after;
  target.timing_only_relationships_removed += source.timing_only_relationships_removed;
  target.weak_relationships_removed += source.weak_relationships_removed;
  target.operational_relationships_preserved += source.operational_relationships_preserved;
  target.sales_relationships_preserved += source.sales_relationships_preserved;
  target.high_value_relationship_loss += source.high_value_relationship_loss;
  for (const [key, value] of Object.entries(source.risk_flags_summary)) {
    target.risk_flags_summary[key] = (target.risk_flags_summary[key] ?? 0) + value;
  }
}

function finalizeSummary(summary: PruningSummary): PruningSummary {
  const total = summary.total_entities;
  return {
    ...summary,
    average_relationships_per_entity_before: total
      ? Number((summary.relationships_before / total).toFixed(4))
      : 0,
    average_relationships_per_entity_after: total
      ? Number((summary.relationships_after / total).toFixed(4))
      : 0
  };
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

  await fs.promises.rm(outDir, { recursive: true, force: true });
  await fs.promises.mkdir(outDir, { recursive: true });

  const summary = createEmptySummary();
  const audit = createEmptyAudit();
  let processedRecords = 0;
  let invalidJsonLineCount = 0;

  const reader = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  const writer = fs.createWriteStream(outPruned, { encoding: "utf8" });

  for await (const rawLine of reader) {
    const line = rawLine.trim();
    if (!line) continue;

    let record: ContextualRecord;
    try {
      record = JSON.parse(line) as ContextualRecord;
    } catch {
      invalidJsonLineCount += 1;
      continue;
    }

    const result = pruneContextRelationships([record]);
    const prunedRecord = result.records[0];
    if (!prunedRecord) continue;

    writer.write(`${JSON.stringify(prunedRecord)}\n`);
    mergeSummary(summary, result.summary);
    mergeAudit(audit, result.audit);
    processedRecords += 1;
  }

  await new Promise<void>((resolve, reject) => {
    writer.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const finalizedSummary = finalizeSummary(summary);
  await fs.promises.writeFile(outSummary, `${JSON.stringify(finalizedSummary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(outAudit, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  for (const p of [outPruned, outSummary, outAudit]) {
    if (!fs.existsSync(p)) throw new Error(`Output file missing: ${p}`);
    const stat = fs.statSync(p);
    console.log(`[PHASE5C_FILE] ${path.basename(p)} size=${stat.size}`);
  }

  console.log(`[PHASE5C_RECORDS] processed=${processedRecords} invalid_json=${invalidJsonLineCount}`);
  console.log("[PHASE5C_SUMMARY]");
  console.log(JSON.stringify(finalizedSummary, null, 2));
  console.log("[PHASE5C_AUDIT]");
  console.log(JSON.stringify(audit, null, 2));
}

runPhase5C(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[ERROR] Phase5C failed: ${message}`);
  process.exitCode = 1;
});
