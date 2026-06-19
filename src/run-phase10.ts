import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { buildTrainingPersonas, Archetype } from "./pipeline/trainingPersonaBuilder";

const baseDir = path.join(process.cwd(), "sale-testlab-data");

function formatDifficultyDistribution(diff: Record<string, number> | undefined): string {
  if (!diff) return "easy=0 medium=0 hard=0";
  return `easy=${diff.easy ?? 0} medium=${diff.medium ?? 0} hard=${diff.hard ?? 0}`;
}

function safeTopPersonaRows(
  personas: Array<{
    persona_id: string;
    difficulty: string;
    evidence_summary: { source_count: number };
  }>,
  limit = 5
): string[] {
  return [...personas]
    .sort((a, b) => b.evidence_summary.source_count - a.evidence_summary.source_count)
    .slice(0, limit)
    .map(
      (p, index) =>
        `  ${index + 1}. ${p.persona_id} | difficulty=${p.difficulty} | source_count=${p.evidence_summary.source_count}`
    );
}

async function run() {
  const monthArg = process.argv.find((a) => a.startsWith("--month="));
  const monthEnv = process.env.npm_config_month;
  const month = monthArg ? monthArg.split("=")[1] : monthEnv;

  if (!month) {
    console.error("Usage: npm run phase10 -- --month=YYYY-MM");
    process.exit(1);
  }

  const inputPath = path.join(baseDir, "07b_persona_archetypes", month, "persona_archetypes.jsonl");
  const outputDir = path.join(baseDir, "10_training_personas", month);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  await fs.promises.mkdir(outputDir, { recursive: true });

  const archetypes: Archetype[] = [];
  const fileStream = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      archetypes.push(JSON.parse(line) as Archetype);
    } catch {
      console.warn("[WARN] Failed to parse archetype line");
    }
  }

  console.log(`Phase 10 - Loaded ${archetypes.length} archetypes for ${month}`);

  const result = buildTrainingPersonas(archetypes);

  const personasPath = path.join(outputDir, "training_personas.jsonl");
  const summaryPath = path.join(outputDir, "training_persona_summary.json");
  const auditPath = path.join(outputDir, "training_persona_audit.json");

  await fs.promises.writeFile(
    personasPath,
    result.personas.map((p) => JSON.stringify(p)).join("\n") + "\n",
    "utf8"
  );
  await fs.promises.writeFile(summaryPath, JSON.stringify(result.summary, null, 2) + "\n", "utf8");
  await fs.promises.writeFile(auditPath, JSON.stringify(result.audit, null, 2) + "\n", "utf8");

  const personasStat = await fs.promises.stat(personasPath);
  const summaryStat = await fs.promises.stat(summaryPath);
  const auditStat = await fs.promises.stat(auditPath);
  console.log(`\nPhase 10 Training Persona Builder Completed!`);
  console.log(`month=${month}`);
  console.log(`input_path=${inputPath}`);
  console.log(`output_dir=${outputDir}`);
  console.log(`input_archetypes=${archetypes.length}`);
  console.log(`output_training_personas=${result.personas.length}`);
  console.log(`output_training_personas_size=${personasStat.size}`);
  console.log(`summary_path=${summaryPath}`);
  console.log(`summary_size=${summaryStat.size}`);
  console.log(`audit_path=${auditPath}`);
  console.log(`audit_size=${auditStat.size}`);

  const diff = (result.summary as any).difficulty_distribution;
  const audit = result.audit as any;
  console.log(`difficulty_distribution=${formatDifficultyDistribution(diff)}`);
  console.log(`mapping_coverage_rate=${audit.mapping_coverage_rate}%`);
  console.log(`unmapped_pattern_count=${Array.isArray(audit.unmapped_patterns) ? audit.unmapped_patterns.length : 0}`);
  console.log(`personas_with_fallback_rules=${audit.personas_with_fallback_rules}`);
  console.log(`emotional_label_violations=${audit.emotional_label_violations}`);
  console.log(`raw_content_leak_check=${audit.raw_content_leak_check ? "PASS" : "FAIL"}`);
  console.log(`top_persona_rows:`);
  safeTopPersonaRows(result.personas).forEach((line) => console.log(line));
}

run().catch((e) => {
  console.error("Phase 10 Error:", e);
  process.exit(1);
});
