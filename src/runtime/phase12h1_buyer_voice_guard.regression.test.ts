import assert from "node:assert/strict";
import {
  ConversationIdentityProfile,
  detectIdentityDrift,
  repairPronounDrift
} from "./conversationIdentity";
import { createEmptyMemory } from "./conversationMemory";
import { applySafetyGuards } from "./safetyGuards";

const femaleIdentity: ConversationIdentityProfile = {
  customer_self_pronoun: "chị",
  customer_target_pronoun: "em",
  sale_expected_self_pronoun: "em",
  sale_expected_target_pronoun: "chị",
  tone_style: "business_casual",
  conversation_role: "customer_to_sales"
};

const maleIdentity: ConversationIdentityProfile = {
  customer_self_pronoun: "anh",
  customer_target_pronoun: "em",
  sale_expected_self_pronoun: "em",
  sale_expected_target_pronoun: "anh",
  tone_style: "business_casual",
  conversation_role: "customer_to_sales"
};

function runTests(): void {
  console.log("=== STARTING PHASE 12H.1-U BUYER VOICE GUARD REGRESSION TESTS ===");

  console.log("Test 1: B2 exact failure is repaired without deterministic template...");
  const specificMemory = createEmptyMemory();
  specificMemory.product_context_status = "specific";
  specificMemory.selected_product_model = "HP Z2 Tower G9 Workstation";
  specificMemory.selected_product_model_code = "HP-Z2-G9";
  specificMemory.product_candidates_summary = [
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
  const b2Candidate =
    "Vâng em, mẫu này giá sỉ 12 triệu chị nhé. Em hỏi thêm được không, thời gian giao hàng khoảng bao lâu ạ?";
  const b2Guards = applySafetyGuards(
    b2Candidate,
    specificMemory,
    femaleIdentity,
    "mẫu này giá sỉ 12 triệu chị nhé",
    [],
    "product_model"
  );
  assert.equal(b2Guards.finalReplySource, "local_ai_rewritten");
  assert.equal(/\bEm hỏi\b/i.test(b2Guards.reply), false, "Must remove self-pronoun drift 'Em hỏi'");
  assert.equal(/\bchị nhé\b/i.test(b2Guards.reply), false, "Must remove sale-style ending 'chị nhé'");
  assert.equal(/model|cấu hình/i.test(b2Guards.reply), true, "Must redirect to model/config first");
  assert.equal(/giao hàng khoảng bao lâu/i.test(b2Guards.reply), false, "Delivery must not stay as main question");
  assert.equal(b2Guards.reasons.includes("buyer_voice_sale_echo_repaired"), true);
  assert.equal(b2Guards.reasons.includes("delivery_main_topic_blocked"), true);

  console.log("Test 2: Female self-pronoun drift 'Em cần' is detected and repaired...");
  const femaleNeedDrift = "Em cần cấu hình cụ thể của mẫu này.";
  const femaleNeedDetect = detectIdentityDrift(femaleNeedDrift, femaleIdentity);
  assert.equal(femaleNeedDetect.identity_drift_detected, true);
  const femaleNeedRepair = repairPronounDrift(femaleNeedDrift, femaleIdentity);
  assert.equal(femaleNeedRepair.includes("Chị cần"), true);
  assert.equal(/\bEm cần\b/.test(femaleNeedRepair), false);

  console.log("Test 3: Female self-pronoun drift 'Em muốn' is detected and repaired...");
  const femaleWantDrift = "Em muốn xem thêm cấu hình và giá.";
  const femaleWantDetect = detectIdentityDrift(femaleWantDrift, femaleIdentity);
  assert.equal(femaleWantDetect.identity_drift_detected, true);
  const femaleWantRepair = repairPronounDrift(femaleWantDrift, femaleIdentity);
  assert.equal(femaleWantRepair.includes("Chị muốn"), true);
  assert.equal(/\bEm muốn\b/.test(femaleWantRepair), false);

  console.log("Test 4: Sale echo is repaired into buyer voice...");
  const saleEchoReply = "Vâng em, mẫu này giá sỉ 12 triệu chị nhé.";
  const saleEchoGuards = applySafetyGuards(
    saleEchoReply,
    specificMemory,
    femaleIdentity,
    "mẫu này giá sỉ 12 triệu chị nhé",
    [],
    "product_model"
  );
  assert.equal(saleEchoGuards.finalReplySource, "local_ai_rewritten");
  assert.equal(/\bmẫu này giá sỉ 12 triệu chị nhé\b/i.test(saleEchoGuards.reply), false);
  assert.equal(/giá sỉ 12 triệu/i.test(saleEchoGuards.reply), true);

  console.log("Test 5: Delivery main-topic is blocked when next_unresolved_topic=product_model...");
  const deliveryOnlyReply = "Thời gian giao hàng khoảng bao lâu em?";
  const deliveryBlocked = applySafetyGuards(
    deliveryOnlyReply,
    specificMemory,
    femaleIdentity,
    "mẫu này giá sỉ 12 triệu chị nhé",
    [],
    "product_model"
  );
  assert.equal(deliveryBlocked.finalReplySource, "local_ai_rewritten");
  assert.equal(/model|cấu hình/i.test(deliveryBlocked.reply), true);
  assert.equal(deliveryBlocked.reasons.includes("delivery_main_topic_blocked"), true);

  console.log("Test 6: Delivery secondary is allowed after model/config/price are resolved...");
  const deliverySecondaryReply =
    "Chị chốt được cấu hình này rồi, em báo giúp chị mốc giao cụ thể luôn nhé.";
  const deliveryAllowed = applySafetyGuards(
    deliverySecondaryReply,
    specificMemory,
    femaleIdentity,
    "HP Z2 Tower G9 giá sỉ 12 triệu, cấu hình i7 RAM 32GB SSD 1TB chị nhé",
    [],
    "delivery"
  );
  assert.equal(deliveryAllowed.reply, deliverySecondaryReply);
  assert.equal(deliveryAllowed.guardTriggered, false);

  console.log("Test 7: Existing safety remains unchanged for ambiguous product/payment...");
  const unknownMemory = createEmptyMemory();
  const ambiguousPayment = applySafetyGuards(
    "Anh chốt luôn mẫu này, em gửi STK cho anh nhé.",
    unknownMemory,
    maleIdentity,
    "để em báo giá model HP Z2 Tower G9 cho anh",
    [],
    "product_model"
  );
  assert.equal(ambiguousPayment.finalReplySource, "deterministic_fallback");
  assert.equal(ambiguousPayment.ambiguous_model_guard_triggered, true);

  console.log("=== ALL PHASE 12H.1-U BUYER VOICE GUARD REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
