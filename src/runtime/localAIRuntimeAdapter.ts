import { detectBlockedBehaviors, sanitizeText } from "./runtimeConstraints";
import * as fs from "fs";
import * as path from "path";

export interface LocalAIAdapterConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface LocalAIReplyResult {
  generated_reply: string;
  reply_source: "local_ai_generated" | "deterministic_fallback";
  fallback_reason?:
    | "missing_local_endpoint"
    | "generation_failure"
    | "timeout"
    | "invalid_response_format"
    | "safety_block";
  reply_reasoning: {
    used_patterns: string[];
    used_constraints: string[];
    blocked_behaviors: string[];
  };
  runtime_safety: {
    emotional_inference_blocked: boolean;
    unsupported_claim_blocked: boolean;
    operational_realism_preserved: boolean;
  };
}

function loadDotEnv(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};
  const out: Record<string, string> = {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

function fromEnv(): LocalAIAdapterConfig {
  const envMap = loadDotEnv();
  const baseUrl =
    process.env.LOCAL_AI_URL ||
    process.env.OPENAI_BASE_URL ||
    process.env.LOCAL_QWEN_URL ||
    envMap.LOCAL_AI_URL ||
    envMap.OPENAI_BASE_URL ||
    envMap.LOCAL_QWEN_URL ||
    "";
  const model =
    process.env.LOCAL_AI_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.LOCAL_QWEN_MODEL ||
    envMap.LOCAL_AI_MODEL ||
    envMap.OPENAI_MODEL ||
    envMap.LOCAL_QWEN_MODEL ||
    "";
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.LOCAL_QWEN_API_KEY ||
    envMap.OPENAI_API_KEY ||
    envMap.LOCAL_QWEN_API_KEY ||
    "";

  return {
    baseUrl,
    model,
    apiKey,
    timeoutMs: 30000
  };
}

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function chooseVariation(state: string, seed: string): string {
  const k = stableHash(`${state}:${seed}`) % 3;
  if (state.includes("pricing_phase")) {
    return [
      "Mình vẫn đang tham khảo thêm giá, bạn gửi giúp phương án phù hợp ngân sách nhé.",
      "Mình muốn xem thêm vài mức giá trước khi chốt.",
      "Mình đang so sánh giá thêm bên khác, bạn gửi giúp lựa chọn tương đương nhé."
    ][k];
  }
  if (state.includes("logistics_phase")) {
    return [
      "Mình cần xác nhận thời gian giao và chứng từ trước khi chốt.",
      "Bạn cập nhật giúp lịch giao cụ thể và hồ sơ đi kèm nhé.",
      "Mình ưu tiên xác nhận tiến độ giao hàng trước khi quyết định."
    ][k];
  }
  if (state.includes("payment_phase")) {
    return [
      "Bạn kiểm tra giúp tình trạng thanh toán và xác nhận lại cho mình nhé.",
      "Mình cần xác nhận đã vào tiền chưa để xử lý bước tiếp theo.",
      "Bạn kiểm tra giúp mình trạng thái thanh toán hiện tại nhé."
    ][k];
  }
  if (state.includes("research_phase")) {
    return [
      "Mình đang so sánh vài mã, bạn gửi giúp thông số chính để đối chiếu.",
      "Bạn gửi thêm khác biệt giữa các mã để mình cân nhắc nhé.",
      "Mình muốn đối chiếu cấu hình trước khi chọn mã phù hợp."
    ][k];
  }
  return [
    "Mình cần thêm thông tin để xác nhận bước tiếp theo.",
    "Bạn gửi thêm thông tin chính để mình quyết định nhé.",
    "Mình cần làm rõ thêm vài điểm trước khi chốt."
  ][k];
}

function normalizeReply(text: string): string {
  return sanitizeText(text.normalize("NFC"))
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function enforceSafety(reply: string): {
  safeReply: string;
  blocked: string[];
  emotionalBlocked: boolean;
  unsupportedBlocked: boolean;
  fullyBlocked: boolean;
} {
  const normalized = normalizeReply(reply);
  const blocked = detectBlockedBehaviors(normalized);
  const emotionalBlocked = blocked.includes("emotional_inference");
  const unsupportedBlocked =
    blocked.includes("invented_history") || blocked.includes("demographic_assumption");

  if (blocked.length === 0) {
    return {
      safeReply: normalized,
      blocked,
      emotionalBlocked: false,
      unsupportedBlocked: false,
      fullyBlocked: false
    };
  }

  return {
    safeReply: "Mình cần thêm thông tin thực tế để phản hồi chính xác hơn.",
    blocked,
    emotionalBlocked,
    unsupportedBlocked,
    fullyBlocked: true
  };
}

function extractContent(payload: unknown): string | null {
  const p = payload as {
    choices?: Array<{
      message?: { content?: string };
      text?: string;
    }>;
  };

  const c0 = p?.choices?.[0];
  if (!c0) return null;
  if (typeof c0.message?.content === "string" && c0.message.content.trim().length > 0) {
    return c0.message.content;
  }
  if (typeof c0.text === "string" && c0.text.trim().length > 0) {
    return c0.text;
  }
  return null;
}

function buildFallbackResult(
  prompt: string,
  usedPatterns: string[],
  usedConstraints: string[],
  reason: LocalAIReplyResult["fallback_reason"]
): LocalAIReplyResult {
  const raw = chooseVariation(
    prompt.toLowerCase(),
    `${usedPatterns.join("|")}:${usedConstraints.join("|")}`
  );
  const safety = enforceSafety(raw);
  return {
    generated_reply: safety.safeReply,
    reply_source: "deterministic_fallback",
    fallback_reason: reason,
    reply_reasoning: {
      used_patterns: usedPatterns,
      used_constraints: usedConstraints,
      blocked_behaviors: safety.blocked
    },
    runtime_safety: {
      emotional_inference_blocked: safety.emotionalBlocked,
      unsupported_claim_blocked: safety.unsupportedBlocked,
      operational_realism_preserved: true
    }
  };
}

export async function generateLocalAIReply(
  prompt: string,
  usedPatterns: string[],
  usedConstraints: string[]
): Promise<LocalAIReplyResult> {
  const cfg = fromEnv();
  const hasLocalEndpoint = cfg.baseUrl.length > 0 && cfg.model.length > 0;

  if (!hasLocalEndpoint) {
    return buildFallbackResult(prompt, usedPatterns, usedConstraints, "missing_local_endpoint");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30000);

  try {
    const resp = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.35,
        top_p: 0.9,
        max_tokens: 140,
        messages: [
          {
            role: "system",
            content:
              "You are always the CUSTOMER/BUYER. Reply in concise natural Vietnamese with accents. Avoid assistant/support tone. Keep operational realism. Do not invent emotion, history, demographics, or motives."
          },
          { role: "user", content: prompt }
        ]
      }),
      signal: controller.signal
    });

    if (!resp.ok) {
      return buildFallbackResult(prompt, usedPatterns, usedConstraints, "generation_failure");
    }

    const data = await resp.json();
    const extracted = extractContent(data);
    if (!extracted) {
      return buildFallbackResult(prompt, usedPatterns, usedConstraints, "invalid_response_format");
    }

    const safety = enforceSafety(extracted);
    if (safety.fullyBlocked) {
      return buildFallbackResult(prompt, usedPatterns, usedConstraints, "safety_block");
    }

    return {
      generated_reply: safety.safeReply,
      reply_source: "local_ai_generated",
      reply_reasoning: {
        used_patterns: usedPatterns,
        used_constraints: usedConstraints,
        blocked_behaviors: safety.blocked
      },
      runtime_safety: {
        emotional_inference_blocked: safety.emotionalBlocked,
        unsupported_claim_blocked: safety.unsupportedBlocked,
        operational_realism_preserved: true
      }
    };
  } catch (error) {
    const reason =
      error instanceof Error && /abort/i.test(error.name)
        ? "timeout"
        : "generation_failure";
    return buildFallbackResult(prompt, usedPatterns, usedConstraints, reason);
  } finally {
    clearTimeout(timeout);
  }
}
