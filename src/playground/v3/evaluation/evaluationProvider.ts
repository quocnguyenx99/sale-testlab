import * as fs from "fs";
import * as path from "path";
import { criterionApplicability } from "./evaluationEngine";
import { EVALUATION_RUBRIC, EvaluationInput, QualitativeEvaluation, qualitativeEvaluationSchema } from "./evaluationDomain";

export interface EvaluationProvider {
  evaluate(input: EvaluationInput): Promise<QualitativeEvaluation>;
}

export class EvaluationProviderError extends Error {
  constructor(public readonly code: "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT" | "INVALID_PROVIDER_RESPONSE") { super(code); }
}

export class LocalAIEvaluationProvider implements EvaluationProvider {
  constructor(private readonly config = evaluationProviderConfig()) {}

  async evaluate(input: EvaluationInput): Promise<QualitativeEvaluation> {
    if (!this.config.baseUrl) throw new EvaluationProviderError("PROVIDER_UNAVAILABLE");
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
          max_tokens: 900,
          stream: false,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: evaluatorSystemPrompt(input) },
            { role: "user", content: JSON.stringify(input) }
          ]
        })
      });
      if (!response.ok) throw new EvaluationProviderError("PROVIDER_UNAVAILABLE");
      const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new EvaluationProviderError("INVALID_PROVIDER_RESPONSE");
      let parsed: unknown;
      try { parsed = JSON.parse(stripFence(content)); } catch { throw new EvaluationProviderError("INVALID_PROVIDER_RESPONSE"); }
      const validated = qualitativeEvaluationSchema.safeParse(parsed);
      if (!validated.success) throw new EvaluationProviderError("INVALID_PROVIDER_RESPONSE");
      return validated.data;
    } catch (error) {
      if (error instanceof EvaluationProviderError) throw error;
      if (error instanceof Error && (error.name === "AbortError" || controller.signal.aborted)) throw new EvaluationProviderError("PROVIDER_TIMEOUT");
      throw new EvaluationProviderError("PROVIDER_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }
}

function evaluatorSystemPrompt(input: EvaluationInput): string {
  const applicability = criterionApplicability(input);
  const requested = EVALUATION_RUBRIC.filter((criterion) => criterion.source !== "DETERMINISTIC" && applicability[criterion.key]);
  return [
    "Bạn đánh giá kỹ năng Sale từ transcript an toàn đã lưu. Chỉ trả JSON, không chain-of-thought.",
    "Không tính overallScore. Không bịa sự kiện. Mỗi evidenceTurnSequences phải tham chiếu sequence có thật.",
    "Schema: {\"criteria\":[{\"key\":string,\"score\":integer 0..100,\"summary\":string <=280 ký tự,\"evidenceTurnSequences\":integer[]}]}.",
    `Chỉ trả đúng các tiêu chí: ${requested.map((criterion) => `${criterion.key}: ${criterion.description}`).join(" | ")}`
  ].join("\n");
}

function evaluationProviderConfig() {
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

function stripFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
