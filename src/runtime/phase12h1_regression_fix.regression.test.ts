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
  buildResponseBankReply,
  ResponseBankInput
} from "./responseBank";
import {
  createEmptyConversationProgress,
  TOPIC_ORDER,
  getFirstUnresolvedTopic,
  updateProgressFromSaleMessage
} from "./conversationProgressTracker";
import { buildEnrichedRuntimePrompt } from "./runtimePromptBuilder";

function isDirectQuestion(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").replace(/\s+/g, " ").trim();
  return text.includes("?") || /\b(nao|gi|khong|chua|may)\b/.test(t);
}

function runTests(): void {
  console.log("=== STARTING PHASE 12H.1-R REGRESSION TESTS ===");

  const identityFemale = {
    customer_self_pronoun: "chị",
    customer_target_pronoun: "em",
    sale_expected_self_pronoun: "em",
    sale_expected_target_pronoun: "chị",
    tone_style: "business_casual",
    conversation_role: "customer_to_sales"
  };

  const identityMale = {
    customer_self_pronoun: "anh",
    customer_target_pronoun: "em",
    sale_expected_self_pronoun: "em",
    sale_expected_target_pronoun: "anh",
    tone_style: "business_casual",
    conversation_role: "customer_to_sales"
  };

  // ==========================================
  // Test 1: Female Identity Fallback
  // ==========================================
  console.log("Running Test 1: Female identity fallback...");
  const completion1 = evaluateConversationCompletion(
    {
      conversation_progress: createEmptyConversationProgress(),
      identity_profile: identityFemale,
      next_unresolved_topic: "product_model",
      recent_turns: []
    },
    "unknown",
    false,
    "unknown"
  );

  const closing1 = buildCompletionReply({
    completion: completion1,
    identity: identityFemale,
    recentReplies: [],
    nextUnresolvedTopic: "product_model"
  });

  assert.ok(closing1.reply.includes("Chị chưa chốt model cụ thể đâu em"), "Fallback reply must use 'Chị' for female identity.");
  assert.ok(!closing1.reply.includes("Anh chưa chốt model cụ thể"), "Fallback reply must not drift to 'Anh'.");
  console.log("Test 1: PASS.");

  // ==========================================
  // Test 2: No Price Quoted Gating
  // ==========================================
  console.log("Running Test 2: No price quoted gating...");
  const bankInput2: ResponseBankInput = {
    topic: "price",
    nextTopic: "price",
    identity: identityFemale,
    recentFallbackVariantIds: ["price_1", "price_2"],
    recentReplies: [],
    product_context_status: "specific",
    is_price_quoted: false
  };

  const bankResult2 = buildResponseBankReply(bankInput2);
  assert.equal(bankResult2.variant_id, "product_context_gating_price_request", "Should trigger price request fallback when no price is quoted.");
  assert.ok(!bankResult2.reply.includes("Giá này"), "Reply must not refer to 'Giá này' if price was not quoted.");
  assert.ok(bankResult2.reply.includes("Chị chưa thấy em báo giá cụ thể nên chưa so sánh được"), "Should ask for quote using correct female pronouns.");
  console.log("Test 2: PASS.");

  // ==========================================
  // Test 3: Real Price Quoted Allowed
  // ==========================================
  console.log("Running Test 3: Real price quoted allowed...");
  const bankInput3: ResponseBankInput = {
    topic: "price",
    nextTopic: "price",
    identity: identityFemale,
    recentFallbackVariantIds: [],
    recentReplies: [],
    product_context_status: "specific",
    is_price_quoted: true
  };

  const bankResult3 = buildResponseBankReply(bankInput3);
  assert.notEqual(bankResult3.variant_id, "product_context_gating_price_request", "Price negotiation variants should be allowed if price is quoted.");
  console.log("Test 3: PASS.");

  // ==========================================
  // Test 4: TOPIC_ORDER Chronology
  // ==========================================
  console.log("Running Test 4: TOPIC_ORDER chronology...");
  const progress4 = createEmptyConversationProgress();
  // Ensure product_model and configuration are before price and delivery
  const idxModel = TOPIC_ORDER.indexOf("product_model");
  const idxConfig = TOPIC_ORDER.indexOf("configuration");
  const idxPrice = TOPIC_ORDER.indexOf("price");
  const idxDelivery = TOPIC_ORDER.indexOf("delivery");

  assert.ok(idxModel < idxPrice, "product_model must come before price");
  assert.ok(idxConfig < idxPrice, "configuration must come before price");
  assert.ok(idxPrice < idxDelivery, "price must come before delivery");

  const unresolved = getFirstUnresolvedTopic(progress4);
  assert.equal(unresolved, "product_model", "First unresolved topic must be product_model on empty progress.");
  console.log("Test 4: PASS.");

  // ==========================================
  // Test 5: Direct Question Softening Check
  // ==========================================
  console.log("Running Test 5: Direct question detection...");
  assert.equal(isDirectQuestion("chị quan tâm dòng sản phẩm nào?"), true, "Should identify direct question with 'nào'");
  assert.equal(isDirectQuestion("anh cần model nào?"), true, "Should identify direct question");
  assert.equal(isDirectQuestion("anh cần cấu hình nào?"), true, "Should identify direct question");
  assert.equal(isDirectQuestion("anh dùng cho nhu cầu gì?"), true, "Should identify direct question with 'gì'");
  assert.equal(isDirectQuestion("bên em báo giá cho anh chưa?"), true, "Should identify direct question with 'chưa'");
  assert.equal(isDirectQuestion("giá này sỉ tốt không em"), true, "Should identify direct question with 'không'");
  console.log("Test 5: PASS.");

  // ==========================================
  // Test 6: Sale Promised Quote
  // ==========================================
  console.log("Running Test 6: Sale promised quote...");
  let progress6 = createEmptyConversationProgress();
  progress6 = updateProgressFromSaleMessage(progress6, "để em báo giá model hp z2 tower g9");
  
  // Verify that price is NOT marked answered since no real price numeric is in the message
  assert.equal(progress6.price.answered, false, "Price should not be resolved by simple promise.");
  
  const unresolved6 = getFirstUnresolvedTopic(progress6);
  assert.notEqual(unresolved6, "delivery", "Next unresolved topic should not jump to delivery when price/model/config are unresolved.");
  assert.ok(unresolved6 === "product_model" || unresolved6 === "configuration" || unresolved6 === "price", "Should resolve model/config/price first.");
  console.log("Test 6: PASS.");

  // ==========================================
  // Test 7: Candidate Over-listing Instruction Preserved
  // ==========================================
  console.log("Running Test 7: Candidate over-listing instruction in prompt builder...");
  const memory7: ConversationMemorySlots = {
    ...createEmptyMemory(),
    product_context_status: "vague",
    product_candidates_summary: [
      { model_code: "HP-Z2", display_name: "HP Z2 Workstation", brand: "HP", price_si: 12000000, price_le: 14000000, stock_status: "in_stock", stock_qty: 5 }
    ]
  };

  const prompt7 = buildEnrichedRuntimePrompt({
    persona: {
      role_prompt: "Vai khach hang",
      behavior_rules: [],
      product_interest_categories: ["HP Workstation"],
      purchase_context: "Render 3D",
      closing_conditions: [],
      do_not_do: []
    },
    runtimeState: "research_phase",
    recentMessages: [],
    memorySlots: memory7,
    progress: createEmptyConversationProgress(),
    identity: identityFemale
  });

  assert.ok(prompt7.includes("QUY TẮC LIỆT KÊ SẢN PHẨM KHẢ DỤNG"), "Prompt should contain Rule 3 for candidates listing.");
  assert.ok(prompt7.includes("TUYỆT ĐỐI KHÔNG sao chép nguyên văn hoặc liệt kê một danh sách dài"), "Prompt must instruct AI to avoid copying list.");
  console.log("Test 7: PASS.");

  // ==========================================
  // Test 8: Existing Product Context Gating Preserved
  // ==========================================
  console.log("Running Test 8: Existing product context gating preserved...");
  const completion8 = evaluateConversationCompletion(
    {
      conversation_progress: createEmptyConversationProgress(),
      identity_profile: identityMale,
      next_unresolved_topic: "payment",
      recent_turns: []
    },
    "unknown",
    false,
    "unknown"
  );
  assert.equal(completion8.completion_ready, false, "Unknown product context must block completion.");
  assert.equal(completion8.completion_blocked_by_product_context, true, "Should set blocked by context to true.");
  console.log("Test 8: PASS.");

  console.log("=== ALL PHASE 12H.1-R REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
