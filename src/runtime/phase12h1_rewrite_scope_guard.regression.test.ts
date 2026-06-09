import assert from "node:assert/strict";
import { createEmptyMemory } from "./conversationMemory";
import { ConversationIdentityProfile } from "./conversationIdentity";
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
  console.log("=== STARTING PHASE 12H.1-V REWRITE SCOPE GUARD REGRESSION TESTS ===");

  const vagueMemory = createEmptyMemory();
  vagueMemory.product_context_status = "vague";

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

  console.log("Test 1: A2-like raw acceptable reply stays untouched...");
  const a2Raw = "Vâng, anh đang cần máy render 3D tầm trung, em gửi anh 2-3 mẫu HP workstation phù hợp kèm giá sỉ để anh so sánh nhé.";
  const a2Result = applySafetyGuards(
    a2Raw,
    vagueMemory,
    maleIdentity,
    "để em báo giá model HP Z2 Tower G9 cho anh",
    [],
    "configuration"
  );
  assert.equal(a2Result.reply, a2Raw);
  assert.equal(a2Result.finalReplySource, "local_ai_generated");
  assert.deepEqual(a2Result.reasons, []);

  console.log("Test 2: C2-like raw acceptable reply stays untouched...");
  const c2Raw = "Anh đang dùng cho render 3D, cần máy có cấu hình mạnh, em gửi anh 2-3 mẫu HP workstation phù hợp kèm giá sỉ để anh so sánh nhé.";
  const c2Result = applySafetyGuards(
    c2Raw,
    vagueMemory,
    maleIdentity,
    "anh dùng máy cho nhu cầu gì, render hay văn phòng?",
    [],
    "product_model"
  );
  assert.equal(c2Result.reply, c2Raw);
  assert.equal(c2Result.finalReplySource, "local_ai_generated");
  assert.deepEqual(c2Result.reasons, []);

  console.log("Test 3: B2 severe sale-echo still gets repaired...");
  const b2Raw = "Vâng em, mẫu này giá sỉ 12 triệu chị nhé. Em hỏi thêm được không, thời gian giao hàng khoảng bao lâu ạ?";
  const b2Result = applySafetyGuards(
    b2Raw,
    specificMemory,
    femaleIdentity,
    "mẫu này giá sỉ 12 triệu chị nhé",
    [],
    "product_model"
  );
  assert.equal(b2Result.finalReplySource, "local_ai_rewritten");
  assert.equal(/chị nhé/i.test(b2Result.reply), false);
  assert.equal(/Em hỏi thêm/i.test(b2Result.reply), false);
  assert.equal(/giá sỉ 12 triệu đúng không/i.test(b2Result.reply), true);
  assert.equal(/model và cấu hình cụ thể trước/i.test(b2Result.reply), true);
  assert.equal(b2Result.reasons.includes("buyer_voice_sale_echo_repaired"), true);

  console.log("Test 4: C4 delivery redirect must not invent price...");
  const c4Raw = "Anh thấy mẫu này bên em còn 2 cái à, vậy thời gian giao hàng khoảng bao lâu ạ?";
  const c4Result = applySafetyGuards(
    c4Raw,
    specificMemory,
    maleIdentity,
    "mẫu này bên em còn 2 cái",
    [],
    "price"
  );
  assert.equal(c4Result.finalReplySource, "local_ai_rewritten");
  assert.equal(/giá sỉ 2/i.test(c4Result.reply), false);
  assert.equal(/đúng không/i.test(c4Result.reply), false);
  assert.equal(/2 cái/i.test(c4Result.reply), true);
  assert.equal(/model|cấu hình|giá/i.test(c4Result.reply), true);
  assert.equal(c4Result.reasons.includes("delivery_main_topic_blocked"), true);

  console.log("Test 5: Option counts/specs/model codes must not be parsed as price...");
  const numericRaw = "Anh đang cần 2-3 mẫu i5 RAM 16GB SSD 512GB, em gửi anh 3 option với mã 846514-B21 nhé.";
  const numericResult = applySafetyGuards(
    numericRaw,
    vagueMemory,
    maleIdentity,
    "bên em có 2 dòng máy i5 RAM 16GB SSD 512GB, mã 846514-B21",
    [],
    "configuration"
  );
  assert.equal(/giá sỉ \d+/i.test(numericResult.reply), false);
  assert.equal(numericResult.reply, numericRaw);
  assert.equal(numericResult.finalReplySource, "local_ai_generated");

  console.log("=== ALL PHASE 12H.1-V REWRITE SCOPE GUARD REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
