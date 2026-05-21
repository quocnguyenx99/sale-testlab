import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { buildTrainingPersonas, Archetype } from "./pipeline/trainingPersonaBuilder";

const baseDir = path.join(process.cwd(), "sale-testlab-data");

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

  // Console report
  console.log(`\nPhase 10 Training Persona Builder Completed!`);
  console.log(`Input Archetypes: ${archetypes.length}`);
  console.log(`Output Training Personas: ${result.personas.length}`);

  const diff = (result.summary as any).difficulty_distribution;
  console.log(`\nDifficulty Distribution:`);
  console.log(`  Easy:   ${diff.easy}`);
  console.log(`  Medium: ${diff.medium}`);
  console.log(`  Hard:   ${diff.hard}`);

  console.log(`\nTop 10 Training Personas:`);
  const sorted = [...result.personas].sort((a, b) => b.evidence_summary.source_count - a.evidence_summary.source_count);
  sorted.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.difficulty.toUpperCase()}] ${p.name} (source: ${p.evidence_summary.source_count})`);
  });

  const audit = result.audit as any;
  console.log(`\nMapping Coverage: ${audit.mapping_coverage_rate}%`);
  if (audit.unmapped_patterns.length > 0) {
    console.warn(`[WARN] Unmapped patterns: ${audit.unmapped_patterns.join(", ")}`);
  }

  console.log(`\nSample First 5 Training Persona Configs:`);
  result.personas.slice(0, 5).forEach(p => {
    console.log(`\n--- ${p.name} ---`);
    console.log(`  ID:             ${p.persona_id}`);
    console.log(`  Difficulty:     ${p.difficulty}`);
    console.log(`  Role Prompt:    ${p.role_prompt.substring(0, 100)}...`);
    console.log(`  Behavior Rules: ${p.behavior_rules[0] ?? "N/A"}`);
    console.log(`  Opening Msg:    ${p.opening_messages[0] ?? "N/A"}`);
    console.log(`  Training Focus: ${p.sale_training_focus.join(", ")}`);
  });

  console.log(`\n[AUDIT] Emotional label violations: ${audit.emotional_label_violations}`);
  console.log(`[AUDIT] Raw content leak check: ${audit.raw_content_leak_check ? "PASS" : "FAIL"}`);
  console.log(`[AUDIT] Personas with fallback rules: ${audit.personas_with_fallback_rules}`);
}

run().catch((e) => {
  console.error("Phase 10 Error:", e);
  process.exit(1);
});
