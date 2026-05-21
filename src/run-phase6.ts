import * as fs from "fs";
import * as path from "path";
import {
  buildPersonaDrafts,
  PrunedEntityRecord,
  PersonaDraft
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

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: T[] = [];
  for (const line of lines) {
    out.push(JSON.parse(line) as T);
  }
  return out;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  fs.writeFileSync(filePath, body.length > 0 ? `${body}\n` : "", "utf8");
}

function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

function maskEntity(entityId: string): string {
  if (!entityId) return "unknown***";
  if (entityId.length <= 6) return `${entityId.slice(0, 2)}***`;
  return `${entityId.slice(0, 3)}***${entityId.slice(-3)}`;
}

function previewDraft(d: PersonaDraft): Record<string, unknown> {
  return {
    entity_id: maskEntity(d.entity_id),
    evidence_strength: d.evidence_strength,
    dominant_contexts: d.dominant_contexts,
    tendency_count: d.behavioral_tendencies.length,
    top_tendencies: d.behavioral_tendencies.slice(0, 3).map((t) => t.tendency_name),
    risk_flags: d.risk_flags
  };
}

function main(): void {
  const { month } = parseArgs(process.argv.slice(2));
  const inputDir = path.join("sale-testlab-data", "05c_pruned", month);
  const outputDir = path.join("sale-testlab-data", "06_persona_drafts", month);

  const inputJsonl = path.join(inputDir, "pruned_relationships.jsonl");
  const outDrafts = path.join(outputDir, "persona_drafts.jsonl");
  const outSummary = path.join(outputDir, "persona_summary.json");
  const outAudit = path.join(outputDir, "persona_audit.json");

  const entities = readJsonl<PrunedEntityRecord>(inputJsonl);
  const { drafts, summary, audit } = buildPersonaDrafts(entities);

  ensureDir(outputDir);
  writeJsonl(outDrafts, drafts);
  writeJson(outSummary, summary);
  writeJson(outAudit, audit);

  const generatedFiles = [outDrafts, outSummary, outAudit];
  for (const f of generatedFiles) {
    if (!fs.existsSync(f)) {
      throw new Error(`Missing generated file: ${f}`);
    }
  }

  const previews = drafts.slice(0, 3).map(previewDraft);

  console.log(`Phase6 month=${month}`);
  console.log(`input_entities=${entities.length}`);
  console.log(`generated_drafts=${drafts.length}`);
  console.log(`total_tendencies=${drafts.reduce((a, d) => a + d.behavioral_tendencies.length, 0)}`);
  console.log("files:");
  console.log(`- ${outDrafts} (${fileSize(outDrafts)} bytes)`);
  console.log(`- ${outSummary} (${fileSize(outSummary)} bytes)`);
  console.log(`- ${outAudit} (${fileSize(outAudit)} bytes)`);
  console.log("preview_first_3_masked:");
  for (const p of previews) {
    console.log(JSON.stringify(p));
  }
  console.log("summary_counts:");
  console.log(JSON.stringify(summary));
  console.log("audit_counts:");
  console.log(JSON.stringify(audit));
}

main();
