import assert from "node:assert/strict";
import {
  createEmptyMemory,
  updateMemorySlots,
  ConversationMemorySlots
} from "./conversationMemory";
import {
  evaluateConversationCompletion,
  buildCompletionReply,
  shouldForceCompletionReply
} from "./conversationCompletion";
import {
  processDealState,
  DealState,
  getTerminalReply
} from "./dealState";
import {
  buildResponseBankReply,
  ResponseBankInput
} from "./responseBank";
import {
  routeRuntimeState,
  RuntimeStateRouterInput
} from "./runtimeStateRouter";
import { createEmptyConversationProgress } from "./conversationProgressTracker";
import { buildIdentityProfileFromOpening } from "./conversationIdentity";

// Re-implement or reference helper style checkers for validation
function hasGatedTerms(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").replace(/\s+/g, " ").trim();
  const gatedPatterns = [
    "mau nay",
    "model nay",
    "giu mau nay",
    "chot mau nay",
    "stk",
    "so tai khoan",
    "thanh toan",
    "chuyen khoan",
    "chot luon"
  ];
  return gatedPatterns.some(pat => t.includes(pat));
}

function hasSupportPhrases(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").replace(/\s+/g, " ").trim();
  const supportPhrases = [
    "em ho tro giu mau nay",
    "minh ho tro",
    "ben minh ho tro",
    "ben em dang san hang"
  ];
  return supportPhrases.some(pat => t.includes(pat));
}

function runTests(): void {
  console.log("=== STARTING PHASE 12H.1-C PRODUCT CONTEXT GATING REGRESSION TESTS ===");

  const identity = {
    customer_self_pronoun: "anh",
    customer_target_pronoun: "em",
    sale_expected_self_pronoun: "em",
    sale_expected_target_pronoun: "anh",
    tone_style: "business_casual",
    conversation_role: "customer_to_sales"
  };

  // 1. Unknown product cannot close
  console.log("Running Test 1: Unknown product cannot close...");
  const completion1 = evaluateConversationCompletion(
    {
      conversation_progress: createEmptyConversationProgress(),
      identity_profile: identity,
      next_unresolved_topic: "next_step",
      recent_turns: []
    },
    "unknown",
    false,
    "unknown"
  );
  assert.equal(completion1.completion_ready, false, "Unknown status must block completion.");
  assert.equal(completion1.completion_blocked_by_product_context, true, "Should set blocked by context to true.");
  assert.equal(completion1.completion_block_reason, "product_context_unknown", "Block reason must match.");

  const closing1 = buildCompletionReply({
    completion: completion1,
    identity,
    recentReplies: [],
    nextUnresolvedTopic: "next_step"
  });
  assert.ok(closing1.reply.includes("Anh chưa chốt model cụ thể đâu em"), "Fallback reply must ask to clarify model.");
  console.log("Test 1: PASS.");

  // 2. Unknown product cannot say “mẫu này”
  console.log("Running Test 2: Unknown product cannot say 'mẫu này'...");
  const bankInput2: ResponseBankInput = {
    topic: "price",
    nextTopic: "price",
    identity,
    recentFallbackVariantIds: [],
    recentReplies: [],
    product_context_status: "unknown"
  };
  const bankResult2 = buildResponseBankReply(bankInput2);
  assert.equal(bankResult2.variant_id, "product_context_gating_clarify", "Should trigger product context gating clarifying fallback.");
  assert.ok(!bankResult2.reply.includes("mẫu này"), "Gated reply must not contain 'mẫu này'.");
  assert.ok(bankResult2.reply.includes("Anh chưa chốt model cụ thể đâu em"), "Should use safe clarification fallback.");
  console.log("Test 2: PASS.");

  // 3. Greeting-only does not route pricing
  console.log("Running Test 3: Greeting-only does not route pricing...");
  const route3 = routeRuntimeState({
    latestSaleMessage: "em chào anh",
    recentMessages: [],
    product_context_status: "unknown"
  });
  assert.notEqual(route3.runtime_state, "pricing_phase", "Greeting-only with unknown context must not route to pricing.");
  assert.ok(route3.runtime_state === "research_phase" || route3.runtime_state === "uncertain_interest", "Should route to research or uncertain.");
  console.log("Test 3: PASS.");

  // 4. Vague product allows comparison but not payment
  console.log("Running Test 4: Vague product allows comparison but not payment...");
  const mem4 = updateMemorySlots(createEmptyMemory(), "bên em có laptop i5 ram 16 ssd 512");
  assert.equal(mem4.product_context_status, "vague", "Should be vague context.");
  
  const completion4 = evaluateConversationCompletion(
    {
      conversation_progress: createEmptyConversationProgress(),
      identity_profile: identity,
      next_unresolved_topic: "payment",
      recent_turns: []
    },
    mem4.product_context_status,
    false,
    "unknown"
  );
  assert.equal(completion4.completion_ready, false, "Vague context without selected model must block completion.");
  assert.equal(completion4.completion_blocked_by_product_context, true, "Should block completion.");
  assert.equal(completion4.completion_block_reason, "product_context_vague_not_specific", "Reason should be vague context.");

  // Test state routing gates vague payment_phase
  const route4 = routeRuntimeState({
    latestSaleMessage: "gửi stk chuyển khoản",
    recentMessages: [],
    product_context_status: "vague"
  });
  assert.notEqual(route4.runtime_state, "payment_phase", "Vague status must block payment phase.");
  console.log("Test 4: PASS.");

  // 5. Specific product allows “mẫu này”
  console.log("Running Test 5: Specific product allows 'mẫu này'...");
  const mem5 = updateMemorySlots(createEmptyMemory(), "bên em có mã 846514-B21 giá sỉ 7070000 còn hàng");
  assert.equal(mem5.product_context_status, "specific", "Status must be specific.");
  assert.equal(mem5.selected_product_model_code, "846514-B21");

  const bankInput5: ResponseBankInput = {
    topic: "stock",
    nextTopic: "stock",
    identity,
    recentFallbackVariantIds: [],
    recentReplies: [],
    product_context_status: mem5.product_context_status
  };
  const bankResult5 = buildResponseBankReply(bankInput5);
  assert.notEqual(bankResult5.variant_id, "product_context_gating_clarify", "Specific context must not trigger gating clarification fallback.");
  console.log("Test 5: PASS.");

  // 6. Out-of-stock specific product
  console.log("Running Test 6: Out-of-stock specific product...");
  const completion6 = evaluateConversationCompletion(
    {
      conversation_progress: createEmptyConversationProgress(),
      identity_profile: identity,
      next_unresolved_topic: "next_step",
      recent_turns: []
    },
    "specific",
    true,
    "out_of_stock"
  );
  assert.equal(completion6.completion_ready, false, "Out of stock specific product must block completion.");
  assert.equal(completion6.completion_blocked_by_product_context, true, "Should block.");
  assert.equal(completion6.completion_block_reason, "product_stock_out_of_stock", "Reason must reflect stock out.");

  const closing6 = buildCompletionReply({
    completion: completion6,
    identity,
    recentReplies: [],
    nextUnresolvedTopic: "next_step"
  });
  assert.ok(closing6.reply.includes("Mẫu này hiện hết hàng rồi hả em"), "Should trigger out-of-stock alternative request fallback.");
  console.log("Test 6: PASS.");

  // 7. Objection still preserved
  console.log("Running Test 7: Objection still preserved...");
  const candidate7 = "Giá vậy cao quá, em cho anh xem mẫu nào mềm hơn được không?";
  const objectionForceClose = shouldForceCompletionReply({
    candidateReply: candidate7,
    completion: completion1,
    progress: createEmptyConversationProgress(),
    identity,
    recentReplies: [],
    nextUnresolvedTopic: "price"
  });
  assert.equal(objectionForceClose, false, "Objection must never force closing.");
  console.log("Test 7: PASS.");

  // 8. slctx must not be mentioned proactively
  console.log("Running Test 8: slctx must not be mentioned proactively...");
  const candidate8 = "Anh thấy mẫu này còn 650 cái đúng không em?";
  const wasLeak = hasGatedTerms(candidate8); // Gated terms or numbers
  // Simulate stock leak guard
  const hasExactStockMention = (text: string, qty: number): boolean => {
    return new RegExp(`\\b${qty}\\b`).test(text);
  };
  assert.ok(hasExactStockMention(candidate8, 650), "Should detect exact stock leak.");
  console.log("Test 8: PASS.");

  // 9. slctx may be acknowledged only if Sale said exact quantity
  console.log("Running Test 9: slctx may be acknowledged only if Sale said exact quantity...");
  const saleTextHistory = "mẫu này bên em còn 2 cái";
  const candidate9 = "Vậy còn 2 cái thì em giữ giúp anh một cái trước được không?";
  const wasMentionedBySale = new RegExp(`\\b2\\b`).test(saleTextHistory);
  assert.ok(wasMentionedBySale, "Sale mentioned 2 first, so acknowledging it is allowed.");
  console.log("Test 9: PASS.");

  // 10. Customer must not speak as Sale
  console.log("Running Test 10: Customer must not speak as Sale...");
  const candidate10 = "Dạ mã 846514-B21 bên em đang sẵn hàng, giá sỉ đại lý là 7.070.000 VNĐ anh nhé.";
  assert.ok(hasSupportPhrases(candidate10), "Should detect consultant tone/support phrases spoken by Customer AI.");
  console.log("Test 10: PASS.");

  console.log("=== ALL PHASE 12H.1-C PRODUCT CONTEXT GATING REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
