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
  response_diagnostics?: LocalAIResponseDiagnostics;
}

export interface LocalAIResponseDiagnostics {
  request_body_keys: string[];
  stream_enabled: boolean;
  disable_thinking_requested: boolean;
  chat_template_kwargs_present: boolean;
  response_format_type: string | null;
  messages_format: "openai_chat_messages";
  response_shape_keys: string[];
  choice_keys: string[];
  message_keys: string[];
  content_type: string;
  content_length: number;
  trimmed_content_length: number;
  starts_with_json_object: boolean;
  starts_with_markdown_fence: boolean;
  parse_attempt_status:
    | "string_content"
    | "content_parts_joined"
    | "text_field"
    | "reasoning_only"
    | "reasoning_content_only"
    | "empty_or_missing"
    | "unsupported_content_type";
  missing_required_fields: string[];
  error_type: string | null;
  response_source: "openai_chat_completions";
  model_name: string;
  latency_ms: number;
  reasoning_type: string;
  reasoning_length: number;
  finish_reason?: string;
  stop_reason?: string | null;
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
    "http://192.168.117.73:9001/v1";
  const model =
    process.env.LOCAL_AI_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.LOCAL_QWEN_MODEL ||
    envMap.LOCAL_AI_MODEL ||
    envMap.OPENAI_MODEL ||
    envMap.LOCAL_QWEN_MODEL ||
    "qwen3-8b";
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

function detectContentType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function extractContentWithDiagnostics(
  payload: unknown,
  modelName: string,
  latencyMs: number,
  requestMetadata: Pick<
    LocalAIResponseDiagnostics,
    | "request_body_keys"
    | "stream_enabled"
    | "disable_thinking_requested"
    | "chat_template_kwargs_present"
    | "response_format_type"
    | "messages_format"
  >
): { extracted: string | null; diagnostics: LocalAIResponseDiagnostics } {
  const p = payload as {
    choices?: Array<{
      message?: {
        content?: unknown;
        reasoning?: unknown;
        reasoning_content?: unknown;
      };
      text?: string;
    }>;
  };

  const c0 = p?.choices?.[0];
  const messageObj = c0?.message;
  const rawContent = messageObj?.content;
  const rawReasoning = messageObj?.reasoning;
  const rawReasoningContent = messageObj?.reasoning_content;
  const responseShapeKeys = payload && typeof payload === "object"
    ? Object.keys(payload as Record<string, unknown>)
    : [];
  const choiceKeys = c0 && typeof c0 === "object"
    ? Object.keys(c0 as Record<string, unknown>)
    : [];
  const messageKeys = messageObj && typeof messageObj === "object"
    ? Object.keys(messageObj as Record<string, unknown>)
    : [];
  const missingRequiredFields: string[] = [];

  if (!Array.isArray(p?.choices) || !c0) {
    missingRequiredFields.push("choices[0]");
  }

  let candidateText: string | null = null;
  let parseAttemptStatus: LocalAIResponseDiagnostics["parse_attempt_status"] = "empty_or_missing";

  if (typeof rawContent === "string") {
    candidateText = rawContent;
    parseAttemptStatus = "string_content";
    if (rawContent.trim().length === 0) {
      candidateText = null;
      parseAttemptStatus = "empty_or_missing";
      missingRequiredFields.push("choices[0].message.content");
    }
  } else if (Array.isArray(rawContent)) {
    const parts = rawContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const asRecord = part as Record<string, unknown>;
        if (typeof asRecord.text === "string") return asRecord.text;
        if (asRecord.text && typeof asRecord.text === "object") {
          const nestedText = (asRecord.text as Record<string, unknown>).value;
          if (typeof nestedText === "string") return nestedText;
        }
        return "";
      })
      .filter((value) => value.trim().length > 0);
    candidateText = parts.length > 0 ? parts.join("\n") : null;
    parseAttemptStatus = candidateText ? "content_parts_joined" : "empty_or_missing";
    if (!candidateText) {
      missingRequiredFields.push("choices[0].message.content[text]");
    }
  } else if (typeof c0?.text === "string" && c0.text.trim().length > 0) {
    candidateText = c0.text;
    parseAttemptStatus = "text_field";
  } else if (typeof rawReasoning === "string" && rawReasoning.trim().length > 0) {
    candidateText = null;
    parseAttemptStatus = "reasoning_only";
    missingRequiredFields.push("choices[0].message.content");
  } else if (
    typeof rawReasoningContent === "string" &&
    rawReasoningContent.trim().length > 0
  ) {
    candidateText = null;
    parseAttemptStatus = "reasoning_content_only";
    missingRequiredFields.push("choices[0].message.content");
  } else if (rawContent !== undefined && rawContent !== null) {
    parseAttemptStatus = "unsupported_content_type";
    missingRequiredFields.push("choices[0].message.content[string]");
  } else {
    missingRequiredFields.push("choices[0].message.content");
    if (!messageObj) {
      missingRequiredFields.push("choices[0].message");
    }
  }

  const trimmed = candidateText?.trim() ?? "";
  return {
    extracted: trimmed.length > 0 ? candidateText : null,
    diagnostics: {
      request_body_keys: requestMetadata.request_body_keys,
      stream_enabled: requestMetadata.stream_enabled,
      disable_thinking_requested: requestMetadata.disable_thinking_requested,
      chat_template_kwargs_present: requestMetadata.chat_template_kwargs_present,
      response_format_type: requestMetadata.response_format_type,
      messages_format: requestMetadata.messages_format,
      response_shape_keys: responseShapeKeys,
      choice_keys: choiceKeys,
      message_keys: messageKeys,
      content_type: detectContentType(rawContent),
      content_length: candidateText?.length ?? 0,
      trimmed_content_length: trimmed.length,
      starts_with_json_object: trimmed.startsWith("{"),
      starts_with_markdown_fence: trimmed.startsWith("```"),
      parse_attempt_status: parseAttemptStatus,
      missing_required_fields: Array.from(new Set(missingRequiredFields)),
      error_type: null,
      response_source: "openai_chat_completions",
      model_name: modelName,
      latency_ms: latencyMs,
      reasoning_type: detectContentType(rawReasoning ?? rawReasoningContent),
      reasoning_length:
        typeof rawReasoning === "string"
          ? rawReasoning.length
          : typeof rawReasoningContent === "string"
            ? rawReasoningContent.length
            : 0,
      finish_reason: typeof c0?.finish_reason === "string" ? c0.finish_reason : undefined,
      stop_reason: typeof (c0 as Record<string, unknown> | undefined)?.stop_reason === "string"
        ? String((c0 as Record<string, unknown>).stop_reason)
        : null,
    }
  };
}

function buildFallbackResult(
  prompt: string,
  usedPatterns: string[],
  usedConstraints: string[],
  reason: LocalAIReplyResult["fallback_reason"],
  responseDiagnostics?: LocalAIResponseDiagnostics
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
    },
    response_diagnostics: responseDiagnostics
  };
}

function writeInstrumentationLog(logEntry: {
  model_name: string;
  max_tokens_used: number;
  finish_reason: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  has_reasoning_field: "yes" | "no";
  content_null: "yes" | "no";
  raw_content_length_chars: number;
  final_reply_length_chars: number;
  reply_source: "local_ai_generated" | "deterministic_fallback";
  latency_ms?: number;
  error_type?: string | null;
  response_shape_keys?: string[];
  choice_keys?: string[];
  message_keys?: string[];
  content_type?: string;
  content_length?: number;
  trimmed_content_length?: number;
  starts_with_json_object?: boolean;
  starts_with_markdown_fence?: boolean;
  parse_attempt_status?: string;
  missing_required_fields?: string[];
  response_source?: string;
  reasoning_type?: string;
  reasoning_length?: number;
  request_body_keys?: string[];
  stream_enabled?: boolean;
  disable_thinking_requested?: boolean;
  chat_template_kwargs_present?: boolean;
  response_format_type?: string | null;
  messages_format?: string;
  stop_reason?: string | null;
}) {
  const envMap = loadDotEnv();
  const enable =
    process.env.ENABLE_MODEL_INSTRUMENTATION === "true" ||
    envMap.ENABLE_MODEL_INSTRUMENTATION === "true";

  if (!enable) return;

  // 1. Console log
  console.log("[QWEN3_INSTRUMENTATION]", JSON.stringify(logEntry));

  // 2. File log
  try {
    const logPath =
      process.env.MODEL_INSTRUMENTATION_LOG_PATH ||
      envMap.MODEL_INSTRUMENTATION_LOG_PATH ||
      "logs/qwen3_instrumentation_log.jsonl";

    const absoluteLogPath = path.isAbsolute(logPath)
      ? logPath
      : path.join(process.cwd(), logPath);

    const dir = path.dirname(absoluteLogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(absoluteLogPath, JSON.stringify(logEntry) + "\n", "utf8");
  } catch (err) {
    // Fail silently to avoid breaking the runtime in case of file write issues
  }
}

export async function generateLocalAIReply(
  prompt: string,
  usedPatterns: string[],
  usedConstraints: string[]
): Promise<LocalAIReplyResult> {
  const cfg = fromEnv();
  const envMap = loadDotEnv();
  
  const maxTokensEnv = process.env.OPENAI_MAX_TOKENS || envMap.OPENAI_MAX_TOKENS;
  const maxTokens = maxTokensEnv ? parseInt(maxTokensEnv, 10) : 512;

  const disableThinking =
    process.env.OPENAI_DISABLE_THINKING === "true" ||
    envMap.OPENAI_DISABLE_THINKING === "true";

  let systemPrompt =
    "You are always the CUSTOMER/BUYER. Reply in concise natural Vietnamese with accents. Avoid assistant/support tone. Keep operational realism. Do not invent emotion, history, demographics, or motives.";

  if (disableThinking) {
    systemPrompt = `/no_think\nRespond only as the customer.\nDo not output reasoning, analysis, or thinking blocks.\n${systemPrompt}`;
  }

  const hasLocalEndpoint = cfg.baseUrl.length > 0 && cfg.model.length > 0;
  const requestBody: Record<string, unknown> = {
    model: cfg.model,
    temperature: 0.35,
    top_p: 0.9,
    max_tokens: maxTokens,
    stream: false,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      { role: "user", content: prompt }
    ]
  };

  if (disableThinking) {
    requestBody.chat_template_kwargs = { enable_thinking: false };
  }

  const requestMetadata = {
    request_body_keys: Object.keys(requestBody),
    stream_enabled: false,
    disable_thinking_requested: disableThinking,
    chat_template_kwargs_present: Object.prototype.hasOwnProperty.call(
      requestBody,
      "chat_template_kwargs"
    ),
    response_format_type: null,
    messages_format: "openai_chat_messages" as const,
  };

  if (!hasLocalEndpoint) {
    writeInstrumentationLog({
      model_name: cfg.model,
      max_tokens_used: maxTokens,
      finish_reason: "error",
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      has_reasoning_field: "no",
      content_null: "yes",
      raw_content_length_chars: 0,
      final_reply_length_chars: 0,
      reply_source: "deterministic_fallback",
      latency_ms: 0,
      error_type: "missing_local_endpoint"
    });
    return buildFallbackResult(prompt, usedPatterns, usedConstraints, "missing_local_endpoint", {
      response_shape_keys: [],
      choice_keys: [],
      message_keys: [],
      content_type: "missing_endpoint",
      content_length: 0,
      trimmed_content_length: 0,
      starts_with_json_object: false,
      starts_with_markdown_fence: false,
      parse_attempt_status: "empty_or_missing",
      missing_required_fields: ["endpoint"],
      error_type: "missing_local_endpoint",
      response_source: "openai_chat_completions",
      model_name: cfg.model,
      latency_ms: 0,
      reasoning_type: "undefined",
      reasoning_length: 0,
      request_body_keys: requestMetadata.request_body_keys,
      stream_enabled: requestMetadata.stream_enabled,
      disable_thinking_requested: requestMetadata.disable_thinking_requested,
      chat_template_kwargs_present: requestMetadata.chat_template_kwargs_present,
      response_format_type: requestMetadata.response_format_type,
      messages_format: requestMetadata.messages_format,
      stop_reason: null,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30000);

  const t0 = Date.now();
  let latencyMs = 0;

  try {
    const resp = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    latencyMs = Date.now() - t0;

    if (!resp.ok) {
      writeInstrumentationLog({
        model_name: cfg.model,
        max_tokens_used: maxTokens,
        finish_reason: "error",
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        has_reasoning_field: "no",
        content_null: "yes",
        raw_content_length_chars: 0,
        final_reply_length_chars: 0,
        reply_source: "deterministic_fallback",
        latency_ms: latencyMs,
        error_type: `api_status_${resp.status}`
      });
      return buildFallbackResult(prompt, usedPatterns, usedConstraints, "generation_failure", {
        response_shape_keys: [],
        choice_keys: [],
        message_keys: [],
        content_type: "http_error",
        content_length: 0,
        trimmed_content_length: 0,
        starts_with_json_object: false,
        starts_with_markdown_fence: false,
        parse_attempt_status: "empty_or_missing",
        missing_required_fields: [`http_status_${resp.status}`],
        error_type: `api_status_${resp.status}`,
        response_source: "openai_chat_completions",
        model_name: cfg.model,
        latency_ms: latencyMs,
        reasoning_type: "undefined",
        reasoning_length: 0,
        request_body_keys: requestMetadata.request_body_keys,
        stream_enabled: requestMetadata.stream_enabled,
        disable_thinking_requested: requestMetadata.disable_thinking_requested,
        chat_template_kwargs_present: requestMetadata.chat_template_kwargs_present,
        response_format_type: requestMetadata.response_format_type,
        messages_format: requestMetadata.messages_format,
        stop_reason: null,
      });
    }

    const data = await resp.json();
    const choice = data?.choices?.[0];
    const messageObj = choice?.message;
    const content = messageObj?.content || null;
    const finishReason = choice?.finish_reason || "unknown";
    const usage = data?.usage || {};

    const hasReasoning = (
      messageObj?.reasoning ||
      messageObj?.reasoning_content ||
      (typeof content === "string" && (content.includes("<think>") || content.includes("</think>")))
    ) ? "yes" : "no";

    const contentNull = (content === null || content === undefined || String(content).trim().length === 0) ? "yes" : "no";
    const rawContentLength = content ? String(content).length : 0;

    const extractedResult = extractContentWithDiagnostics(
      data,
      cfg.model,
      latencyMs,
      requestMetadata
    );
    const extracted = extractedResult.extracted;
    if (!extracted) {
      const diagnostics = {
        ...extractedResult.diagnostics,
        error_type: "invalid_response_format"
      };
      writeInstrumentationLog({
        model_name: cfg.model,
        max_tokens_used: maxTokens,
        finish_reason: finishReason,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0
        },
        has_reasoning_field: hasReasoning,
        content_null: contentNull,
        raw_content_length_chars: rawContentLength,
        final_reply_length_chars: 0,
        reply_source: "deterministic_fallback",
        latency_ms: latencyMs,
        error_type: "invalid_response_format",
        response_shape_keys: diagnostics.response_shape_keys,
        choice_keys: diagnostics.choice_keys,
        message_keys: diagnostics.message_keys,
        content_type: diagnostics.content_type,
        content_length: diagnostics.content_length,
        trimmed_content_length: diagnostics.trimmed_content_length,
        starts_with_json_object: diagnostics.starts_with_json_object,
        starts_with_markdown_fence: diagnostics.starts_with_markdown_fence,
        parse_attempt_status: diagnostics.parse_attempt_status,
        missing_required_fields: diagnostics.missing_required_fields,
        response_source: diagnostics.response_source,
        reasoning_type: diagnostics.reasoning_type,
        reasoning_length: diagnostics.reasoning_length,
        request_body_keys: diagnostics.request_body_keys,
        stream_enabled: diagnostics.stream_enabled,
        disable_thinking_requested: diagnostics.disable_thinking_requested,
        chat_template_kwargs_present: diagnostics.chat_template_kwargs_present,
        response_format_type: diagnostics.response_format_type,
        messages_format: diagnostics.messages_format,
        stop_reason: diagnostics.stop_reason
      });
      return buildFallbackResult(
        prompt,
        usedPatterns,
        usedConstraints,
        "invalid_response_format",
        diagnostics
      );
    }

    const safety = enforceSafety(extracted);
    if (safety.fullyBlocked) {
      const diagnostics = {
        ...extractedResult.diagnostics,
        error_type: "safety_block"
      };
      writeInstrumentationLog({
        model_name: cfg.model,
        max_tokens_used: maxTokens,
        finish_reason: finishReason,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0
        },
        has_reasoning_field: hasReasoning,
        content_null: contentNull,
        raw_content_length_chars: rawContentLength,
        final_reply_length_chars: safety.safeReply.length,
        reply_source: "deterministic_fallback",
        latency_ms: latencyMs,
        error_type: "safety_block",
        response_shape_keys: diagnostics.response_shape_keys,
        choice_keys: diagnostics.choice_keys,
        message_keys: diagnostics.message_keys,
        content_type: diagnostics.content_type,
        content_length: diagnostics.content_length,
        trimmed_content_length: diagnostics.trimmed_content_length,
        starts_with_json_object: diagnostics.starts_with_json_object,
        starts_with_markdown_fence: diagnostics.starts_with_markdown_fence,
        parse_attempt_status: diagnostics.parse_attempt_status,
        missing_required_fields: diagnostics.missing_required_fields,
        response_source: diagnostics.response_source,
        reasoning_type: diagnostics.reasoning_type,
        reasoning_length: diagnostics.reasoning_length,
        request_body_keys: diagnostics.request_body_keys,
        stream_enabled: diagnostics.stream_enabled,
        disable_thinking_requested: diagnostics.disable_thinking_requested,
        chat_template_kwargs_present: diagnostics.chat_template_kwargs_present,
        response_format_type: diagnostics.response_format_type,
        messages_format: diagnostics.messages_format,
        stop_reason: diagnostics.stop_reason
      });
      return buildFallbackResult(prompt, usedPatterns, usedConstraints, "safety_block", diagnostics);
    }

    const diagnostics = {
      ...extractedResult.diagnostics,
      error_type: null
    };
    writeInstrumentationLog({
      model_name: cfg.model,
      max_tokens_used: maxTokens,
      finish_reason: finishReason,
      usage: {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0
      },
      has_reasoning_field: hasReasoning,
      content_null: contentNull,
      raw_content_length_chars: rawContentLength,
      final_reply_length_chars: safety.safeReply.length,
      reply_source: "local_ai_generated",
      latency_ms: latencyMs,
      error_type: null,
      response_shape_keys: diagnostics.response_shape_keys,
      choice_keys: diagnostics.choice_keys,
      message_keys: diagnostics.message_keys,
      content_type: diagnostics.content_type,
      content_length: diagnostics.content_length,
      trimmed_content_length: diagnostics.trimmed_content_length,
      starts_with_json_object: diagnostics.starts_with_json_object,
      starts_with_markdown_fence: diagnostics.starts_with_markdown_fence,
      parse_attempt_status: diagnostics.parse_attempt_status,
      missing_required_fields: diagnostics.missing_required_fields,
      response_source: diagnostics.response_source,
      reasoning_type: diagnostics.reasoning_type,
      reasoning_length: diagnostics.reasoning_length,
      request_body_keys: diagnostics.request_body_keys,
      stream_enabled: diagnostics.stream_enabled,
      disable_thinking_requested: diagnostics.disable_thinking_requested,
      chat_template_kwargs_present: diagnostics.chat_template_kwargs_present,
      response_format_type: diagnostics.response_format_type,
      messages_format: diagnostics.messages_format,
      stop_reason: diagnostics.stop_reason
    });

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
      },
      response_diagnostics: diagnostics
    };
  } catch (error) {
    console.error("[LOCAL_AI_ADAPTER_ERROR] Failed to generate local AI reply:", error);
    const elapsed = Date.now() - t0;
    const isTimeout = error instanceof Error && /abort/i.test(error.name);
    const errorType = isTimeout ? "timeout" : "generation_failure";

    writeInstrumentationLog({
      model_name: cfg.model,
      max_tokens_used: maxTokens,
      finish_reason: "error",
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      has_reasoning_field: "no",
      content_null: "yes",
      raw_content_length_chars: 0,
      final_reply_length_chars: 0,
      reply_source: "deterministic_fallback",
      latency_ms: elapsed,
      error_type: errorType
    });

    return buildFallbackResult(
      prompt,
      usedPatterns,
      usedConstraints,
      isTimeout ? "timeout" : "generation_failure",
      {
        response_shape_keys: [],
        choice_keys: [],
        message_keys: [],
        content_type: "runtime_error",
        content_length: 0,
        trimmed_content_length: 0,
        starts_with_json_object: false,
        starts_with_markdown_fence: false,
        parse_attempt_status: "empty_or_missing",
        missing_required_fields: [isTimeout ? "timeout" : "response_payload"],
        error_type,
        response_source: "openai_chat_completions",
        model_name: cfg.model,
        latency_ms: elapsed,
        reasoning_type: "undefined",
        reasoning_length: 0,
        request_body_keys: requestMetadata.request_body_keys,
        stream_enabled: requestMetadata.stream_enabled,
        disable_thinking_requested: requestMetadata.disable_thinking_requested,
        chat_template_kwargs_present: requestMetadata.chat_template_kwargs_present,
        response_format_type: requestMetadata.response_format_type,
        messages_format: requestMetadata.messages_format,
        stop_reason: null,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}
