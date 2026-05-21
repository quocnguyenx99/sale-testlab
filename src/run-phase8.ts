import * as fs from "fs";
import * as path from "path";
import { RuntimeState, detectAssistantStyle } from "./runtime/runtimeConstraints";
import { RuntimeSessionManager } from "./runtime/runtimeSessionManager";
import {
  RuntimeConversationContext,
  RuntimePersonaForPrompt
} from "./runtime/runtimePromptBuilder";
import { generateLocalAIReply } from "./runtime/localAIRuntimeAdapter";

type RuntimePersonaRecord = RuntimePersonaForPrompt & {
  source_entity_id: string;
  runtime_version: string;
  runtime_usefulness_score: number;
  primary_contexts: string[];
  allowed_runtime_usage: {
    sales_training: boolean;
    customer_simulation: boolean;
    objection_training: boolean;
    negotiation_training: boolean;
  };
};

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
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

function chooseState(persona: RuntimePersonaRecord): RuntimeState {
  const b = persona.runtime_behavior_profile;
  if (b.pricing_behavior.length > 0) return "pricing_phase";
  if (b.logistics_behavior.length > 0) return "logistics_phase";
  if (b.payment_behavior.length > 0) return "payment_phase";
  if (b.research_behavior.length > 0) return "research_phase";
  return "uncertain_interest";
}

function buildSeedUserMessage(state: RuntimeState): string {
  if (state === "pricing_phase") return "Anh còn giá tốt hơn không?";
  if (state === "logistics_phase") return "Lịch giao và chứng từ thế nào vậy?";
  if (state === "payment_phase") return "Bên mình đã nhận thanh toán chưa?";
  if (state === "research_phase") return "Mã nào phù hợp hơn để mình so sánh?";
  if (state === "operational_followup") return "Bạn cập nhật giúp tiến độ xử lý hiện tại.";
  if (state === "passive_followup") return "Mình theo dõi tiếp, có gì cập nhật giúp nhé.";
  return "Mình cần thêm thông tin để quyết định.";
}

function hasVietnameseAccentWarning(text: string): boolean {
  const letters = (text.match(/[a-zA-ZÀ-ỹ]/g) || []).length;
  if (letters < 12) return false;
  const marks = text.match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/giu);
  return (marks?.length ?? 0) < 1;
}

function mask(id: string): string {
  if (!id) return "unk***";
  if (id.length < 8) return `${id.slice(0, 2)}***`;
  return `${id.slice(0, 3)}***${id.slice(-3)}`;
}

async function main(): Promise<void> {
  const { month } = parseArgs(process.argv.slice(2));

  const inputFile = path.join(
    "sale-testlab-data",
    "07_runtime_personas",
    month,
    "runtime_personas.jsonl"
  );

  const outDir = path.join("sale-testlab-data", "08_runtime_simulator", month);
  const outPreview = path.join(outDir, "runtime_simulation_preview.json");
  const outAudit = path.join(outDir, "runtime_simulation_audit.json");
  const outPrompts = path.join(outDir, "runtime_prompt_examples.json");

  const personas = readJsonl<RuntimePersonaRecord>(inputFile);
  ensureDir(outDir);

  const previewRows: Array<Record<string, unknown>> = [];
  const promptExamples: Array<Record<string, unknown>> = [];

  let actualUnsafeBlocks = 0;
  let activeConstraintApplications = 0;
  let emotionalBlocks = 0;
  let unsupportedBlocks = 0;
  let highRiskPersonaUsage = 0;
  let localGeneratedCount = 0;
  let fallbackCount = 0;
  let fallbackGenerationFailure = 0;
  let fallbackSafetyBlock = 0;
  let assistantStyleDetectedCount = 0;
  let stateMismatchCount = 0;
  let customerLikeResponseCount = 0;
  let overFormalResponseCount = 0;
  let regeneratedDueToAssistantStyle = 0;
  let vietnameseAccentWarningCount = 0;
  const triggerCounts: Record<string, number> = {};
  const warnings: string[] = [];

  for (const persona of personas.slice(0, 5)) {
    if (persona.risk_flags.length > 0) highRiskPersonaUsage += 1;

    const state = chooseState(persona);
    const userInput = buildSeedUserMessage(state);

    const context: RuntimeConversationContext = {
      topic: state,
      recent_messages: [userInput],
      current_phase: state,
      risk_flags: persona.risk_flags
    };

    const session = new RuntimeSessionManager(persona, {
      runtime_persona_id: persona.runtime_persona_id,
      runtime_state: state,
      active_constraints: [
        "avoid unsupported confidence escalation",
        "maintain operational realism"
      ],
      conversation_context: context
    });

    const bundle = session.getRuntimePrompt();
    const usedPatterns = persona.interaction_patterns.slice(0, 3).map((p) => p.pattern_name);
    const usedConstraints = persona.conversation_constraints.slice(0, 5);

    let result = await generateLocalAIReply(bundle.fullPrompt, usedPatterns, usedConstraints);
    let assistantStyleHits = detectAssistantStyle(result.generated_reply);
    if (assistantStyleHits.length > 0) {
      assistantStyleDetectedCount += 1;
      regeneratedDueToAssistantStyle += 1;
      const regenPrompt = `${bundle.fullPrompt}\n\n[REGENERATION RULE]\nRewrite as CUSTOMER tone only. Avoid assistant-style wording.`;
      const regen = await generateLocalAIReply(regenPrompt, usedPatterns, usedConstraints);
      const regenHits = detectAssistantStyle(regen.generated_reply);
      if (regenHits.length <= assistantStyleHits.length) {
        result = regen;
        assistantStyleHits = regenHits;
      }
    }
    const accentWarning = hasVietnameseAccentWarning(result.generated_reply);
    if (accentWarning) vietnameseAccentWarningCount += 1;
    activeConstraintApplications += usedConstraints.length;
    if (result.reply_source === "local_ai_generated") localGeneratedCount += 1;
    else fallbackCount += 1;
    if (result.fallback_reason === "generation_failure" || result.fallback_reason === "timeout" || result.fallback_reason === "invalid_response_format" || result.fallback_reason === "missing_local_endpoint") {
      fallbackGenerationFailure += 1;
    }
    if (result.fallback_reason === "safety_block") {
      fallbackSafetyBlock += 1;
    }
    const lower = result.generated_reply.toLowerCase();
    if (assistantStyleHits.length > 0) overFormalResponseCount += 1;
    else customerLikeResponseCount += 1;

    if (state === "pricing_phase" && !/(gia|fix|tham khao|so sanh)/.test(lower)) stateMismatchCount += 1;
    if (state === "logistics_phase" && !/(giao|hang|kho|lich|chung tu)/.test(lower)) stateMismatchCount += 1;
    if (state === "payment_phase" && !/(thanh toan|chuyen khoan|vao tien|bill|check)/.test(lower)) stateMismatchCount += 1;
    if (state === "research_phase" && !/(so sanh|mau|ma|thong so|bao hanh)/.test(lower)) stateMismatchCount += 1;
    if (state === "uncertain_interest" && !/(xem thu|tham khao|chua chot|can nhac)/.test(lower)) stateMismatchCount += 1;

    if (!result.runtime_safety.operational_realism_preserved) {
      warnings.push(`operational_realism_not_preserved:${persona.runtime_persona_id}`);
    }
    if (result.reply_reasoning.blocked_behaviors.length > 0) {
      actualUnsafeBlocks += result.reply_reasoning.blocked_behaviors.length;
    }
    if (result.reply_reasoning.blocked_behaviors.includes("emotional_inference")) emotionalBlocks += 1;
    if (result.reply_reasoning.blocked_behaviors.includes("invented_history") || result.reply_reasoning.blocked_behaviors.includes("demographic_assumption")) unsupportedBlocks += 1;

    for (const c of usedConstraints) {
      triggerCounts[c] = (triggerCounts[c] ?? 0) + 1;
    }

    previewRows.push({
      runtime_persona_id: persona.runtime_persona_id,
      source_entity_id: mask(persona.source_entity_id),
      runtime_state: state,
      input_message: userInput,
      output: result
    });

    promptExamples.push({
      runtime_persona_id: persona.runtime_persona_id,
      runtime_state: state,
      prompt: bundle,
      output_example: result.generated_reply,
      reply_source: result.reply_source
    });
  }

  const audit = {
    actual_unsafe_blocks: actualUnsafeBlocks,
    active_constraint_applications: activeConstraintApplications,
    emotional_inference_blocks: emotionalBlocks,
    unsupported_claim_blocks: unsupportedBlocks,
    local_ai_generated_count: localGeneratedCount,
    deterministic_fallback_count: fallbackCount,
    fallback_due_to_generation_failure: fallbackGenerationFailure,
    fallback_due_to_safety_block: fallbackSafetyBlock,
    assistant_style_detected_count: assistantStyleDetectedCount,
    state_mismatch_count: stateMismatchCount,
    customer_like_response_count: customerLikeResponseCount,
    over_formal_response_count: overFormalResponseCount,
    regenerated_due_to_assistant_style: regeneratedDueToAssistantStyle,
    vietnamese_accent_warning_count: vietnameseAccentWarningCount,
    runtime_constraint_triggers: triggerCounts,
    high_risk_persona_usage: highRiskPersonaUsage,
    simulation_quality_warnings: warnings
  };

  writeJson(outPreview, {
    month,
    total_personas_input: personas.length,
    simulated_examples: previewRows.length,
    examples: previewRows
  });
  writeJson(outAudit, audit);
  writeJson(outPrompts, {
    month,
    prompt_count: promptExamples.length,
    prompts: promptExamples
  });

  if (fs.existsSync("runtime_prompt_examples.json")) {
    fs.unlinkSync("runtime_prompt_examples.json");
  }

  console.log(`Phase8 month=${month}`);
  console.log(`input_personas=${personas.length}`);
  console.log(`simulated_examples=${previewRows.length}`);
  console.log("files:");
  console.log(`- ${outPreview} (${fileSize(outPreview)} bytes)`);
  console.log(`- ${outAudit} (${fileSize(outAudit)} bytes)`);
  console.log(`- ${outPrompts} (${fileSize(outPrompts)} bytes)`);
}

main();
