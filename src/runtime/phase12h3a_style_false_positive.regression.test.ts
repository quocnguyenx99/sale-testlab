import assert from "node:assert/strict";
import { analyzeBuyerVoiceStyle, ConversationIdentityProfile } from "./conversationIdentity";
import { createEmptyConversationProgress } from "./conversationProgressTracker";
import { detectReopenedAnsweredTopics } from "./conversationCompletion";
import { applySafetyGuards } from "./safetyGuards";
import { createEmptyMemory, updateMemorySlots } from "./conversationMemory";
import { detectRepeatedFreeFormLoop } from "./repetitionGuard";

const maleIdentity: ConversationIdentityProfile = {
  customer_self_pronoun: "anh",
  customer_target_pronoun: "em",
  sale_expected_self_pronoun: "em",
  sale_expected_target_pronoun: "anh",
  tone_style: "business_casual",
  conversation_role: "customer_to_sales"
};

const femaleIdentity: ConversationIdentityProfile = {
  customer_self_pronoun: "chị",
  customer_target_pronoun: "em",
  sale_expected_self_pronoun: "em",
  sale_expected_target_pronoun: "chị",
  tone_style: "business_casual",
  conversation_role: "customer_to_sales"
};

function runTests(): void {
  console.log("=== STARTING PHASE 12H.3-A.1 STYLE FALSE POSITIVE REGRESSION TESTS ===");

  console.log("Test 1: A4 raw acceptable passes through reopen detector...");
  const progressA4 = createEmptyConversationProgress();
  progressA4.stock.answered = true;
  const reopenedA4 = detectReopenedAnsweredTopics(
    "Ok em, mẫu này hết hàng rồi à. Em có mẫu nào còn hàng không?",
    progressA4,
    ["mẫu này hiện hết hàng anh"]
  );
  assert.equal(reopenedA4.length, 0, "Alternative stock question must not trigger reopened topic fallback");

  console.log("Test 2: A1 buyer-side nhé is not high sale tone risk...");
  const a1Style = analyzeBuyerVoiceStyle(
    "Chị đang so sánh nhiều model, em gửi vài cái phù hợp với nhu cầu chị nhé.",
    "chị quan tâm dòng sản phẩm nào?",
    femaleIdentity
  );
  assert.notEqual(a1Style.sale_tone_risk, "high");
  assert.ok(a1Style.buyer_voice_score >= 80);

  console.log("Test 3: Valid buyer request with 'em gửi' is not support phrase...");
  const buyerRequest = analyzeBuyerVoiceStyle(
    "Em gửi anh 2-3 mẫu phù hợp nhé.",
    "bên em có vài mẫu workstation HP anh",
    maleIdentity
  );
  assert.equal(buyerRequest.support_phrase_count, 0);
  assert.notEqual(buyerRequest.sale_tone_risk, "high");

  console.log("Test 4: Valid buyer question with 'bên em' is not support phrase and not fallback...");
  const stockQuestion = analyzeBuyerVoiceStyle(
    "Bên em còn hàng không?",
    "mẫu này bên em còn 2 cái",
    maleIdentity
  );
  assert.equal(stockQuestion.support_phrase_count, 0);
  assert.notEqual(stockQuestion.sale_tone_risk, "high");

  console.log("Test 5: True sale-style phrase still scores high risk...");
  const saleStyle = analyzeBuyerVoiceStyle(
    "Bên em đang có sẵn hàng chị nhé.",
    "mẫu này còn hàng chị",
    femaleIdentity
  );
  assert.equal(saleStyle.sale_tone_risk, "high");
  assert.ok(saleStyle.support_phrase_count >= 1);

  console.log("Test 6: C4 remains soft finding only with no fallback/template...");
  const c4Memory = createEmptyMemory();
  c4Memory.product_context_status = "specific";
  c4Memory.selected_product_model = "HP Z2 Tower G9 Workstation";
  c4Memory.selected_product_model_code = "HP-Z2-G9";
  c4Memory.product_candidates_summary = [
    {
      model_code: "HP-Z2-G9",
      display_name: "HP Z2 Tower G9 Workstation",
      brand: "HP",
      price_si: 12000000,
      price_le: 14000000,
      stock_status: "in_stock",
      stock_qty: 2
    }
  ];
  const c4Reply = "Ok em, mẫu này bên em còn 2 cái. Anh cần xem giá sỉ trước nhé.";
  const c4Guards = applySafetyGuards(
    c4Reply,
    c4Memory,
    maleIdentity,
    "mẫu này bên em còn 2 cái",
    [],
    "price"
  );
  assert.equal(c4Guards.finalReplySource, "local_ai_generated");
  assert.equal(c4Guards.guardTriggered, false);
  const c4Style = analyzeBuyerVoiceStyle(c4Reply, "mẫu này bên em còn 2 cái", maleIdentity);
  assert.notEqual(c4Style.sale_tone_risk, "low");

  console.log("Test 7: C1-like raw with specific model evidence no longer triggers ambiguous fallback...");
  const c1Memory = createEmptyMemory();
  c1Memory.product_context_status = "vague";
  c1Memory.product_knowledge_used = true;
  const c1Reply = "Em gửi anh giá model laptop Dell Latitude 5440 i5-1345U và i5-1335U đi ạ. Mẫu này còn hàng không em?";
  const c1Guards = applySafetyGuards(
    c1Reply,
    c1Memory,
    femaleIdentity,
    "e có laptop i5 ram16 ssd512 ko chị",
    [],
    "product_model"
  );
  assert.notEqual(c1Guards.finalReplySource, "deterministic_fallback");
  assert.equal(c1Guards.ambiguous_model_guard_triggered, false);

  console.log("Test 8: Single similar follow-up must not trigger free-form loop fallback...");
  const singleLoop = detectRepeatedFreeFormLoop(
    "Chị đang so sánh nhiều model, em gửi vài cái phù hợp với nhu cầu chị nhé.",
    ["Chị cần tìm máy tính xách tay và màn hình phù hợp cho văn phòng, em gửi giá sỉ trước nhé."]
  );
  assert.equal(singleLoop, false);

  console.log("Test 9: Existing specific product context must persist across generic stock message...");
  const persistedMemory = createEmptyMemory();
  persistedMemory.selected_product_model = "HP Z2 Tower G9 Workstation";
  persistedMemory.selected_product_model_code = "HP-Z2-G9";
  persistedMemory.product_context_status = "specific";
  persistedMemory.product_candidates_summary = [
    {
      model_code: "HP-Z2-G9",
      display_name: "HP Z2 Tower G9 Workstation",
      brand: "HP",
      price_si: 12000000,
      price_le: 14000000,
      stock_status: "out_of_stock",
      stock_qty: 2
    }
  ];
  const afterStockMessage = updateMemorySlots(persistedMemory, "mẫu này hiện hết hàng anh");
  assert.equal(afterStockMessage.product_context_status, "specific");
  assert.equal(afterStockMessage.selected_product_model_code, "HP-Z2-G9");

  console.log("=== ALL PHASE 12H.3-A.1 STYLE FALSE POSITIVE REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
