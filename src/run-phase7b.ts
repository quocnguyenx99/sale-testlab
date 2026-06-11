import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { buildArchetypes, RuntimePersona } from "./pipeline/personaArchetypeBuilder";

const baseDir = path.join(process.cwd(), "sale-testlab-data");

function parseMonthArg(argv: string[]): string {
  const monthArg = argv.find((a) => a.startsWith("--month="));
  const monthEnv = process.env.npm_config_month;
  const month = monthArg ? monthArg.split("=")[1] : monthEnv;
  if (!month) {
    throw new Error("Missing --month=YYYY-MM");
  }
  return month;
}

function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

async function writeJsonlIncremental(filePath: string, rows: unknown[]): Promise<void> {
  const writer = fs.createWriteStream(filePath, { encoding: "utf8" });
  for (const row of rows) {
    writer.write(`${JSON.stringify(row)}\n`);
  }
  await new Promise<void>((resolve, reject) => {
    writer.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function loadRuntimePersonas(
  inputPath: string
): Promise<{ personas: RuntimePersona[]; invalidJsonLineCount: number }> {
  const personas: RuntimePersona[] = [];
  let invalidJsonLineCount = 0;

  const fileStream = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (!parsed.runtime_behavior_profile) parsed.runtime_behavior_profile = {};
      if (!parsed.runtime_behavior_profile.sales_behavior) {
        parsed.runtime_behavior_profile.sales_behavior = [];
      }
      personas.push(parsed as RuntimePersona);
    } catch {
      invalidJsonLineCount += 1;
    }
  }

  return { personas, invalidJsonLineCount };
}

async function run(): Promise<void> {
  const month = parseMonthArg(process.argv);

  const inputPath = path.join(baseDir, "07_runtime_personas", month, "runtime_personas.jsonl");
  const outputDir = path.join(baseDir, "07b_persona_archetypes", month);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  await fs.promises.rm(outputDir, { recursive: true, force: true });
  await fs.promises.mkdir(outputDir, { recursive: true });

  const { personas, invalidJsonLineCount } = await loadRuntimePersonas(inputPath);
  const result = buildArchetypes(personas);

  const archetypesPath = path.join(outputDir, "persona_archetypes.jsonl");
  const summaryPath = path.join(outputDir, "archetype_summary.json");
  const auditPath = path.join(outputDir, "archetype_audit.json");
  const outliersPath = path.join(outputDir, "weak_archetypes_outliers.jsonl");

  await writeJsonlIncremental(archetypesPath, result.archetypes);
  await fs.promises.writeFile(summaryPath, `${JSON.stringify(result.summary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(auditPath, `${JSON.stringify(result.audit, null, 2)}\n`, "utf8");

  if (result.outliers.length > 0) {
    await writeJsonlIncremental(outliersPath, result.outliers);
  }

  for (const fp of [archetypesPath, summaryPath, auditPath]) {
    if (!fs.existsSync(fp)) throw new Error(`Missing generated file: ${fp}`);
  }

  console.log(`Phase7B month=${month}`);
  console.log(`input_runtime_personas=${personas.length}`);
  console.log(`invalid_json=${invalidJsonLineCount}`);
  console.log(`generated_archetypes=${result.archetypes.length}`);
  console.log(`outlier_archetypes=${result.outliers.length}`);
  console.log("files:");
  console.log(`- ${archetypesPath} (${fileSize(archetypesPath)} bytes)`);
  console.log(`- ${summaryPath} (${fileSize(summaryPath)} bytes)`);
  console.log(`- ${auditPath} (${fileSize(auditPath)} bytes)`);
  if (result.outliers.length > 0) {
    console.log(`- ${outliersPath} (${fileSize(outliersPath)} bytes)`);
  }
  console.log("summary_counts:");
  console.log(
    JSON.stringify({
      total_archetypes: result.summary.total_archetypes,
      difficulty_distribution: result.summary.difficulty_distribution,
      evidence_strength_distribution: result.summary.evidence_strength_distribution,
      excluded_persona_count: result.summary.excluded_persona_count
    })
  );
  console.log("audit_counts:");
  console.log(
    JSON.stringify({
      total_runtime_personas_input: result.audit.total_runtime_personas_input,
      approved_personas_grouped: result.audit.approved_personas_grouped,
      limited_personas_grouped: result.audit.limited_personas_grouped,
      archive_only_excluded: result.audit.archive_only_excluded,
      total_archetypes: result.audit.total_archetypes,
      outlier_personas: result.audit.outlier_personas,
      duplicate_archetype_candidates: result.audit.duplicate_archetype_candidates,
      oversized_archetype_count: Array.isArray(result.audit.oversized_archetypes)
        ? result.audit.oversized_archetypes.length
        : 0,
      weak_archetype_count: Array.isArray(result.audit.weak_archetypes)
        ? result.audit.weak_archetypes.length
        : 0,
      risk_flags_summary: result.audit.risk_flags_summary
    })
  );
}

run().catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`Phase 7B Error: ${message}`);
  process.exit(1);
});
