import * as fs from "fs";
import * as path from "path";
import {
  RefinedPersona,
  buildRuntimePersonas,
  RuntimePersona
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

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) throw new Error(`Input file not found: ${filePath}`);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  return lines.map((line) => JSON.parse(line) as T);
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  fs.writeFileSync(filePath, body ? `${body}\n` : "", "utf8");
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

function maskEntity(entityId: string): string {
  if (!entityId) return "unk***";
  if (entityId.length < 8) return `${entityId.slice(0, 2)}***`;
  return `${entityId.slice(0, 3)}***${entityId.slice(-3)}`;
}

function preview(p: RuntimePersona): Record<string, unknown> {
  return {
    runtime_persona_id: p.runtime_persona_id,
    source_entity_id: maskEntity(p.source_entity_id),
    runtime_readiness: p.runtime_readiness,
    runtime_usefulness_score: p.runtime_usefulness_score,
    primary_contexts: p.primary_contexts,
    top_patterns: p.interaction_patterns.slice(0, 3).map((x) => x.pattern_name),
    risk_flags: p.risk_flags
  };
}

function main(): void {
  const { month } = parseArgs(process.argv.slice(2));

  const inputDir = path.join("sale-testlab-data", "06c_refined_personas", month);
  const outputDir = path.join("sale-testlab-data", "07_runtime_personas", month);

  const inputRefined = path.join(inputDir, "refined_personas.jsonl");
  const outPersonas = path.join(outputDir, "runtime_personas.jsonl");
  const outSummary = path.join(outputDir, "runtime_persona_summary.json");
  const outAudit = path.join(outputDir, "runtime_persona_audit.json");

  const refined = readJsonl<RefinedPersona>(inputRefined);
  const { runtimePersonas, summary, audit } = buildRuntimePersonas(refined);

  ensureDir(outputDir);
  writeJsonl(outPersonas, runtimePersonas);
  writeJson(outSummary, summary);
  writeJson(outAudit, audit);

  for (const fp of [outPersonas, outSummary, outAudit]) {
    if (!fs.existsSync(fp)) throw new Error(`Missing generated file: ${fp}`);
  }

  console.log(`Phase7 month=${month}`);
  console.log(`input_refined_personas=${refined.length}`);
  console.log(`runtime_personas=${runtimePersonas.length}`);
  console.log("files:");
  console.log(`- ${outPersonas} (${fileSize(outPersonas)} bytes)`);
  console.log(`- ${outSummary} (${fileSize(outSummary)} bytes)`);
  console.log(`- ${outAudit} (${fileSize(outAudit)} bytes)`);
  console.log("preview_first_3_masked:");
  for (const p of runtimePersonas.slice(0, 3)) {
    console.log(JSON.stringify(preview(p)));
  }
  console.log("summary_counts:");
  console.log(JSON.stringify(summary));
  console.log("audit_counts:");
  console.log(JSON.stringify(audit));
}

main();
