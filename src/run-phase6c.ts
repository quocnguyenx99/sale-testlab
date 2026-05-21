import * as fs from "fs";
import * as path from "path";
import {
  refinePersonaDrafts,
  PersonaDraft,
  RefinedPersona
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

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) throw new Error(`Input file not found: ${filePath}`);
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
  return lines.map((line) => JSON.parse(line) as T);
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  fs.writeFileSync(filePath, body ? `${body}\n` : "", "utf8");
}

function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function maskEntity(entityId: string): string {
  if (!entityId) return "unk***";
  if (entityId.length < 8) return `${entityId.slice(0, 2)}***`;
  return `${entityId.slice(0, 3)}***${entityId.slice(-3)}`;
}

function previewPersona(p: RefinedPersona): Record<string, unknown> {
  return {
    entity_id: maskEntity(p.entity_id),
    runtime_usefulness_score: p.runtime_usefulness_score,
    evidence_quality: p.evidence_quality,
    dominant_contexts: p.dominant_contexts,
    tendency_count: p.refined_tendencies.length,
    top_tendencies: p.refined_tendencies.slice(0, 3).map((t) => t.tendency_name),
    removed_tendency_count: p.removed_tendencies.length,
    runtime_risk_flags: p.runtime_risk_flags
  };
}

function main(): void {
  const { month } = parseArgs(process.argv.slice(2));
  const inputDir = path.join("sale-testlab-data", "06_persona_drafts", month);
  const outputDir = path.join("sale-testlab-data", "06c_refined_personas", month);

  const inputDrafts = path.join(inputDir, "persona_drafts.jsonl");
  const outRefined = path.join(outputDir, "refined_personas.jsonl");
  const outSummary = path.join(outputDir, "refined_persona_summary.json");
  const outAudit = path.join(outputDir, "refined_persona_audit.json");

  const drafts = readJsonl<PersonaDraft>(inputDrafts);
  const { refined, summary, audit } = refinePersonaDrafts(drafts);

  ensureDir(outputDir);
  writeJsonl(outRefined, refined);
  writeJson(outSummary, summary);
  writeJson(outAudit, audit);

  for (const fp of [outRefined, outSummary, outAudit]) {
    if (!fs.existsSync(fp)) throw new Error(`Missing generated file: ${fp}`);
  }

  console.log(`Phase6C month=${month}`);
  console.log(`input_drafts=${drafts.length}`);
  console.log(`refined_personas=${refined.length}`);
  console.log(
    `tendencies_before=${drafts.reduce((a, b) => a + b.behavioral_tendencies.length, 0)}`
  );
  console.log(
    `tendencies_after=${refined.reduce((a, b) => a + b.refined_tendencies.length, 0)}`
  );
  console.log("files:");
  console.log(`- ${outRefined} (${fileSize(outRefined)} bytes)`);
  console.log(`- ${outSummary} (${fileSize(outSummary)} bytes)`);
  console.log(`- ${outAudit} (${fileSize(outAudit)} bytes)`);
  console.log("preview_first_3_masked:");
  for (const p of refined.slice(0, 3)) {
    console.log(JSON.stringify(previewPersona(p)));
  }
  console.log("summary_counts:");
  console.log(JSON.stringify(summary));
  console.log("audit_counts:");
  console.log(JSON.stringify(audit));
}

main();
