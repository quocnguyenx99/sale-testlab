import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  addRuntimePersonaToAggregation,
  createRuntimePersonaAggregationState,
  finalizeRuntimePersonaAggregation,
  RefinedPersona,
  toRuntimePersona
} from "./pipeline/runtimePersonaBuilder";

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

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

async function buildRuntimePersonasLineByLine(
  inputPath: string,
  outputPath: string
): Promise<{
  inputRefinedPersonas: number;
  invalidJsonLineCount: number;
  summary: ReturnType<typeof finalizeRuntimePersonaAggregation>["summary"];
  audit: ReturnType<typeof finalizeRuntimePersonaAggregation>["audit"];
}> {
  const state = createRuntimePersonaAggregationState();
  let inputRefinedPersonas = 0;
  let invalidJsonLineCount = 0;

  const reader = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  const writer = fs.createWriteStream(outputPath, { encoding: "utf8" });

  for await (const rawLine of reader) {
    const line = rawLine.trim();
    if (!line) continue;

    let refinedPersona: RefinedPersona;
    try {
      refinedPersona = JSON.parse(line) as RefinedPersona;
    } catch {
      invalidJsonLineCount += 1;
      continue;
    }

    const runtimePersona = toRuntimePersona(refinedPersona, state.stats);
    addRuntimePersonaToAggregation(state, runtimePersona);
    writer.write(`${JSON.stringify(runtimePersona)}\n`);
    inputRefinedPersonas += 1;
  }

  await new Promise<void>((resolve, reject) => {
    writer.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const { summary, audit } = finalizeRuntimePersonaAggregation(state);
  return { inputRefinedPersonas, invalidJsonLineCount, summary, audit };
}

async function main(): Promise<void> {
  const { month } = parseArgs(process.argv.slice(2));

  const inputDir = path.join("sale-testlab-data", "06c_refined_personas", month);
  const outputDir = path.join("sale-testlab-data", "07_runtime_personas", month);

  const inputRefined = path.join(inputDir, "refined_personas.jsonl");
  const outPersonas = path.join(outputDir, "runtime_personas.jsonl");
  const outSummary = path.join(outputDir, "runtime_persona_summary.json");
  const outAudit = path.join(outputDir, "runtime_persona_audit.json");

  if (!fs.existsSync(inputRefined)) {
    throw new Error(`Input file not found: ${inputRefined}`);
  }

  ensureDir(outputDir);
  const { inputRefinedPersonas, invalidJsonLineCount, summary, audit } =
    await buildRuntimePersonasLineByLine(inputRefined, outPersonas);

  writeJson(outSummary, summary);
  writeJson(outAudit, audit);

  for (const fp of [outPersonas, outSummary, outAudit]) {
    if (!fs.existsSync(fp)) throw new Error(`Missing generated file: ${fp}`);
  }

  console.log(`Phase7 month=${month}`);
  console.log(`input_refined_personas=${inputRefinedPersonas}`);
  console.log(`runtime_personas=${summary.total_runtime_personas}`);
  console.log(`invalid_json=${invalidJsonLineCount}`);
  console.log("files:");
  console.log(`- ${outPersonas} (${fileSize(outPersonas)} bytes)`);
  console.log(`- ${outSummary} (${fileSize(outSummary)} bytes)`);
  console.log(`- ${outAudit} (${fileSize(outAudit)} bytes)`);
  console.log("summary_counts:");
  console.log(JSON.stringify(summary));
  console.log("audit_counts:");
  console.log(JSON.stringify(audit));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ERROR] Phase7 failed: ${message}`);
  process.exitCode = 1;
});
