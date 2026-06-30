import assert from "node:assert/strict";
import {
  ConversationIdentityProfile,
  detectBuyerRoleViolation,
  detectIdentityDrift,
  repairBuyerRoleViolation,
  runCustomerVoiceGuard
} from "./conversationIdentity";
import { createEmptyMemory } from "./conversationMemory";
import { buildResponseBankReply } from "./responseBank";
import { applySafetyGuards } from "./safetyGuards";

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
  console.log("=== STARTING PHASE 12H.3-B SALUTATION / BUYER ROLE LOCK REGRESSION TESTS ===");

  console.log("Test 1: Seller/support-like phrase is detected and repaired...");
  const supportLikeReply = "Em sẽ hỗ trợ anh kiểm tra sản phẩm bên em rồi báo lại anh nhé.";
  const supportViolation = detectBuyerRoleViolation(supportLikeReply, maleIdentity);
  assert.equal(supportViolation.violated, true);
  const repairedSupport = repairBuyerRoleViolation(supportLikeReply, maleIdentity);
  assert.equal(/hỗ trợ|sản phẩm bên em/i.test(repairedSupport), false);
  assert.equal(detectBuyerRoleViolation(repairedSupport, maleIdentity).violated, false);

  console.log("Test 2: Buyer-safe phrase with 'em' remains allowed...");
  const buyerSafeReply = "Anh muốn xem thêm, em gửi anh cấu hình nhé.";
  assert.equal(detectBuyerRoleViolation(buyerSafeReply, maleIdentity).violated, false);
  assert.equal(runCustomerVoiceGuard(buyerSafeReply, maleIdentity).customer_voice_drift_detected, false);
  assert.equal(detectIdentityDrift(buyerSafeReply, maleIdentity).identity_drift_detected, false);

  console.log("Test 3: Response bank fallback stays buyer-side and salutation-safe...");
  const bankReply = buildResponseBankReply({
    topic: "next_step",
    nextTopic: "next_step",
    identity: femaleIdentity,
    recentFallbackVariantIds: [],
    recentReplies: [],
    persona: {
      buyer_role: "Đại lý / reseller",
      purchase_context: "Đang cân đối đơn bán lại",
      behavior_rules: ["Muốn giá sỉ rõ ràng"]
    },
    product_context_status: "specific",
    is_price_quoted: true
  });
  assert.equal(detectBuyerRoleViolation(bankReply.reply, femaleIdentity).violated, false);
  assert.equal(detectIdentityDrift(bankReply.reply, femaleIdentity).identity_drift_detected, false);
  assert.equal(/chị nhé/i.test(bankReply.reply), false);

  console.log("Test 4: Safety guard repair remains buyer-side...");
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
  const saleEchoReply = "Vâng em, mẫu này giá sỉ 12 triệu chị nhé.";
  const saleEchoGuards = applySafetyGuards(
    saleEchoReply,
    specificMemory,
    femaleIdentity,
    "mẫu này giá sỉ 12 triệu chị nhé",
    [],
    "product_model"
  );
  assert.equal(detectBuyerRoleViolation(saleEchoGuards.reply, femaleIdentity).violated, false);
  assert.equal(/chị nhé/i.test(saleEchoGuards.reply), false);

  console.log("Test 5: Stock privacy guard still blocks raw quantity leakage...");
  const stockLeakReply = "Mẫu này bên em còn 2 cái, anh lấy luôn nhé.";
  const stockLeakGuards = applySafetyGuards(
    stockLeakReply,
    specificMemory,
    maleIdentity,
    "HP Z2 Tower G9 còn hàng",
    [],
    "stock"
  );
  assert.equal(stockLeakGuards.stock_quantity_hidden_from_customer, true);
  assert.equal(stockLeakGuards.finalReplySource, "deterministic_fallback");
  assert.equal(/\b2\b/.test(stockLeakGuards.reply), false);

  console.log("=== ALL PHASE 12H.3-B SALUTATION / BUYER ROLE LOCK REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
