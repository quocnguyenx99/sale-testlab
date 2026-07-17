import assert from "node:assert/strict";
import { ConversationIdentityProfile, detectBuyerRoleViolation } from "./conversationIdentity";
import { createEmptyMemory } from "./conversationMemory";
import {
  createEmptyConversationProgress,
  ConversationProgress
} from "./conversationProgressTracker";
import { buildResponseBankReply } from "./responseBank";
import { applySafetyGuards } from "./safetyGuards";
import { shouldForceCompletionReply } from "./conversationCompletion";

const identity: ConversationIdentityProfile = {
  customer_self_pronoun: "anh",
  customer_target_pronoun: "em",
  sale_expected_self_pronoun: "em",
  sale_expected_target_pronoun: "anh",
  tone_style: "business_casual",
  conversation_role: "customer_to_sales"
};

function completedProgress(): ConversationProgress {
  const progress = createEmptyConversationProgress();
  for (const topic of ["product_model", "configuration", "price", "stock"] as const) {
    progress[topic].requested = true;
    progress[topic].answered = true;
  }
  return progress;
}

function runTests(): void {
  console.log("=== STARTING PHASE 12H.3-B FALLBACK NATURALNESS FAST-FIX TESTS ===");

  console.log("Test 1: Safe exploratory buyer reply survives vague product context...");
  const vagueMemory = createEmptyMemory();
  vagueMemory.product_context_status = "vague";
  const exploratory = "Anh đang tham khảo thêm, em gửi anh vài cấu hình phù hợp để so sánh nhé.";
  const exploratoryResult = applySafetyGuards(exploratory, vagueMemory, identity, "Bên em có vài lựa chọn", [], "configuration");
  assert.equal(exploratoryResult.reply, exploratory);
  assert.equal(exploratoryResult.finalReplySource, "local_ai_generated");

  console.log("Test 2: Ambiguous model question uses a light rewrite, not bank fallback...");
  const ambiguous = "Mẫu này giá thế nào em?";
  const ambiguousResult = applySafetyGuards(ambiguous, vagueMemory, identity, "Bên em có vài lựa chọn", [], "configuration");
  assert.equal(ambiguousResult.finalReplySource, "local_ai_rewritten");
  assert.equal(ambiguousResult.ambiguous_model_guard_triggered, true);

  console.log("Test 3: Configuration fallback is short and stays buyer-side...");
  const configFallback = buildResponseBankReply({
    topic: "configuration",
    nextTopic: "configuration",
    identity,
    recentFallbackVariantIds: [],
    recentReplies: [],
    product_context_status: "specific",
    is_price_quoted: true
  });
  assert.ok(configFallback.reply.length < 110);
  assert.equal(detectBuyerRoleViolation(configFallback.reply, identity).violated, false);

  console.log("Test 4: Completion does not force a safe buyer hesitation...");
  const progress = completedProgress();
  const hesitation = "Anh xem lại một chút rồi phản hồi em sau nhé.";
  assert.equal(shouldForceCompletionReply({
    candidateReply: hesitation,
    completion: {
      completion_ready: true,
      completion_reason: "required_topics_answered",
      missing_topics: [],
      resolved_topics: ["product_model", "configuration", "price", "stock"],
      recommended_action: "end_session",
      completion_blocked_by_product_context: false
    },
    progress,
    identity,
    recentReplies: [],
    nextUnresolvedTopic: "next_step"
  }), false);

  console.log("Test 5: Stock fallback keeps quantity private...");
  const stockFallback = buildResponseBankReply({
    topic: "stock",
    nextTopic: "stock",
    identity,
    recentFallbackVariantIds: [],
    recentReplies: [],
    product_context_status: "specific",
    is_price_quoted: true
  });
  assert.equal(/\b\d+\s*(cái|chiếc|máy|bộ)\b/i.test(stockFallback.reply), false);

  console.log("=== ALL PHASE 12H.3-B FALLBACK NATURALNESS FAST-FIX TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
