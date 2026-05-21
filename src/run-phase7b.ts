import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { buildArchetypes, RuntimePersona } from "./pipeline/personaArchetypeBuilder";

const baseDir = path.join(process.cwd(), "sale-testlab-data");

async function run() {
  // Parse month arg
  const monthArg = process.argv.find((a) => a.startsWith("--month="));
  const monthEnv = process.env.npm_config_month;
  const month = monthArg ? monthArg.split("=")[1] : monthEnv;

  if (!month) {
    console.error("Usage: npm run phase7b -- --month=YYYY-MM");
    process.exit(1);
  }

  const inputPath = path.join(baseDir, "07_runtime_personas", month, "runtime_personas.jsonl");
  const outputDir = path.join(baseDir, "07b_persona_archetypes", month);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Ensure output directory exists
  await fs.promises.mkdir(outputDir, { recursive: true });

  const personasInput: RuntimePersona[] = [];

  const fileStream = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      // Ensure sales_behavior exists to avoid undefined errors if older schema
      if (!parsed.runtime_behavior_profile) parsed.runtime_behavior_profile = {};
      if (!parsed.runtime_behavior_profile.sales_behavior) parsed.runtime_behavior_profile.sales_behavior = [];
      personasInput.push(parsed as RuntimePersona);
    } catch (e) {
      console.warn("Failed to parse runtime persona:", line.substring(0, 50));
    }
  }

  console.log(`Phase 7B - Loaded ${personasInput.length} runtime personas for ${month}`);

  const result = buildArchetypes(personasInput);

  const archetypesPath = path.join(outputDir, "persona_archetypes.jsonl");
  const summaryPath = path.join(outputDir, "archetype_summary.json");
  const auditPath = path.join(outputDir, "archetype_audit.json");

  // Write files
  await fs.promises.writeFile(
    archetypesPath,
    result.archetypes.map((a) => JSON.stringify(a)).join("\n") + "\n",
    "utf8"
  );
  await fs.promises.writeFile(summaryPath, JSON.stringify(result.summary, null, 2) + "\n", "utf8");
  await fs.promises.writeFile(auditPath, JSON.stringify(result.audit, null, 2) + "\n", "utf8");

  // Optional outliers export for inspection
  if (result.outliers.length > 0) {
    await fs.promises.writeFile(
      path.join(outputDir, "weak_archetypes_outliers.jsonl"),
      result.outliers.map((o) => JSON.stringify(o)).join("\n") + "\n",
      "utf8"
    );
  }

  // Console report
  console.log(`\nPhase 7B Archetype Builder Completed!`);
  console.log(`Generated Archetypes: ${result.archetypes.length}`);
  console.log(`Excluded archive_only personas: ${result.audit.archive_only_excluded}`);
  console.log(`Outlier weak archetypes: ${result.outliers.length}`);
  console.log(`\nTop 5 Archetypes by Source Count:`);
  result.summary.top_archetypes_by_source_count.forEach((a: any) => {
    console.log(` - ${a.name}: ${a.count} personas`);
  });

  if (result.audit.oversized_archetypes.length > 0) {
    console.warn(`\n[WARNING] Oversized Archetypes Detected (>20% of grouping pool):`);
    result.audit.oversized_archetypes.forEach((name: string) => {
      console.warn(` - ${name}`);
    });
  }
}

run().catch((e) => {
  console.error("Phase 7B Error:", e);
  process.exit(1);
});
