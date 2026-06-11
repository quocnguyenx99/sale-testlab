import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  addPersonaDraftToAggregation,
  buildPersonaDraft,
  createPersonaDraftAggregationState,
  finalizePersonaDraftAggregation,
  PrunedEntityRecord
} from "./pipeline/personaDraftBuilder";

interface CliArgs {
  month: string;
}

function parseArgs(argv: string[]): CliArgs {
  let month = process.env.npm_config_month?.trim() ?? "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--month=")) {
      month = arg.slice("--month=".length).trim();
      continue;
    }
    if (arg === "--month") {
      month = (argv[i + 1] ?? "").trim();
      i += 1;
    }
  }
  if (!month) {
    throw new Error("Missing --month=YYYY-MM");
  }
  return { month };
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

async function buildPersonaDraftsLineByLine(
  inputPath: string,
  outputPath: string
): Promise<{
  processedEntities: number;
  invalidJsonLineCount: number;
  totalTendencies: number;
  summary: ReturnType<typeof finalizePersonaDraftAggregation>["summary"];
  audit: ReturnType<typeof finalizePersonaDraftAggregation>["audit"];
}> {
  const state = createPersonaDraftAggregationState();
  let processedEntities = 0;
  let invalidJsonLineCount = 0;
  let totalTendencies = 0;

  const reader = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  const writer = fs.createWriteStream(outputPath, { encoding: "utf8" });

  for await (const rawLine of reader) {
    const line = rawLine.trim();
    if (!line) continue;

    let entity: PrunedEntityRecord;
    try {
      entity = JSON.parse(line) as PrunedEntityRecord;
    } catch {
      invalidJsonLineCount += 1;
      continue;
    }

    const draft = buildPersonaDraft(entity);
    addPersonaDraftToAggregation(state, draft);
    totalTendencies += draft.behavioral_tendencies.length;
    writer.write(`${JSON.stringify(draft)}\n`);
    processedEntities += 1;
  }

  await new Promise<void>((resolve, reject) => {
    writer.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const { summary, audit } = finalizePersonaDraftAggregation(state);
  return { processedEntities, invalidJsonLineCount, totalTendencies, summary, audit };
}

async function main(): Promise<void> {
  const { month } = parseArgs(process.argv.slice(2));
  const inputDir = path.join("sale-testlab-data", "05c_pruned", month);
  const outputDir = path.join("sale-testlab-data", "06_persona_drafts", month);

  const inputJsonl = path.join(inputDir, "pruned_relationships.jsonl");
  const outDrafts = path.join(outputDir, "persona_drafts.jsonl");
  const outSummary = path.join(outputDir, "persona_summary.json");
  const outAudit = path.join(outputDir, "persona_audit.json");

  if (!fs.existsSync(inputJsonl)) {
    throw new Error(`Input file not found: ${inputJsonl}`);
  }

  ensureDir(outputDir);
  const { processedEntities, invalidJsonLineCount, totalTendencies, summary, audit } =
    await buildPersonaDraftsLineByLine(inputJsonl, outDrafts);

  writeJson(outSummary, summary);
  writeJson(outAudit, audit);

  const generatedFiles = [outDrafts, outSummary, outAudit];
  for (const f of generatedFiles) {
    if (!fs.existsSync(f)) {
      throw new Error(`Missing generated file: ${f}`);
    }
  }

  console.log(`Phase6 month=${month}`);
  console.log(`input_entities=${processedEntities}`);
  console.log(`generated_drafts=${summary.total_persona_drafts}`);
  console.log(`invalid_json=${invalidJsonLineCount}`);
  console.log(`total_tendencies=${totalTendencies}`);
  console.log("files:");
  console.log(`- ${outDrafts} (${fileSize(outDrafts)} bytes)`);
  console.log(`- ${outSummary} (${fileSize(outSummary)} bytes)`);
  console.log(`- ${outAudit} (${fileSize(outAudit)} bytes)`);
  console.log("summary_counts:");
  console.log(JSON.stringify(summary));
  console.log("audit_counts:");
  console.log(JSON.stringify(audit));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ERROR] Phase6 failed: ${message}`);
  process.exitCode = 1;
});
