import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { log } from "./utils/logger";
import { calculateFileHashStream } from "./utils/fileHasher";
import { parseZaloData } from "./parser/zaloparser";
import { normalizeContent } from "./normalizer/contentNormalizer";
import { appendJsonl } from "./writer/jsonlWriter";
import { readManifest, updateManifest } from "./writer/manifestWriter";

const MessagesSchema = z.object({
  message_id: z.string(),
  conversation_id: z.string(),
  sender_id: z.string(),
  sender_name: z.string(),

  content_type: z.enum([
    "text",
    "image",
    "file",
    "sticker",
    "undo",
    "bankcard",
    "unknown"
  ]),

  text: z.string(),

  raw_content: z.union([
    z.record(z.string(), z.any()),
    z.string(),
    z.null()
  ]),

  created_at: z.string(),
  source_file: z.string(),
  source_file_hash: z.string(),
  month: z.string(),

  parse_status: z.enum([
    "ok",
    "content_json_failed",
    "row_parse_failed"
  ]),

  parse_warnings: z.array(z.string())
});

type Phase1Args = {
  month: string;
  file?: string;
  dryRun: boolean;
  force: boolean;
  limitFiles?: number;
  excludeLargest: boolean;
};

type Message = z.infer<typeof MessagesSchema>;

function detectContentType(rawContent: object | string | null): Message["content_type"] {
  if (rawContent === null) return "unknown";
  if (typeof rawContent === "string") return "text";

  const data = rawContent as Record<string, unknown>;
  if (typeof data.action === "string" && data.action === "undo_message") return "undo";
  if (typeof data.stickerId === "number") return "sticker";
  if (typeof data.fileName === "string" || typeof data.fileUrl === "string") return "file";
  if (
    typeof data.bank === "string" ||
    typeof data.bank_name === "string" ||
    typeof data.account_number === "string"
  ) {
    return "bankcard";
  }
  if (typeof data.imageUrl === "string" || typeof data.thumbnailUrl === "string") return "image";
  if (typeof data.text === "string") return "text";
  return "unknown";
}

function buildMessageCandidate(
  item: Record<string, unknown>,
  index: number,
  args: Phase1Args,
  fileName: string,
  fileHash: string
): Message {
  const conversationId = String(item.conversation_id ?? item.conversationId ?? "unknown_conversation");
  const createdAt = String(item.created_at ?? item.create_at ?? item.createdAt ?? "");
  const safeCreatedAt = createdAt ? createdAt.replace(/[^0-9]/g, "") : "unknown_time";
  const shortHash = fileHash.substring(0, 8);
  const messageId = String(item.message_id ?? item.messageId ?? `${conversationId}-${safeCreatedAt}-${shortHash}-${index + 1}`);

  const parseStatus =
    item.parse_status === "content_json_failed" || item.parse_status === "row_parse_failed"
      ? item.parse_status
      : "ok";

  const rawContentValue = (item.raw_content ?? item.content ?? null) as object | string | null;
  let normalizedRawContent: object | string | null = rawContentValue;
  if (typeof rawContentValue === "undefined") normalizedRawContent = null;

  const textFromRawObject =
    normalizedRawContent &&
    typeof normalizedRawContent === "object" &&
    "text" in (normalizedRawContent as Record<string, unknown>) &&
    typeof (normalizedRawContent as Record<string, unknown>).text === "string"
      ? String((normalizedRawContent as Record<string, unknown>).text)
      : "";

  const candidate: Message = {
    message_id: messageId,
    conversation_id: conversationId,
    sender_id: String(item.sender_id ?? item.senderId ?? ""),
    sender_name: String(item.sender_name ?? item.senderName ?? ""),
    content_type: detectContentType(normalizedRawContent),
    text: String(item.text ?? textFromRawObject ?? ""),
    raw_content: normalizedRawContent,
    created_at: createdAt,
    source_file: fileName,
    source_file_hash: fileHash,
    month: args.month,
    parse_status: parseStatus,
    parse_warnings: Array.isArray(item.parse_warnings)
      ? item.parse_warnings.map((w) => String(w))
      : []
  };

  return candidate;
}

function parseCliArgs(argv: string[]): Phase1Args {
  const parsed: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const raw = arg.slice(2);
    const [key, ...rest] = raw.split("=");
    if (!key) continue;
    if (rest.length === 0) {
      parsed[key] = true;
    } else {
      parsed[key] = rest.join("=");
    }
  }

  if (!parsed.month && process.env.npm_config_month) parsed.month = process.env.npm_config_month;
  if (!parsed.file && process.env.npm_config_file) parsed.file = process.env.npm_config_file;
  if (!parsed["dry-run"] && process.env.npm_config_dry_run) parsed["dry-run"] = true;
  if (!parsed.force && process.env.npm_config_force) parsed.force = true;
  if (!parsed["exclude-largest"] && process.env.npm_config_exclude_largest) parsed["exclude-largest"] = true;
  if (!parsed["limit-files"] && process.env.npm_config_limit_files) parsed["limit-files"] = process.env.npm_config_limit_files;

  if (!parsed.month) {
    throw new Error("Missing required args: --month=YYYY-MM");
  }

  return {
    month: String(parsed.month),
    file: parsed.file ? String(parsed.file) : undefined,
    dryRun: !!parsed["dry-run"],
    force: !!parsed.force,
    limitFiles: parsed["limit-files"] ? parseInt(String(parsed["limit-files"]), 10) : undefined,
    excludeLargest: !!parsed["exclude-largest"]
  };
}

async function runPhase1(args: Phase1Args): Promise<void> {
  const DATA_DIR = path.resolve("sale-testlab-data");
  const rawDir = path.join(DATA_DIR, "00_raw", "zalo", args.month);
  const outputPath = path.join(DATA_DIR, "01_normalized", args.month, "messages.jsonl");
  const manifestPath = path.join(DATA_DIR, "logs", `manifest_${args.month}.json`);
  const errorLogPath = path.join(DATA_DIR, "logs", `parse_errors_${args.month}.jsonl`);

  if (!fs.existsSync(rawDir)) {
    throw new Error(`Raw directory not found: ${rawDir}`);
  }

  // Clear output files if force mode is enabled
  if (args.force && !args.dryRun) {
    if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
    if (fs.existsSync(manifestPath)) await fs.promises.unlink(manifestPath);
    if (fs.existsSync(errorLogPath)) await fs.promises.unlink(errorLogPath);
    log.info("Force mode: Cleared month outputs.");
  }

  const allFiles = fs.readdirSync(rawDir).filter((f) => f.endsWith(".txt"));
  let filesToProcess = allFiles.map((f) => {
    const filePath = path.join(rawDir, f);
    const size = fs.statSync(filePath).size;
    return { name: f, path: filePath, size };
  });

  if (args.file) {
    filesToProcess = filesToProcess.filter((f) => f.name === args.file);
  }

  // Deterministic file order
  filesToProcess.sort((a, b) => a.name.localeCompare(b.name));

  if (args.excludeLargest && filesToProcess.length > 0) {
    let largestIdx = 0;
    for (let i = 1; i < filesToProcess.length; i++) {
      if (filesToProcess[i].size > filesToProcess[largestIdx].size) {
        largestIdx = i;
      }
    }
    const largestFile = filesToProcess.splice(largestIdx, 1)[0];
    log.info(`Excluded largest file: ${largestFile.name} (${largestFile.size} bytes)`);
  }

  if (args.limitFiles !== undefined && args.limitFiles > 0) {
    filesToProcess = filesToProcess.slice(0, args.limitFiles);
  }

  if (args.dryRun) {
    log.info(`--- DRY RUN ---`);
    log.info(`Selected ${filesToProcess.length} files to process.`);
    const totalSize = filesToProcess.reduce((sum, f) => sum + f.size, 0);
    log.info(`Total size to process: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    filesToProcess.forEach((f) => {
      log.info(`Plan to process: ${f.name} (${f.size} bytes)`);
    });
    return;
  }

  const manifest = await readManifest(manifestPath) || { version: "1.0", processed_files: [] };

  let totalParsedMessages = 0;
  let totalErrors = 0;

  for (const fileInfo of filesToProcess) {
    const startedAt = new Date().toISOString();
    const fileHash = await calculateFileHashStream(fileInfo.path);

    const existingRecord = manifest.processed_files?.find((f: any) => f.source_file === fileInfo.name);
    
    if (existingRecord) {
      if (existingRecord.file_hash === fileHash && existingRecord.status === "completed") {
        if (!args.force) {
          log.info(`Skipping already processed file: ${fileInfo.name}`);
          continue;
        }
      } else if (existingRecord.file_hash !== fileHash && !args.force) {
        log.warn(`File changed but no --force flag provided. Skipping: ${fileInfo.name}`);
        await updateManifest(manifestPath, {
          source_file: fileInfo.name,
          file_size: fileInfo.size,
          file_hash: fileHash,
          status: "changed_requires_force",
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          output_path: outputPath
        });
        continue;
      }
    }

    log.info(`Processing ${fileInfo.name}...`);
    try {
      const rawData = await parseZaloData(fileInfo.path, fileHash, args.month);
      const rowErrors: any[] = [];
      const normalizedData: Message[] = [];

      for (let index = 0; index < rawData.length; index++) {
        const item = rawData[index];
        const baseCandidate = buildMessageCandidate(item as any, index, args, fileInfo.name, fileHash);
        let candidate = baseCandidate;

        try {
          const normalized = normalizeContent(baseCandidate as any) as Record<string, unknown>;
          candidate = buildMessageCandidate(normalized, index, args, fileInfo.name, fileHash);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          candidate = {
            ...baseCandidate,
            parse_status: "content_json_failed",
            parse_warnings: [...baseCandidate.parse_warnings, `Normalization Error: ${msg}`]
          };
        }

        const validated = MessagesSchema.safeParse(candidate);
        if (validated.success) {
          normalizedData.push(validated.data);
        } else {
          const issueText = validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
          
          // Safe error log
          rowErrors.push({
            source_file: fileInfo.name,
            line_number: index + 1,
            error_type: "schema_validation_failed",
            parse_status: "row_parse_failed",
            safe_hash: fileHash,
            timestamp: new Date().toISOString(),
            details: issueText
          });

          const fallback = MessagesSchema.parse({
            ...candidate,
            message_id: String(candidate.message_id || `fallback-${fileHash}-${index + 1}`),
            parse_status: "row_parse_failed",
            parse_warnings: [...candidate.parse_warnings, `Schema validation failed: ${issueText}`]
          });
          normalizedData.push(fallback);
        }
      }

      await appendJsonl(outputPath, normalizedData);
      if (rowErrors.length > 0) {
        await appendJsonl(errorLogPath, rowErrors);
      }

      const errorsCount = normalizedData.filter((m) => m.parse_status !== "ok").length;
      totalParsedMessages += normalizedData.length;
      totalErrors += errorsCount;

      await updateManifest(manifestPath, {
        source_file: fileInfo.name,
        file_size: fileInfo.size,
        file_hash: fileHash,
        status: "completed",
        parsed_message_count: normalizedData.length,
        error_count: errorsCount,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        output_path: outputPath
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to process ${fileInfo.name}: ${message}`);
      await updateManifest(manifestPath, {
        source_file: fileInfo.name,
        file_size: fileInfo.size,
        file_hash: fileHash,
        status: "failed",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        output_path: outputPath,
        error_message: message
      });
    }
  }

  log.info(`--- Phase 1 Complete ---`);
  log.info(`Total messages appended: ${totalParsedMessages}`);
  log.info(`Total errors safely logged: ${totalErrors}`);
}

runPhase1(parseCliArgs(process.argv.slice(2))).catch(() => {
  process.exitCode = 1;
});
