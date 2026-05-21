import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { log } from "./utils/logger";
import type {
  ClassificationSummary,
  ClassifiedMessage,
  ContentType,
  MessageCategory,
  NormalizedMessage
} from "./types/pipeline";

type Phase2BMode = "normal" | "audit-only";
type Phase2BArgs = { month: string; mode: Phase2BMode };

const NormalizedMessageSchema = z.object({
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
  parse_warnings: z.array(z.string())
});

const ClassifiedMessageSchema = NormalizedMessageSchema.extend({
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

function parseCliArgs(argv: string[]): Phase2BArgs {
  let month = "";
  let mode: Phase2BMode = "normal";

  for (const arg of argv) {
    if (arg.startsWith("--month=")) {
      month = arg.slice("--month=".length);
    } else if (arg === "--audit-only") {
      mode = "audit-only";
    }
  }

  if (!month && process.env.npm_config_month) {
    month = process.env.npm_config_month;
  }
  if (
    mode === "normal" &&
    (process.env.npm_config_audit_only === "true" || process.env.npm_config_audit_only === "1")
  ) {
    mode = "audit-only";
  }

  if (!month) {
    throw new Error("Missing required arg: --month=YYYY-MM");
  }

  return { month, mode };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countKeywordMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const p of patterns) {
    const m = text.match(p);
    count += m ? m.length : 0;
  }
  return count;
}

function classifyMessage(m: NormalizedMessage): Omit<ClassifiedMessage, keyof NormalizedMessage> {
  const text = m.text.toLowerCase();
  const rawText = JSON.stringify(m.raw_content ?? "");
  const joined = `${text} ${rawText}`.toLowerCase();
  const rawTitle =
    m.raw_content && typeof m.raw_content === "object" && "title" in m.raw_content
      ? String((m.raw_content as Record<string, unknown>).title ?? "")
      : "";
  const textAndTitle = `${m.text} ${rawTitle}`;

  const accountingPatterns = [
    /\bunc\b/g,
    /\bck\b/g,
    /\btod\b/g,
    /\bcod\b/g,
    /\bcoc\b/g,
    /\bduyet\b/g,
    /\bvo tien\b/g,
    /\bdo tien\b/g
  ];
  const logisticsPatterns = [/\bgiao\b/g, /\bkho\b/g, /\bvan chuyen\b/g, /\bxuat kho\b/g];
  const salesPatterns = [
    /\bxin gia\b/g,
    /\bbao gia\b/g,
    /\bsl\b/g,
    /\bkhach\b/g,
    /\bdon\b/g,
    /\blaptop\b/g,
    /\bmay\b/g
  ];
  const supportPatterns = [/\bcheck\b/g, /\bho tro\b/g, /\bco hang\b/g, /\bhet hang\b/g];
  const strongSalesPatterns = [
    /\bhoi gia\b/g,
    /\bxin gia\b/g,
    /\bbao gia\b/g,
    /\bcon hang\b/g,
    /\bton kho\b/g,
    /\bsl\b/g,
    /\bso luong\b/g,
    /\bmua\b/g,
    /\bbao hanh\b/g,
    /\bsan pham\b/g,
    /\bmodel\b/g,
    /\bcau hinh\b/g
  ];
  const internalPatterns = [
    /\b@all\b/g,
    /\bchi\b/g,
    /\bem\b/g,
    /\bduyet\b/g,
    /\btod\b/g,
    /\bcoc\b/g,
    /\bunc\b/g,
    /\bnk\b/g
  ];
  const operationalCodePatterns = [
    /\b[A-Z]{3}_[A-Z0-9]{3}_[A-Z]{2}_[A-Z0-9]+\b/g,
    /\b[A-Z]{3}_[A-Z0-9]{2,5}_[A-Z]{2,3}_[A-Z0-9]+\b/g
  ];
  const orderCodePattern = /\bX[0-9]{9,}-[A-Z]\b/g;

  const accountingHits = countKeywordMatches(joined, accountingPatterns);
  const logisticsHits = countKeywordMatches(joined, logisticsPatterns);
  const salesHits = countKeywordMatches(joined, salesPatterns);
  const supportHits = countKeywordMatches(joined, supportPatterns);
  const strongSalesHits = countKeywordMatches(joined, strongSalesPatterns);
  const internalHits = countKeywordMatches(joined, internalPatterns);
  const operationalCodeHits =
    countKeywordMatches(textAndTitle, operationalCodePatterns) +
    countKeywordMatches(textAndTitle, [orderCodePattern]);

  const hasPayment = accountingHits > 0;
  const hasLogistics = logisticsHits > 0;
  const hasSales = salesHits > 0;
  const hasSupport = supportHits > 0;
  const hasStrongSales = strongSalesHits > 0;
  const hasOperationalCode = operationalCodeHits > 0;
  const isNoise = m.content_type === "sticker" || m.content_type === "undo";
  const hasEmptyMediaPayload =
    (m.content_type === "image" || m.content_type === "file") &&
    text.trim().length === 0 &&
    rawTitle.trim().length === 0;
  const isParseFailure = m.parse_status !== "ok";

  let message_category: MessageCategory = "unknown";
  if (isNoise || hasEmptyMediaPayload || isParseFailure) message_category = "noise";
  else if (hasOperationalCode && hasPayment) message_category = "accounting";
  else if (hasPayment) message_category = "accounting";
  else if (hasOperationalCode) message_category = "internal_operation";
  else if (internalHits > 0) message_category = "internal_operation";
  else if (hasLogistics) message_category = "logistics";
  else if (hasSales && hasStrongSales) message_category = "sales";
  else if (hasSupport) message_category = "customer_support";
  else if (m.content_type === "image" || m.content_type === "file") message_category = "media_only";
  else if (hasSales) message_category = "customer_support";
  else if (text.length > 0) message_category = "casual_chat";

  const is_internal = internalHits > 0 || hasOperationalCode;
  const candidate_sales = hasStrongSales;
  const persona_signal = candidate_sales && !is_internal && text.length > 0;

  const matched_rules = [
    ...(isNoise ? ["noise_by_content_type"] : []),
    ...(hasEmptyMediaPayload ? ["noise_empty_media"] : []),
    ...(isParseFailure ? ["noise_parse_failure"] : []),
    ...(hasOperationalCode ? ["operational_code"] : []),
    ...(hasPayment ? ["accounting_keywords"] : []),
    ...(hasLogistics ? ["logistics_keywords"] : []),
    ...(hasSales ? ["sales_keywords"] : []),
    ...(hasSupport ? ["support_keywords"] : []),
    ...(internalHits > 0 ? ["internal_keywords"] : [])
  ];

  let confidence = 0.05;
  const confidence_reason: string[] = [];

  if (internalHits > 0) {
    confidence += 0.35;
    confidence_reason.push("matched_internal_keyword");
  }
  if (accountingHits > 0) {
    confidence += 0.3;
    confidence_reason.push("matched_accounting_keyword");
  }
  if (salesHits > 0) {
    confidence += 0.25;
    confidence_reason.push("matched_sales_keyword");
  }
  if (supportHits > 0) {
    confidence += 0.2;
    confidence_reason.push("matched_support_keyword");
  }
  if (hasOperationalCode) {
    confidence += 0.35;
    confidence_reason.push("matched_operational_code");
  }
  if (logisticsHits > 0) {
    confidence += 0.2;
    confidence_reason.push("matched_logistics_keyword");
  }

  if (matched_rules.length > 1) {
    confidence += Math.min(0.3, 0.1 * (matched_rules.length - 1));
    confidence_reason.push("multiple_matched_rules");
  }

  if (m.content_type === "bankcard") {
    confidence += 0.15;
    confidence_reason.push("content_type_bankcard");
  } else if (m.content_type === "sticker" || m.content_type === "undo") {
    confidence += 0.15;
    confidence_reason.push("content_type_noise");
  } else if (m.content_type === "image" || m.content_type === "file") {
    confidence += 0.1;
    confidence_reason.push("content_type_media");
  }

  const tokenCount = joined.split(/\s+/).filter(Boolean).length;
  const keywordHits =
    internalHits + accountingHits + salesHits + supportHits + logisticsHits + operationalCodeHits;
  const density = tokenCount > 0 ? keywordHits / tokenCount : 0;
  if (density >= 0.08) {
    confidence += 0.15;
    confidence_reason.push("high_keyword_density");
  } else if (density >= 0.04) {
    confidence += 0.08;
    confidence_reason.push("medium_keyword_density");
  }

  if (
    (candidate_sales && isNoise) ||
    (message_category === "accounting" && accountingHits === 0) ||
    (message_category === "sales" && strongSalesHits === 0) ||
    (message_category === "customer_support" && (hasPayment || hasOperationalCode || internalHits > 0))
  ) {
    confidence -= 0.2;
    confidence_reason.push("conflicting_category_signal");
  }

  const trimmedLen = text.trim().length;
  if (trimmedLen >= 8 && trimmedLen <= 350) {
    confidence += 0.05;
    confidence_reason.push("message_length_good");
  } else if (trimmedLen <= 2 || trimmedLen > 600) {
    confidence -= 0.05;
    confidence_reason.push("message_length_weak");
  }

  if (
    message_category === "accounting" ||
    message_category === "sales" ||
    message_category === "internal_operation" ||
    message_category === "logistics" ||
    message_category === "customer_support" ||
    message_category === "noise"
  ) {
    confidence += 0.05;
    confidence_reason.push("category_high_certainty");
  } else if (message_category === "unknown") {
    confidence_reason.push("category_unknown");
  }

  confidence = clamp(confidence, 0, 1);
  if (matched_rules.length === 0) {
    confidence = Math.min(confidence, 0.4);
    confidence_reason.push("no_rule_confidence_cap");
  }
  if (hasOperationalCode) {
    confidence = Math.max(confidence, 0.7);
  }

  return {
    message_category,
    confidence,
    confidence_reason,
    is_internal,
    is_noise: isNoise,
    candidate_sales,
    persona_signal,
    filter_reason: message_category,
    matched_rules
  };
}

function buildSummary(rows: ClassifiedMessage[]): ClassificationSummary {
  const category_counts: Record<MessageCategory, number> = {
    internal_operation: 0,
    accounting: 0,
    logistics: 0,
    warehouse: 0,
    sales: 0,
    customer_support: 0,
    casual_chat: 0,
    media_only: 0,
    noise: 0,
    unknown: 0
  };

  const content_type_counts: Record<ContentType, number> = {
    text: 0,
    image: 0,
    file: 0,
    sticker: 0,
    undo: 0,
    bankcard: 0,
    unknown: 0
  };

  let internal_count = 0;
  let noise_count = 0;
  let candidate_sales_count = 0;
  let persona_signal_count = 0;

  for (const row of rows) {
    category_counts[row.message_category] += 1;
    content_type_counts[row.content_type] += 1;
    if (row.is_internal) internal_count += 1;
    if (row.is_noise) noise_count += 1;
    if (row.candidate_sales) candidate_sales_count += 1;
    if (row.persona_signal) persona_signal_count += 1;
  }

  return {
    total_messages: rows.length,
    category_counts,
    content_type_counts,
    internal_count,
    noise_count,
    candidate_sales_count,
    persona_signal_count
  };
}

import * as readline from "readline";
import { appendJsonl } from "./writer/jsonlWriter";

async function runNormalMode(baseDir: string, month: string): Promise<void> {
  const inputPath = path.join(baseDir, "01_normalized", month, "messages.jsonl");
  const outputPath = path.join(baseDir, "02_filtered", month, "messages_classified.jsonl");
  const summaryPath = path.join(baseDir, "02_filtered", month, "summary.json");

  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);

  const fileStream = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let chunk: ClassifiedMessage[] = [];
  const CHUNK_SIZE = 5000;
  let totalProcessed = 0;

  const category_counts: Record<MessageCategory, number> = {
    internal_operation: 0, accounting: 0, logistics: 0, warehouse: 0, sales: 0,
    customer_support: 0, casual_chat: 0, media_only: 0, noise: 0, unknown: 0
  };
  const content_type_counts: Record<ContentType, number> = {
    text: 0, image: 0, file: 0, sticker: 0, undo: 0, bankcard: 0, unknown: 0
  };
  let internal_count = 0, noise_count = 0, candidate_sales_count = 0, persona_signal_count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = NormalizedMessageSchema.parse(JSON.parse(line));
      const classified = { ...parsed, ...classifyMessage(parsed as NormalizedMessage) } as ClassifiedMessage;
      chunk.push(classified);

      category_counts[classified.message_category] += 1;
      content_type_counts[classified.content_type] += 1;
      if (classified.is_internal) internal_count += 1;
      if (classified.is_noise) noise_count += 1;
      if (classified.candidate_sales) candidate_sales_count += 1;
      if (classified.persona_signal) persona_signal_count += 1;

      if (chunk.length >= CHUNK_SIZE) {
        await appendJsonl(outputPath, chunk);
        totalProcessed += chunk.length;
        chunk = [];
      }
    } catch (e) {
      continue;
    }
  }

  if (chunk.length > 0) {
    await appendJsonl(outputPath, chunk);
    totalProcessed += chunk.length;
  }

  const summary: ClassificationSummary = {
    total_messages: totalProcessed,
    category_counts,
    content_type_counts,
    internal_count,
    noise_count,
    candidate_sales_count,
    persona_signal_count
  };

  await fs.promises.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  log.info(`Phase2B wrote ${totalProcessed} rows to ${outputPath}`);
}

async function runAuditOnlyMode(baseDir: string, month: string): Promise<void> {
  const folder = path.join(baseDir, "02_filtered", month);
  const classifiedPath = path.join(folder, "messages_classified.jsonl");
  const auditMetricsPath = path.join(folder, "audit_metrics.json");
  const suspiciousPath = path.join(folder, "suspicious_cases.jsonl");
  const ruleStatsPath = path.join(folder, "rule_statistics.json");
  const suspiciousSummaryPath = path.join(folder, "suspicious_cases_summary.json");
  const confidenceReportPath = path.join(folder, "confidence_report.json");

  if (!fs.existsSync(classifiedPath)) throw new Error(`Classified file not found: ${classifiedPath}`);

  if (fs.existsSync(suspiciousPath)) await fs.promises.unlink(suspiciousPath);

  const fileStream = fs.createReadStream(classifiedPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  type SuspiciousSeverity = "low" | "medium" | "high";
  type SuspiciousCase = ClassifiedMessage & {
    suspicious_case_reason: string;
    suspicious_severity: SuspiciousSeverity;
  };

  let totalRows = 0;
  let unknownCategoryCount = 0;
  let lowConfidenceCount = 0;
  let emptyRuleMatchCount = 0;
  let parseIssueCount = 0;
  let sumConfidence = 0;

  const reasonCounts: Record<string, number> = {};
  const severityCounts: Record<SuspiciousSeverity, number> = { low: 0, medium: 0, high: 0 };
  const highReasonCounts: Record<string, number> = {};
  
  const ruleCounts: Record<string, number> = {};
  const confidenceReasonCounts: Record<string, number> = {};

  const confidenceDistribution = {
    "0.0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0
  };

  const categoryTotals: Partial<Record<MessageCategory, { sum: number; count: number }>> = {};

  let suspiciousChunk: SuspiciousCase[] = [];
  const CHUNK_SIZE = 5000;
  let totalSuspiciousCount = 0;

  function handleSuspicious(row: ClassifiedMessage, severity: SuspiciousSeverity, reason: string) {
    suspiciousChunk.push({ ...row, suspicious_case_reason: reason, suspicious_severity: severity });
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    severityCounts[severity] += 1;
    if (severity === "high") highReasonCounts[reason] = (highReasonCounts[reason] ?? 0) + 1;
    totalSuspiciousCount += 1;
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const row = ClassifiedMessageSchema.parse(JSON.parse(line)) as ClassifiedMessage;
      totalRows++;
      sumConfidence += row.confidence;
      
      if (row.message_category === "unknown") unknownCategoryCount++;
      if (row.confidence < 0.75) lowConfidenceCount++;
      if (row.matched_rules.length === 0) emptyRuleMatchCount++;
      if (row.parse_status !== "ok") parseIssueCount++;

      for (const rule of row.matched_rules) ruleCounts[rule] = (ruleCounts[rule] ?? 0) + 1;
      for (const reason of row.confidence_reason ?? []) confidenceReasonCounts[reason] = (confidenceReasonCounts[reason] ?? 0) + 1;

      if (row.confidence < 0.2) confidenceDistribution["0.0-0.2"]++;
      else if (row.confidence < 0.4) confidenceDistribution["0.2-0.4"]++;
      else if (row.confidence < 0.6) confidenceDistribution["0.4-0.6"]++;
      else if (row.confidence < 0.8) confidenceDistribution["0.6-0.8"]++;
      else confidenceDistribution["0.8-1.0"]++;

      const currentCat = categoryTotals[row.message_category] ?? { sum: 0, count: 0 };
      currentCat.sum += row.confidence;
      currentCat.count += 1;
      categoryTotals[row.message_category] = currentCat;

      const hasStrongSignal = row.candidate_sales || row.persona_signal || row.is_internal ||
        row.message_category === "accounting" || row.message_category === "sales" ||
        row.message_category === "customer_support" || row.message_category === "logistics";
      const textLen = row.text.trim().length;
      const noRule = row.matched_rules.length === 0;

      if (row.content_type === "bankcard" && row.message_category !== "accounting") handleSuspicious(row, "high", "bankcard_not_accounting");
      else if (row.candidate_sales && row.is_noise) handleSuspicious(row, "high", "candidate_sales_with_noise");
      else if (row.message_category === "unknown" && row.confidence >= 0.6) handleSuspicious(row, "high", "high_confidence_unknown");
      else if (row.is_internal && noRule && row.confidence >= 0.6) handleSuspicious(row, "high", "internal_no_rule_high_confidence");
      else if (textLen > 300 && row.message_category === "noise") handleSuspicious(row, "medium", "long_text_classified_noise");
      else if (row.candidate_sales && row.message_category !== "sales" && row.message_category !== "internal_operation" && row.message_category !== "accounting") handleSuspicious(row, "medium", "candidate_sales_unexpected_category");
      else if (row.persona_signal && row.message_category === "noise") handleSuspicious(row, "medium", "persona_signal_classified_noise");
      else if (row.message_category === "unknown" && row.confidence < 0.6) handleSuspicious(row, "low", "low_confidence_unknown");
      else if (noRule && row.message_category !== "unknown" && row.confidence >= 0.6) handleSuspicious(row, "low", "empty_rule_non_unknown_high_confidence");
      else if (noRule && hasStrongSignal) handleSuspicious(row, "low", "empty_rule_with_strong_signal");
      else if (noRule && row.confidence < 0.6) handleSuspicious(row, "low", "empty_rule_low_confidence");

      if (suspiciousChunk.length >= CHUNK_SIZE) {
        await appendJsonl(suspiciousPath, suspiciousChunk);
        suspiciousChunk = [];
      }
    } catch (e) {
      continue;
    }
  }

  if (suspiciousChunk.length > 0) {
    await appendJsonl(suspiciousPath, suspiciousChunk);
  }

  const averageConfidence = totalRows > 0 ? Number((sumConfidence / totalRows).toFixed(4)) : 0;

  const auditMetrics = {
    total_rows: totalRows,
    suspicious_cases_count: totalSuspiciousCount,
    unknown_category_count: unknownCategoryCount,
    low_confidence_count: lowConfidenceCount,
    empty_rule_match_count: emptyRuleMatchCount,
    parse_issue_count: parseIssueCount,
    suspicious_high_count: severityCounts.high,
    suspicious_medium_count: severityCounts.medium,
    suspicious_low_count: severityCounts.low,
    average_confidence: averageConfidence
  };

  const categoryConfidenceAverages: Partial<Record<MessageCategory, number>> = {};
  for (const [category, total] of Object.entries(categoryTotals)) {
    categoryConfidenceAverages[category as MessageCategory] = Number((total.sum / total.count).toFixed(4));
  }

  const topHighReasons = Object.entries(highReasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  const suspiciousSummary = {
    total_suspicious: totalSuspiciousCount,
    severity_counts: severityCounts,
    reason_counts: reasonCounts,
    top_high_severity_reasons: topHighReasons,
    recommendations: [
      "Review high severity cases first because they indicate likely rule/model conflicts.",
      "If many internal_no_rule_high_confidence cases appear, add explicit internal operation rules.",
      "If candidate_sales_unexpected_category dominates, tighten candidate_sales logic or recategorize labels."
    ]
  };

  const confidenceReport = {
    average_confidence: averageConfidence,
    confidence_distribution: confidenceDistribution,
    category_confidence_averages: categoryConfidenceAverages,
    confidence_reason_counts: confidenceReasonCounts
  };

  await fs.promises.writeFile(auditMetricsPath, `${JSON.stringify(auditMetrics, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(ruleStatsPath, `${JSON.stringify(ruleCounts, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(suspiciousSummaryPath, `${JSON.stringify(suspiciousSummary, null, 2)}\n`, "utf8");
  await fs.promises.writeFile(confidenceReportPath, `${JSON.stringify(confidenceReport, null, 2)}\n`, "utf8");

  for (const p of [auditMetricsPath, suspiciousPath, ruleStatsPath, suspiciousSummaryPath, confidenceReportPath]) {
    if (!fs.existsSync(p)) continue;
    const stat = fs.statSync(p);
    console.log(`[AUDIT_FILE] ${path.basename(p)} size=${stat.size}`);
  }
}

async function runPhase2B(args: Phase2BArgs): Promise<void> {
  const dataDir = path.resolve("sale-testlab-data");
  console.log("[MODE]", args.mode);

  if (args.mode === "audit-only") {
    await runAuditOnlyMode(dataDir, args.month);
    return;
  }

  await runNormalMode(dataDir, args.month);
}

runPhase2B(parseCliArgs(process.argv.slice(2))).catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  log.error(`Phase2B failed: ${message}`);
  process.exitCode = 1;
});
