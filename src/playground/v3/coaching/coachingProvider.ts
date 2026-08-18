import * as fs from "fs";
import * as path from "path";
import { CoachingProviderInput, CoachingProviderOutput, coachingProviderOutputSchema } from "./coachingDomain";

export interface CoachingProvider { coach(input: CoachingProviderInput): Promise<CoachingProviderOutput>; }

export type CoachingProviderFailureCode =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_CONTENT_EXTRACTION_FAILED"
  | "PROVIDER_EMPTY_CONTENT"
  | "PROVIDER_JSON_PARSE_FAILED"
  | "PROVIDER_SCHEMA_VALIDATION_FAILED"
  | "INVALID_PROVIDER_RESPONSE";

export class CoachingProviderError extends Error {
  constructor(public readonly code: CoachingProviderFailureCode) { super(code); }
}

export class LocalAICoachingProvider implements CoachingProvider {
  constructor(private readonly config = coachingProviderConfig()) {}

  async coach(input: CoachingProviderInput): Promise<CoachingProviderOutput> {
    if (!this.config.baseUrl) throw new CoachingProviderError("PROVIDER_UNAVAILABLE");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}) },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.1,
          max_tokens: 1_200,
          stream: false,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: buildCoachingSystemPrompt(input) }, { role: "user", content: JSON.stringify(input) }]
        })
      });
      if (!response.ok) throw new CoachingProviderError("PROVIDER_UNAVAILABLE");
      const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new CoachingProviderError("PROVIDER_CONTENT_EXTRACTION_FAILED");
      if (!content.trim()) throw new CoachingProviderError("PROVIDER_EMPTY_CONTENT");
      let parsed: unknown;
      try { parsed = JSON.parse(stripFence(content)); } catch { throw new CoachingProviderError("PROVIDER_JSON_PARSE_FAILED"); }
      const validated = coachingProviderOutputSchema.safeParse(parsed);
      if (!validated.success) throw new CoachingProviderError("PROVIDER_SCHEMA_VALIDATION_FAILED");
      return validated.data;
    } catch (error) {
      if (error instanceof CoachingProviderError) throw error;
      if (error instanceof Error && (error.name === "AbortError" || controller.signal.aborted)) throw new CoachingProviderError("PROVIDER_TIMEOUT");
      throw new CoachingProviderError("PROVIDER_UNAVAILABLE");
    } finally { clearTimeout(timer); }
  }
}

export function buildCoachingSystemPrompt(input: CoachingProviderInput): string {
  const priorityContract = input.priorities.map((priority) => `${priority.criterionKey}:${priority.priorityKind}`).join(", ");
  const reinforcement = input.reinforcement?.criterionKey ?? "null";
  return [
    "Bạn là AI Coach cho nhân viên Sale. Chỉ tư vấn trên các ưu tiên backend đã chọn; không chấm điểm, tính lại, xếp hạng hay đưa ra mức hiệu suất số.",
    "Không thay đổi kết luận Evaluator. Chỉ dùng evidence turns được cung cấp, không bịa sự kiện và không tiết lộ chain-of-thought.",
    "IMPROVEMENT là điểm cần cải thiện. REFINEMENT phải dùng ngôn ngữ tích cực như 'tinh chỉnh thêm' hoặc 'làm tốt hơn nữa', không gọi là điểm yếu/kém/chưa đạt/cần khắc phục.",
    "suggestedPhrasing là ví dụ giả định, không phải lời đã xuất hiện trong lịch sử.",
    `Trả đúng priorities theo thứ tự: ${priorityContract}. Strength reinforcement chỉ được dùng key ${reinforcement}.`,
    "JSON strict: {summary,priorities:[{criterionKey,priorityKind,title,whyItMatters,observation,recommendedAction,suggestedPhrasing,evidenceTurnSequences}],strengthReinforcement:{criterionKey,message}|null,nextPracticeFocus:[string]}.",
    "nextPracticeFocus must contain exactly 1 or 2 concise strings; never return 0 or more than 2 items.",
    "Không thêm bất kỳ chỉ số đánh giá, mức điểm, trọng số hoặc thuộc tính ngoài schema."
  ].join("\n");
}

function coachingProviderConfig() {
  const env = loadDotEnv();
  return {
    baseUrl: process.env.LOCAL_AI_URL || process.env.OPENAI_BASE_URL || env.LOCAL_AI_URL || env.OPENAI_BASE_URL || "http://192.168.117.73:9001/v1",
    model: process.env.LOCAL_AI_MODEL || process.env.OPENAI_MODEL || env.LOCAL_AI_MODEL || env.OPENAI_MODEL || "qwen3-8b",
    apiKey: process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || "",
    timeoutMs: 20_000
  };
}

function loadDotEnv(): Record<string, string> {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
  }));
}

function stripFence(value: string): string { return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""); }
