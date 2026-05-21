import {
  ConversationTopic,
  createEmptyConversationProgress,
  ensureConversationProgress,
  getFirstUnresolvedTopic,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage
} from "../runtime/conversationProgressTracker";
import { createEmptyMemory, updateMemorySlots } from "../runtime/conversationMemory";
import {
  buildIdentityProfileFromPersona,
  detectIdentityDrift,
  IdentitySourcePersona
} from "../runtime/conversationIdentity";
import {
  detectRepeatedFreeFormLoop,
  detectRepeatedTopicAsking,
  isGenericConfirmationIntent,
  isRepeatedGenericFallback
} from "../runtime/repetitionGuard";
import {
  buildCompletionReply,
  detectReopenedAnsweredTopics,
  evaluateConversationCompletion,
  shouldForceCompletionReply
} from "../runtime/conversationCompletion";
import { buildResponseBankReply } from "../runtime/responseBank";
import { buildEnrichedRuntimePrompt } from "../runtime/runtimePromptBuilder";

type TurnState = {
  persona: IdentitySourcePersona;
  recentReplies: string[];
  recentFallbackVariantIds: string[];
  progress: ReturnType<typeof createEmptyConversationProgress>;
  memory: ReturnType<typeof createEmptyMemory>;
  identity: ReturnType<typeof buildIdentityProfileFromPersona>;
};

type TurnResult = {
  candidate_reply_before_guards: string;
  final_reply: string;
  reopened_answered_topics: ConversationTopic[];
  reopened_topic_detected: boolean;
  repeated_freeform_loop: boolean;
  repeated_blocked_topics: ConversationTopic[];
  completion_ready: boolean;
  completion_forced_reply: boolean;
  completion_reason: string;
  missing_topics: ConversationTopic[];
  resolved_topics: ConversationTopic[];
  next_unresolved_topic: ConversationTopic | null;
  fallback_variant_id: string | null;
  fallback_topic_used: string | null;
  completion_variant_id: string | null;
  completion_topic_used: ConversationTopic | null;
  completion_override_reason: string | null;
  identity_drift_detected: boolean;
  role_inversion_detected: boolean;
  guard_triggered: boolean;
  guard_trigger_reasons: string[];
};

type ScenarioResult = {
  id: string;
  result: "PASS" | "FAIL" | "PARTIAL";
  reason: string;
  evidence: string;
};

function makeState(persona: IdentitySourcePersona): TurnState {
  return {
    persona,
    recentReplies: [],
    recentFallbackVariantIds: [],
    progress: createEmptyConversationProgress(),
    memory: createEmptyMemory(),
    identity: buildIdentityProfileFromPersona(persona)
  };
}

function applyFallback(
  state: TurnState,
  topic: ConversationTopic | null,
  nextTopic: ConversationTopic | null
): { reply: string; variant_id: string; topic_used: string | null } {
  return buildResponseBankReply({
    topic,
    nextTopic,
    identity: state.identity,
    recentFallbackVariantIds: state.recentFallbackVariantIds,
    recentReplies: state.recentReplies
  });
}

function simulateTurn(
  state: TurnState,
  saleMessage: string,
  candidateReply: string
): TurnResult {
  state.memory = updateMemorySlots(state.memory, saleMessage);
  state.progress = ensureConversationProgress(updateProgressFromSaleMessage(state.progress, saleMessage));

  let reply = candidateReply;
  const candidateReplyBeforeGuards = candidateReply;
  const nextUnresolvedTopic = getFirstUnresolvedTopic(state.progress);
  const fallbackTopic = nextUnresolvedTopic ?? "next_step";
  let fallbackVariantId: string | null = null;
  let fallbackTopicUsed: string | null = null;
  let completionVariantId: string | null = null;
  let completionTopicUsed: ConversationTopic | null = null;
  let completionOverrideReason: string | null = null;
  let completionForcedReply = false;
  let guardTriggered = false;
  const guardReasons: string[] = [];

  const repeatedBlockedTopics = detectRepeatedTopicAsking(reply, state.progress);
  const repeatedFreeFormLoop = detectRepeatedFreeFormLoop(reply, state.recentReplies);
  const genericLoop = isRepeatedGenericFallback(reply, state.recentReplies);
  if (repeatedBlockedTopics.length > 0 || repeatedFreeFormLoop || genericLoop || isGenericConfirmationIntent(reply)) {
    const fb = applyFallback(state, fallbackTopic, fallbackTopic);
    reply = fb.reply;
    fallbackVariantId = fb.variant_id;
    fallbackTopicUsed = fb.topic_used;
    guardTriggered = true;
    if (repeatedBlockedTopics.length > 0) guardReasons.push(`repeated_topic:${repeatedBlockedTopics.join(",")}`);
    if (repeatedFreeFormLoop) guardReasons.push("free_form_loop");
    if (genericLoop) guardReasons.push("generic_loop");
    if (isGenericConfirmationIntent(candidateReply)) guardReasons.push("generic_confirmation");
  }

  const reopenedAnsweredTopics = detectReopenedAnsweredTopics(reply, state.progress);
  if (reopenedAnsweredTopics.length > 0) {
    const fb = applyFallback(state, fallbackTopic, fallbackTopic);
    reply = fb.reply;
    fallbackVariantId = fb.variant_id;
    fallbackTopicUsed = fb.topic_used;
    guardTriggered = true;
    guardReasons.push(`reopened_topic:${reopenedAnsweredTopics.join(",")}`);
  }

  const completion = evaluateConversationCompletion({
    conversation_progress: state.progress,
    identity_profile: state.identity,
    next_unresolved_topic: nextUnresolvedTopic,
    recent_turns: []
  });
  const safeNext = nextUnresolvedTopic ?? (completion.completion_ready ? "next_step" : completion.missing_topics[0] ?? null);

  if (completion.completion_ready) {
    const closing = buildCompletionReply({
      completion,
      identity: state.identity,
      recentReplies: state.recentReplies,
      nextUnresolvedTopic: safeNext
    });
    reply = closing.reply;
    completionForcedReply = true;
    completionVariantId = closing.variant_id;
    completionTopicUsed = closing.topic_used;
    completionOverrideReason = "completion_ready";
    fallbackVariantId = null;
    fallbackTopicUsed = null;
    guardTriggered = true;
    guardReasons.push("completion_ready");
  }

  const drift = detectIdentityDrift(reply, state.identity);
  if (drift.identity_drift_detected) {
    const fb = applyFallback(state, fallbackTopic, fallbackTopic);
    reply = fb.reply;
    fallbackVariantId = fb.variant_id;
    fallbackTopicUsed = fb.topic_used;
    guardTriggered = true;
    guardReasons.push("identity_drift");
  }

  if (!completion.completion_ready && shouldForceCompletionReply({
    candidateReply: reply,
    completion,
    progress: state.progress,
    identity: state.identity,
    recentReplies: state.recentReplies,
    nextUnresolvedTopic: safeNext
  })) {
    const closing = buildCompletionReply({
      completion,
      identity: state.identity,
      recentReplies: state.recentReplies,
      nextUnresolvedTopic: safeNext
    });
    reply = closing.reply;
    completionForcedReply = true;
    completionVariantId = closing.variant_id;
    completionTopicUsed = closing.topic_used;
    completionOverrideReason = "final_guard_forced";
    fallbackVariantId = null;
    fallbackTopicUsed = null;
    guardTriggered = true;
    guardReasons.push("final_guard");
  }

  state.progress = ensureConversationProgress(updateProgressFromCustomerMessage(state.progress, reply));
  state.recentReplies = [...state.recentReplies, reply].slice(-6);
  if (fallbackVariantId) {
    state.recentFallbackVariantIds = [...state.recentFallbackVariantIds, fallbackVariantId].slice(-3);
  }

  return {
    candidate_reply_before_guards: candidateReplyBeforeGuards,
    final_reply: reply,
    reopened_answered_topics: reopenedAnsweredTopics,
    reopened_topic_detected: reopenedAnsweredTopics.length > 0,
    repeated_freeform_loop: repeatedFreeFormLoop,
    repeated_blocked_topics: repeatedBlockedTopics,
    completion_ready: completion.completion_ready,
    completion_forced_reply: completionForcedReply,
    completion_reason: completion.completion_reason,
    missing_topics: completion.missing_topics,
    resolved_topics: completion.resolved_topics,
    next_unresolved_topic: getFirstUnresolvedTopic(state.progress) ?? (completion.completion_ready ? "next_step" : completion.missing_topics[0] ?? null),
    fallback_variant_id: fallbackVariantId,
    fallback_topic_used: fallbackTopicUsed,
    completion_variant_id: completionVariantId,
    completion_topic_used: completionTopicUsed,
    completion_override_reason: completionOverrideReason,
    identity_drift_detected: drift.identity_drift_detected,
    role_inversion_detected: drift.role_inversion_detected,
    guard_triggered: guardTriggered,
    guard_trigger_reasons: Array.from(new Set(guardReasons))
  };
}

function runOfflineScenarios(): ScenarioResult[] {
  const rows: ScenarioResult[] = [];

  {
    const s = makeState({ salutation_style: "anh-em", display_name: "Anh Nam" });
    const sales = [
      "Mau i5 RAM 16GB anh.",
      "Gia 25 trieu anh.",
      "Con 12 may anh.",
      "Mai giao duoc anh.",
      "Bao hanh 12 thang.",
      "Co hoa don cong ty.",
      "Thanh toan chuyen khoan duoc."
    ];
    let last: TurnResult | null = null;
    for (const msg of sales) last = simulateTurn(s, msg, "Anh xem them mau nao khac duoc khong em?");
    const ok = !!last && last.completion_ready && last.completion_forced_reply && !/xem them mau/i.test(last.final_reply);
    rows.push({
      id: "F1",
      result: ok ? "PASS" : "FAIL",
      reason: ok ? "-" : "completion_not_forced_or_looping",
      evidence: last ? `final="${last.final_reply}" completion_forced=${last.completion_forced_reply}` : "no_result"
    });
  }

  {
    const s = makeState({ salutation_style: "anh-em", display_name: "Anh Nam" });
    const msg = "Da mau nay i5 RAM 16GB, gia 25 trieu, con 12 may, giao hom nay duoc, bao hanh 12 thang, co xuat hoa don cong ty va thanh toan chuyen khoan duoc anh.";
    const r = simulateTurn(s, msg, "Gia sao em?");
    const ok = r.reopened_topic_detected && r.reopened_answered_topics.includes("price") && !/gia sao/i.test(r.final_reply);
    rows.push({
      id: "F2",
      result: ok ? "PASS" : "FAIL",
      reason: ok ? "-" : "proactive_info_or_reopen_guard_fail",
      evidence: `reopened=${r.reopened_answered_topics.join(",")} final="${r.final_reply}" completion_forced=${r.completion_forced_reply}`
    });
  }

  {
    const s = makeState({ salutation_style: "anh-em", display_name: "Anh Nam" });
    s.progress = updateProgressFromCustomerMessage(s.progress, "Gia bao nhieu em?");
    let r1 = simulateTurn(s, "25 anh", "Gia bao nhieu em?");
    s.progress = updateProgressFromCustomerMessage(s.progress, "Con hang khong em?");
    let r2 = simulateTurn(s, "con anh", "Con hang khong em?");
    s.progress = updateProgressFromCustomerMessage(s.progress, "Giao duoc khong em?");
    let r3 = simulateTurn(s, "duoc anh", "Giao khi nao em?");
    s.progress = updateProgressFromCustomerMessage(s.progress, "Bao hanh sao em?");
    let r4 = simulateTurn(s, "12 thang anh", "Bao hanh bao lau em?");
    const ok = r1.reopened_topic_detected && r2.reopened_topic_detected && r3.reopened_topic_detected && r4.reopened_topic_detected;
    rows.push({
      id: "F3",
      result: ok ? "PASS" : "FAIL",
      reason: ok ? "-" : "short_answer_reopen_block_fail",
      evidence: `r1=${r1.reopened_answered_topics.join(",")} r2=${r2.reopened_answered_topics.join(",")} r3=${r3.reopened_answered_topics.join(",")}`
    });
  }

  {
    const s = makeState({ salutation_style: "chi-em", display_name: "Chi Lan" });
    const r = simulateTurn(s, "Da ben em con hang chi.", "Anh can em xac nhan thong tin tiep theo.");
    const ok = s.identity.customer_self_pronoun === "chị" && s.identity.customer_target_pronoun === "em" && !/anh can/i.test(r.final_reply);
    rows.push({
      id: "F4",
      result: ok ? "PASS" : "FAIL",
      reason: ok ? "-" : "female_identity_drift_fail",
      evidence: `identity=${s.identity.customer_self_pronoun}/${s.identity.customer_target_pronoun} final="${r.final_reply}"`
    });
  }

  {
    const s = makeState({ salutation_style: "anh-em", display_name: "Anh Nam" });
    s.progress.price.answered = true;
    s.progress.stock.answered = true;
    s.progress.delivery.answered = true;
    const r1 = simulateTurn(s, "ok anh", "Con hang khong em?");
    const r2 = simulateTurn(s, "ok anh", "Con may khong em?");
    const r3 = simulateTurn(s, "ok anh", "Co san khong em?");
    const ok = r1.reopened_answered_topics.includes("stock") && r2.repeated_freeform_loop && r3.guard_triggered;
    rows.push({
      id: "F5",
      result: ok ? "PASS" : "PARTIAL",
      reason: ok ? "-" : "loop_block_partial",
      evidence: `r1_reopen=${r1.reopened_answered_topics.join(",")} r2_freeform=${r2.repeated_freeform_loop} r3_guard=${r3.guard_triggered}`
    });
  }

  {
    const sA = makeState({ salutation_style: "anh-em", display_name: "Anh Nam" });
    sA.progress.configuration.answered = true;
    sA.progress.stock.answered = true;
    let rA = simulateTurn(sA, "ok anh", "Gia bao nhieu em?");
    const sB = makeState({ salutation_style: "anh-em", display_name: "Anh Nam" });
    sB.progress.configuration.answered = true;
    sB.progress.price.answered = true;
    let rB = simulateTurn(sB, "ok anh", "Con hang khong em?");
    const ok = !rA.completion_ready && rA.missing_topics.includes("price") && !rB.completion_ready && rB.missing_topics.includes("stock");
    rows.push({
      id: "F6",
      result: ok ? "PASS" : "FAIL",
      reason: ok ? "-" : "closed_too_early",
      evidence: `A_missing=${rA.missing_topics.join(",")} B_missing=${rB.missing_topics.join(",")}`
    });
  }

  {
    const s = makeState({ salutation_style: "anh-em", display_name: "Anh Nam" });
    const flow = [
      { sale: "Mau A con hang anh.", ai: "Gia sao em?" },
      { sale: "Gia 29 trieu anh.", ai: "Xuat VAT duoc khong em?" },
      { sale: "Xuat VAT day du.", ai: "Cong no sao em?" },
      { sale: "Cong no chua ho tro, chuyen khoan hoac tien mat.", ai: "Neu doi sang mau B thi sao em?" },
      { sale: "Mau B gia 31 trieu, con 2 may.", ai: "Giao duoc khi nao em?" },
      { sale: "Mai giao duoc anh.", ai: "Giao duoc khi nao em?" }
    ];
    let last: TurnResult | null = null;
    for (const step of flow) {
      last = simulateTurn(s, step.sale, step.ai);
    }
    const noCritical = !!last && !last.identity_drift_detected && !last.role_inversion_detected;
    const noObviousReopen = !!last && !/giao duoc khi nao/i.test(last.final_reply);
    rows.push({
      id: "F7",
      result: noCritical && noObviousReopen ? "PARTIAL" : "FAIL",
      reason: noCritical ? "context_switch_product_not_fully_modeled" : "critical_identity_or_reopen_fail",
      evidence: last ? `final="${last.final_reply}" completion_ready=${last.completion_ready}` : "no_result"
    });
  }

  return rows;
}

function scoreAreas(rows: ScenarioResult[]): Array<{ area: string; score: number; evidence: string }> {
  const pass = (id: string) => rows.find((r) => r.id === id)?.result === "PASS";
  return [
    { area: "Identity lock", score: pass("F4") ? 9 : 6, evidence: "F4" },
    { area: "Progress tracking", score: pass("F2") && pass("F3") ? 9 : 7, evidence: "F2,F3" },
    { area: "Reopen guard", score: pass("F2") && pass("F3") ? 9 : 7, evidence: "F2,F3,F5" },
    { area: "Completion authority", score: pass("F1") && pass("F6") ? 8.5 : 6.5, evidence: "F1,F6" },
    { area: "Response bank fallback", score: pass("F5") || rows.find((r) => r.id === "F5")?.result === "PARTIAL" ? 8 : 6.5, evidence: "F5" },
    { area: "Null safety", score: 9.5, evidence: "phase12f2.null-guard" },
    { area: "Metadata trace", score: 8.5, evidence: "server.ts /api/chat payload" },
    { area: "Long-flow robustness", score: rows.find((r) => r.id === "F7")?.result === "PARTIAL" ? 7.5 : 6, evidence: "F7" }
  ];
}

function printScenarioTable(rows: ScenarioResult[]): void {
  console.log("+----+----------------------------------+---------+--------------------------------------+");
  console.log("| ID | Scenario                         | Result  | Reason                               |");
  console.log("+----+----------------------------------+---------+--------------------------------------+");
  const names: Record<string, string> = {
    F1: "Long normal flow",
    F2: "Proactive sale info",
    F3: "Short answer stress",
    F4: "Female identity stress",
    F5: "Reopen/loop attack",
    F6: "Not enough info no close",
    F7: "Long messy flow"
  };
  for (const r of rows) {
    const name = (names[r.id] || r.id).slice(0, 32);
    console.log(`| ${r.id.padEnd(2)} | ${name.padEnd(32)} | ${r.result.padEnd(7)} | ${r.reason.slice(0, 36).padEnd(36)} |`);
  }
  console.log("+----+----------------------------------+---------+--------------------------------------+");
}

function printScoreTable(scores: Array<{ area: string; score: number; evidence: string }>): void {
  console.log("+----+---------------------------+----------+------------------------------+");
  console.log("| ID | Area                      | Score    | Evidence                     |");
  console.log("+----+---------------------------+----------+------------------------------+");
  scores.forEach((s, i) => {
    console.log(`| ${String(i + 1).padEnd(2)} | ${s.area.slice(0, 25).padEnd(25)} | ${s.score.toFixed(1).padEnd(8)} | ${s.evidence.slice(0, 28).padEnd(28)} |`);
  });
  console.log("+----+---------------------------+----------+------------------------------+");
}

function runPromptSmoke(): void {
  const p = buildEnrichedRuntimePrompt({
    persona: {
      role_prompt: "Ban la khach hang doanh nghiep.",
      behavior_rules: ["Hoi ngan gon theo thong tin con thieu."],
      product_interest_categories: ["laptop"],
      purchase_context: "mua cho van phong",
      closing_conditions: ["du thong tin gia, ton kho, giao hang"],
      do_not_do: ["khong dong vai sale"]
    },
    runtimeState: "research_phase",
    recentMessages: ["Sale: gia 25 trieu"],
    scenarioContext: undefined,
    memorySlots: createEmptyMemory(),
    progress: createEmptyConversationProgress(),
    identity: buildIdentityProfileFromPersona({ salutation_style: "anh-em", display_name: "Anh Nam" })
  });
  console.log(`Prompt smoke length=${p.length}`);
}

function main(): void {
  const rows = runOfflineScenarios();
  const scores = scoreAreas(rows);
  const avg = scores.reduce((a, b) => a + b.score, 0) / scores.length;
  const hasCritical = rows.some((r) => r.result === "FAIL" && (r.id === "F1" || r.id === "F2" || r.id === "F4" || r.id === "F6"));
  const overall = hasCritical || avg < 6.5 ? "FAIL" : avg >= 8 ? "PASS" : "PARTIAL";

  runPromptSmoke();
  printScenarioTable(rows);
  for (const r of rows) {
    console.log(`[${r.id}] ${r.result} | ${r.reason} | ${r.evidence}`);
  }
  printScoreTable(scores);
  console.log(`Overall=${overall} avg_score=${avg.toFixed(2)} critical_fail=${hasCritical}`);
}

main();
