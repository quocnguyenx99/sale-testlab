import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  addRefinedPersonaToAggregation,
  createPersonaRefinementAggregationState,
  finalizePersonaRefinementAggregation,
  PersonaDraft,
  refineOne
} from "./pipeline/personaRefiner";

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
  if (!month) throw new Error("Missing --month=YYYY-MM");
  return { month };
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function refinePersonaDraftsLineByLine(
  inputPath: string,
  outputPath: string
): Promise<{
  inputDrafts: number;
  invalidJsonLineCount: number;
  tendenciesBefore: number;
  tendenciesAfter: number;
  summary: ReturnType<typeof finalizePersonaRefinementAggregation>["summary"];
  audit: ReturnType<typeof finalizePersonaRefinementAggregation>["audit"];
}> {
  const state = createPersonaRefinementAggregationState();
  let inputDrafts = 0;
  let invalidJsonLineCount = 0;
  let tendenciesBefore = 0;
  let tendenciesAfter = 0;

  const reader = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  const writer = fs.createWriteStream(outputPath, { encoding: "utf8" });

  for await (const rawLine of reader) {
    const line = rawLine.trim();
    if (!line) continue;

    let draft: PersonaDraft;
    try {
      draft = JSON.parse(line) as PersonaDraft;
    } catch {
      invalidJsonLineCount += 1;
      continue;
    }

    const refinedPersona = refineOne(draft, state.stats);
    addRefinedPersonaToAggregation(state, refinedPersona);
    tendenciesBefore += draft.behavioral_tendencies.length;
    tendenciesAfter += refinedPersona.refined_tendencies.length;
    writer.write(`${JSON.stringify(refinedPersona)}\n`);
    inputDrafts += 1;
  }

  await new Promise<void>((resolve, reject) => {
    writer.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const { summary, audit } = finalizePersonaRefinementAggregation(state);
  return {
    inputDrafts,
    invalidJsonLineCount,
    tendenciesBefore,
    tendenciesAfter,
    summary,
    audit
  };
}

async function main(): Promise<void> {
  const { month } = parseArgs(process.argv.slice(2));
  const inputDir = path.join("sale-testlab-data", "06_persona_drafts", month);
  const outputDir = path.join("sale-testlab-data", "06c_refined_personas", month);

  const inputDrafts = path.join(inputDir, "persona_drafts.jsonl");
  const outRefined = path.join(outputDir, "refined_personas.jsonl");
  const outSummary = path.join(outputDir, "refined_persona_summary.json");
  const outAudit = path.join(outputDir, "refined_persona_audit.json");

  if (!fs.existsSync(inputDrafts)) {
    throw new Error(`Input file not found: ${inputDrafts}`);
  }

  ensureDir(outputDir);
  const {
    inputDrafts: processedDrafts,
    invalidJsonLineCount,
    tendenciesBefore,
    tendenciesAfter,
    summary,
    audit
  } = await refinePersonaDraftsLineByLine(inputDrafts, outRefined);

  writeJson(outSummary, summary);
  writeJson(outAudit, audit);

  for (const fp of [outRefined, outSummary, outAudit]) {
    if (!fs.existsSync(fp)) throw new Error(`Missing generated file: ${fp}`);
  }

  console.log(`Phase6C month=${month}`);
  console.log(`input_drafts=${processedDrafts}`);
  console.log(`refined_personas=${summary.total_refined_personas}`);
  console.log(`invalid_json=${invalidJsonLineCount}`);
  console.log(`tendencies_before=${tendenciesBefore}`);
  console.log(`tendencies_after=${tendenciesAfter}`);
  console.log("files:");
  console.log(`- ${outRefined} (${fileSize(outRefined)} bytes)`);
  console.log(`- ${outSummary} (${fileSize(outSummary)} bytes)`);
  console.log(`- ${outAudit} (${fileSize(outAudit)} bytes)`);
  console.log("summary_counts:");
  console.log(JSON.stringify(summary));
  console.log("audit_counts:");
  console.log(JSON.stringify(audit));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ERROR] Phase6C failed: ${message}`);
  process.exitCode = 1;
});
