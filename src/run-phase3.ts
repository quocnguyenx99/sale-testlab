import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { log } from "./utils/logger";
import {
  buildSessionAudit,
  buildSessions,
  buildSessionSummary,
  type BuildSessionsResult,
  type SessionRecord
} from "./pipeline/sessionBuilder";
import type { MessageCategory } from "./types/pipeline";

type Phase3Args = { month: string };

const ClassifiedMessageSchema = z.object({
  message_id: z.string(),
  conversation_id: z.string(),
  sender_id: z.string(),
  sender_name: z.string(),
  content_type: z.enum(["text", "image", "file", "sticker", "undo", "bankcard", "unknown"]),
  text: z.string(),
  raw_content: z.union([z.record(z.string(), z.any()), z.string(), z.null()]),
  created_at: z.string(),
  source_file: z.string(),
  source_file_hash: z.string(),
  month: z.string(),
  parse_status: z.enum(["ok", "content_json_failed", "row_parse_failed"]),
  parse_warnings: z.array(z.string()),
  message_category: z.enum([
    "internal_operation",
    "accounting",
    "logistics",
    "warehouse",
    "sales",
    "customer_support",
    "casual_chat",
    "media_only",
    "noise",
    "unknown"
  ]),
  confidence: z.number(),
  confidence_reason: z.array(z.string()),
  is_internal: z.boolean(),
  is_noise: z.boolean(),
  candidate_sales: z.boolean(),
  persona_signal: z.boolean(),
  filter_reason: z.string(),
  matched_rules: z.array(z.string())
});

type ClassifiedMessage = z.infer<typeof ClassifiedMessageSchema> & {
  message_category: MessageCategory;
};

function parseCliArgs(argv: string[]): Phase3Args {
  let month = "";
  for (const arg of argv) {
    if (arg.startsWith("--month=")) month = arg.slice("--month=".length);
  }
  if (!month && process.env.npm_config_month) {
    month = process.env.npm_config_month;
  }
  if (!month) throw new Error("Missing required arg: --month=YYYY-MM");
  return { month };
}

function parseJsonlFile<T>(filePath: string, schema: z.ZodType<T>): T[] {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => schema.parse(JSON.parse(line) as unknown));
}

async function runPhase3(args: Phase3Args): Promise<void> {
  const baseDir = path.resolve("sale-testlab-data");
  const inputPath = path.join(baseDir, "02_filtered", args.month, "messages_classified.jsonl");
  const outDir = path.join(baseDir, "03_sessions", args.month);
  const sessionsPath = path.join(outDir, "sessions.jsonl");
  const summaryPath = path.join(outDir, "session_summary.json");
  const auditPath = path.join(outDir, "session_audit.json");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const rows = parseJsonlFile(inputPath, ClassifiedMessageSchema) as ClassifiedMessage[];
  const built = buildSessions(rows, args.month) as BuildSessionsResult;
  const sessions = built.sessions as SessionRecord[];
  const summary = buildSessionSummary(sessions);
  const audit = buildSessionAudit(sessions, built.refine_metrics);

  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(
    sessionsPath,
    sessions.length ? `${sessions.map((s) => JSON.stringify(s)).join("\n")}\n` : "",
    "utf8"
  );
  await fs.promises.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  for (const p of [sessionsPath, summaryPath, auditPath]) {
    if (!fs.existsSync(p)) throw new Error(`Output file missing: ${p}`);
    const stat = fs.statSync(p);
    console.log(`[PHASE3_FILE] ${path.basename(p)} size=${stat.size}`);
  }
  log.info(`Phase3 wrote ${sessions.length} sessions from ${rows.length} messages`);
}

runPhase3(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  log.error(`Phase3 failed: ${message}`);
  process.exitCode = 1;
});
