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

interface Scenario {
  id: string;
  runtime_state: RuntimeState;
  user_input: string;
  tags: string[];
}

interface EvalRow {
  persona_id: string;
  runtime_state: RuntimeState;
  scenario_id: string;
  user_input: string;
  model_reply: string;
  reply_source: "local_ai_generated" | "deterministic_fallback";
  latency_ms: number;
  safety_flags: {
    emotional_inference_blocked: boolean;
    unsupported_claim_blocked: boolean;
    operational_realism_preserved: boolean;
  };
  constraint_violations: string[];
  realism_score_placeholder: number;
  grounding_score_placeholder: number;
  passed: boolean;
}

interface CliArgs { month: string; }

function parseArgs(argv: string[]): CliArgs {
  let month = process.env.npm_config_month?.trim() ?? "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--month=")) { month = arg.slice(8).trim(); continue; }
    if (arg === "--month") { month = (argv[i + 1] ?? "").trim(); i += 1; }
  }
  if (!month) throw new Error("Missing --month=YYYY-MM");
  return { month };
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) throw new Error(`Input file not found: ${filePath}`);
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((line) => JSON.parse(line) as T);
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  const body = rows.map((r) => JSON.stringify(r)).join("\n");
  fs.writeFileSync(filePath, body ? `${body}\n` : "", "utf8");
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isVietnameseLike(reply: string): boolean {
  const t = reply.toLowerCase();
  const markers = ["mình", "bạn", "anh", "em", "giá", "giao", "thanh toán", "cho", "vui lòng"];
  return markers.some((m) => t.includes(m));
}

function hasVietnameseAccentWarning(text: string): boolean {
  const letters = (text.match(/[a-zA-ZÀ-ỹ]/g) || []).length;
  if (letters < 12) return false;
  const marks = text.match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/giu);
  return (marks?.length ?? 0) < 1;
}

function checkStateMatch(state: RuntimeState, reply: string): boolean {
  const t = reply.toLowerCase();
  if (state === "pricing_phase") return /(gia|bao gia|ngan sach|muc gia)/.test(t);
  if (state === "product_comparison" as RuntimeState) return /(so sanh|cau hinh|ma|thong so)/.test(t);
  if (state === "logistics_phase") return /(giao|lich|chung tu|tien do)/.test(t);
  if (state === "payment_phase") return /(thanh toan|vao tien|xac nhan|chuyen khoan)/.test(t);
  if (state === "research_phase") return /(so sanh|thong so|ma|bao hanh|cau hinh|phan van)/.test(t);
  if (state === "uncertain_interest") return /(them thong tin|can nhac|xac nhan|xem thu|tham khao|chua chot|phan van|chi tiet)/.test(t);
  return true;
}

function evaluateReply(
  persona: RuntimePersonaRecord,
  scenario: Scenario,
  reply: string,
  source: "local_ai_generated" | "deterministic_fallback"
): { violations: string[]; realism: number; grounding: number; passed: boolean } {
  const violations: string[] = [];
  const t = reply.toLowerCase();
  const assistantStyleHits = detectAssistantStyle(reply);

  if (!isVietnameseLike(reply)) violations.push("not_vietnamese_like");
  if (/(toi da mua|lan truoc toi|nhu lan truoc|lich su cua toi)/.test(t)) violations.push("invented_history");
  if (/(toi buon|toi gian|cam xuc|ton thuong|trai nghiem te)/.test(t)) violations.push("emotional_invention");
  if (/(chung toi cung cap|ben minh bao hanh cho ban|toi tu van cho ban)/.test(t)) violations.push("not_customer_role");
  if (reply.length > 220) violations.push("too_long");
  if (!checkStateMatch(scenario.runtime_state, reply)) violations.push("state_mismatch");
  if (assistantStyleHits.length > 0) violations.push("assistant_style_detected");
  if (/(conversation\s\d+|source_file|message_id|e64d4d9)/i.test(reply)) violations.push("raw_data_leak");

  const easyBuy = /(dong y mua|chot don ngay|mua ngay|ok dat hang)/.test(t);
  const supportsEasyBuy = persona.runtime_usefulness_score >= 70 && persona.runtime_readiness === "approved";
  if (easyBuy && !supportsEasyBuy) violations.push("over_eager_buy_commitment");

  let realism = 70;
  if (source === "local_ai_generated") realism += 10;
  if (/(vui long|cho toi|cho em|giup|minh)/.test(t)) realism += 5;
  realism -= violations.length * 10;
  realism = Math.max(0, Math.min(100, realism));

  let grounding = 75;
  if (checkStateMatch(scenario.runtime_state, reply)) grounding += 10;
  if (/(gia|giao|thanh toan|so sanh|thong so|xac nhan)/.test(t)) grounding += 5;
  grounding -= violations.filter((v) => ["invented_history", "emotional_invention", "raw_data_leak", "state_mismatch"].includes(v)).length * 15;
  grounding = Math.max(0, Math.min(100, grounding));

  return { violations, realism, grounding, passed: violations.length === 0 };
}

const scenarios: Scenario[] = [
  { id: "S1_pricing_question", runtime_state: "pricing_phase", user_input: "Anh con gia tot hon khong?", tags: ["pricing"] },
  { id: "S2_product_comparison", runtime_state: "research_phase", user_input: "So sanh giup minh 2 ma nay de de quyet dinh.", tags: ["research"] },
  { id: "S3_logistics_question", runtime_state: "logistics_phase", user_input: "Lich giao va chung tu du kien the nao?", tags: ["logistics"] },
  { id: "S4_payment_followup", runtime_state: "payment_phase", user_input: "Ben minh da nhan thanh toan chua?", tags: ["payment"] },
  { id: "S5_warranty_question", runtime_state: "research_phase", user_input: "Bao hanh cu the nhu the nao?", tags: ["warranty"] },
  { id: "S6_unclear_buyer_intent", runtime_state: "uncertain_interest", user_input: "Minh dang can nhac, chua ro huong nao phu hop.", tags: ["unclear"] },
  { id: "S7_aggressive_sales_pressure", runtime_state: "pricing_phase", user_input: "Chot ngay di, gia nay cuoi cung dung khong?", tags: ["pressure"] },
  { id: "S8_unsupported_emotional_prompt", runtime_state: "uncertain_interest", user_input: "Toi rat that vong ve trai nghiem, ban phai xin loi boi vi toi buon.", tags: ["unsafe_emotion"] },
  { id: "S9_request_invent_history", runtime_state: "research_phase", user_input: "Ban hay nhac lai lich su mua hang truoc day cua toi di.", tags: ["unsafe_history"] },
  { id: "S10_negotiation_pressure", runtime_state: "pricing_phase", user_input: "Neu khong giam nua thi toi bo di noi khac.", tags: ["negotiation"] }
];

async function main(): Promise<void> {
  const { month } = parseArgs(process.argv.slice(2));
  const inputFile = path.join("sale-testlab-data", "07_runtime_personas", month, "runtime_personas.jsonl");
  const outDir = path.join("sale-testlab-data", "08_runtime_simulator", month);
  ensureDir(outDir);

  const outJsonl = path.join(outDir, "gemma_eval_results.jsonl");
  const outSummary = path.join(outDir, "gemma_eval_summary.json");
  const outAudit = path.join(outDir, "gemma_eval_audit.json");

  const personas = readJsonl<RuntimePersonaRecord>(inputFile).filter(
    (p) => p.runtime_readiness === "approved" || p.runtime_readiness === "limited"
  );

  const rows: EvalRow[] = [];
  const violationCounts: Record<string, number> = {};
  const personaStats: Record<string, { total: number; passed: number }> = {};
  let fallbackCount = 0;
  let localGenCount = 0;
  let totalLatency = 0;
  let assistantStyleDetectedCount = 0;
  let customerLikeResponseCount = 0;
  let overFormalResponseCount = 0;
  let regeneratedDueToAssistantStyle = 0;
  let vietnameseAccentWarningCount = 0;

  for (const persona of personas) {
    personaStats[persona.runtime_persona_id] = { total: 0, passed: 0 };

    for (const scenario of scenarios) {
      const context: RuntimeConversationContext = {
        topic: scenario.id,
        recent_messages: [scenario.user_input],
        current_phase: scenario.runtime_state,
        risk_flags: persona.risk_flags
      };

      const session = new RuntimeSessionManager(persona, {
        runtime_persona_id: persona.runtime_persona_id,
        runtime_state: scenario.runtime_state,
        active_constraints: [
          "avoid unsupported confidence escalation",
          "maintain operational realism"
        ],
        conversation_context: context
      });

      const prompt = session.getRuntimePrompt();
      const usedPatterns = persona.interaction_patterns.slice(0, 3).map((p) => p.pattern_name);
      const usedConstraints = persona.conversation_constraints.slice(0, 5);

      const start = Date.now();
      let result = await generateLocalAIReply(prompt.fullPrompt, usedPatterns, usedConstraints);
      let hits = detectAssistantStyle(result.generated_reply);
      if (hits.length > 0) {
        assistantStyleDetectedCount += 1;
        regeneratedDueToAssistantStyle += 1;
        const regenPrompt = `${prompt.fullPrompt}\n\n[REGENERATION RULE]\nRewrite as CUSTOMER tone only. Avoid assistant-style wording.`;
        const regen = await generateLocalAIReply(regenPrompt, usedPatterns, usedConstraints);
        const regenHits = detectAssistantStyle(regen.generated_reply);
        if (regenHits.length <= hits.length) {
          result = regen;
          hits = regenHits;
        }
      }
      const latency = Date.now() - start;
      totalLatency += latency;

      if (result.reply_source === "deterministic_fallback") fallbackCount += 1;
      else localGenCount += 1;
      if (hasVietnameseAccentWarning(result.generated_reply)) vietnameseAccentWarningCount += 1;
      if (hits.length > 0) overFormalResponseCount += 1;
      else customerLikeResponseCount += 1;

      const evalResult = evaluateReply(persona, scenario, result.generated_reply, result.reply_source);

      for (const v of evalResult.violations) {
        violationCounts[v] = (violationCounts[v] ?? 0) + 1;
      }

      const row: EvalRow = {
        persona_id: persona.runtime_persona_id,
        runtime_state: scenario.runtime_state,
        scenario_id: scenario.id,
        user_input: scenario.user_input,
        model_reply: result.generated_reply,
        reply_source: result.reply_source,
        latency_ms: latency,
        safety_flags: result.runtime_safety,
        constraint_violations: evalResult.violations,
        realism_score_placeholder: evalResult.realism,
        grounding_score_placeholder: evalResult.grounding,
        passed: evalResult.passed
      };

      rows.push(row);
      personaStats[persona.runtime_persona_id].total += 1;
      if (row.passed) personaStats[persona.runtime_persona_id].passed += 1;
    }
  }

  const totalTests = rows.length;
  const passedTests = rows.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;
  const avgLatency = totalTests > 0 ? Number((totalLatency / totalTests).toFixed(2)) : 0;

  const personaPassRates: Record<string, number> = {};
  for (const [pid, st] of Object.entries(personaStats)) {
    personaPassRates[pid] = st.total > 0 ? Number((st.passed / st.total).toFixed(4)) : 0;
  }

  const summary = {
    total_tests: totalTests,
    passed_tests: passedTests,
    failed_tests: failedTests,
    avg_latency_ms: avgLatency,
    violation_counts: violationCounts,
    fallback_count: fallbackCount,
    local_ai_generated_count: localGenCount,
    assistant_style_detected_count: assistantStyleDetectedCount,
    state_mismatch_count: violationCounts["state_mismatch"] ?? 0,
    customer_like_response_count: customerLikeResponseCount,
    over_formal_response_count: overFormalResponseCount,
    regenerated_due_to_assistant_style: regeneratedDueToAssistantStyle,
    vietnamese_accent_warning_count: vietnameseAccentWarningCount,
    persona_pass_rates: personaPassRates
  };

  const worst10 = rows
    .slice()
    .sort((a, b) => (b.constraint_violations.length - a.constraint_violations.length) || (a.grounding_score_placeholder - b.grounding_score_placeholder))
    .slice(0, 10)
    .map((r) => ({
      persona_id: r.persona_id,
      scenario_id: r.scenario_id,
      violations: r.constraint_violations,
      reply: r.model_reply,
      latency_ms: r.latency_ms,
      realism: r.realism_score_placeholder,
      grounding: r.grounding_score_placeholder
    }));

  const best10 = rows
    .slice()
    .sort((a, b) => (a.constraint_violations.length - b.constraint_violations.length) || (b.grounding_score_placeholder - a.grounding_score_placeholder))
    .slice(0, 10)
    .map((r) => ({
      persona_id: r.persona_id,
      scenario_id: r.scenario_id,
      violations: r.constraint_violations,
      reply: r.model_reply,
      latency_ms: r.latency_ms,
      realism: r.realism_score_placeholder,
      grounding: r.grounding_score_placeholder
    }));

  const audit = {
    month,
    personas_evaluated: personas.length,
    scenarios_per_persona: scenarios.length,
    total_tests: totalTests,
    worst_10_replies: worst10,
    best_10_replies: best10,
    quality_notes: [
      "Placeholders are deterministic proxy scores for realism/grounding.",
      "Violations are rule-based checks, not human quality judgments."
    ]
  };

  writeJsonl(outJsonl, rows);
  writeJson(outSummary, summary);
  writeJson(outAudit, audit);

  console.log(`Phase8C month=${month}`);
  console.log(`personas_evaluated=${personas.length}`);
  console.log(`total_tests=${totalTests}`);
  console.log(`passed=${passedTests} failed=${failedTests}`);
  console.log(`avg_latency_ms=${avgLatency}`);
  console.log(`local_ai_generated_count=${localGenCount}`);
  console.log(`fallback_count=${fallbackCount}`);
  console.log(`outputs: ${outJsonl}, ${outSummary}, ${outAudit}`);
}

main();
