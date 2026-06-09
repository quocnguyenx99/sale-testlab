import assert from "node:assert/strict";
import { detectIdentityDrift, repairPronounDrift, ConversationIdentityProfile } from "./conversationIdentity";
import { isActualStockLeak, applySafetyGuards } from "./safetyGuards";
import { createEmptyMemory, ConversationMemorySlots } from "./conversationMemory";

function runTests() {
  console.log("=== STARTING PHASE 12H.1-T BEHAVIOR SCORING REGRESSION TESTS ===");

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

  // Test 1: Sửa đổi danh xưng cục bộ (Minimal Pronoun Repair) hoạt động đúng
  console.log("Test 1: Sửa đại từ tự xưng sai lệch từ 'anh' -> 'chị' cho Nữ...");
  const replyFemaleDrift = "Anh đang cần tìm laptop văn phòng i5 tầm trung.";
  const repairedFemale = repairPronounDrift(replyFemaleDrift, femaleIdentity);
  console.log(`   Original: "${replyFemaleDrift}"`);
  console.log(`   Repaired: "${repairedFemale}"`);
  assert.equal(repairedFemale.includes("Chị đang"), true, "Should repair 'Anh' -> 'Chị' at start of sentence");
  assert.equal(repairedFemale.includes("Anh"), false, "Should not leave wrong pronoun 'Anh'");

  console.log("Test 1.1: Sửa đại từ tự xưng sai lệch từ 'chị' -> 'anh' cho Nam...");
  const replyMaleDrift = "Chị muốn hỏi giá sỉ dòng ThinkPad này nhé.";
  const repairedMale = repairPronounDrift(replyMaleDrift, maleIdentity);
  console.log(`   Original: "${replyMaleDrift}"`);
  console.log(`   Repaired: "${repairedMale}"`);
  assert.equal(repairedMale.includes("Anh muốn"), true, "Should repair 'Chị' -> 'Anh'");
  assert.equal(repairedMale.includes("Chị"), false, "Should not leave wrong pronoun 'Chị'");

  // Test 2: Bảo vệ từ ghép tiếng Việt không bị sửa lỗi
  console.log("Test 2: Kiểm tra bảo vệ từ ghép tiếng Việt (tiếng Anh, chi tiết, Tuấn Anh, địa chỉ)...");
  const compoundText = "Em gửi anh chi tiết cấu hình và địa chỉ shop nhé. Bạn anh tên là Tuấn Anh rất giỏi tiếng Anh.";
  const repairedCompound = repairPronounDrift(compoundText, femaleIdentity);
  console.log(`   Original: "${compoundText}"`);
  console.log(`   Repaired: "${repairedCompound}"`);
  // expectedSelf là "chị", nên "anh" độc lập đổi thành "chị", nhưng các từ ghép phải được giữ nguyên
  assert.equal(repairedCompound.includes("chi tiết"), true, "'chi tiết' must not be corrupted");
  assert.equal(repairedCompound.includes("địa chỉ"), true, "'địa chỉ' must not be corrupted");
  assert.equal(repairedCompound.includes("Tuấn Anh"), true, "'Tuấn Anh' must not be corrupted");
  assert.equal(repairedCompound.includes("tiếng Anh"), true, "'tiếng Anh' must not be corrupted");
  assert.equal(repairedCompound.includes("gửi chị"), true, "'gửi anh' should become 'gửi chị'");

  // Test 3: detectIdentityDrift phân loại is_recoverable chính xác
  console.log("Test 3: Drift tự xưng nhẹ là recoverable...");
  const driftResult1 = detectIdentityDrift("Anh muốn hỏi mẫu này", femaleIdentity);
  assert.equal(driftResult1.identity_drift_detected, true, "Drift should be detected");
  assert.equal(driftResult1.is_recoverable, true, "Drift should be recoverable");

  console.log("Test 3.1: Đóng vai Sale tư vấn (Role Inversion) là unrecoverable...");
  const driftResult2 = detectIdentityDrift("để em tư vấn cho chị mẫu i5 nhé", femaleIdentity);
  assert.equal(driftResult2.identity_drift_detected, true, "Drift should be detected");
  assert.equal(driftResult2.is_recoverable, false, "Role inversion must NOT be recoverable");

  // Test 4: Chốt chặn an toàn không so khớp cứng
  console.log("Test 4: Stock Leak Blocker mềm...");
  // "2-3 mẫu" không phải là stock leak
  assert.equal(isActualStockLeak("em gửi anh 2-3 mẫu phù hợp để anh so sánh nhé", "2"), false);
  // "còn 2 cái" là stock leak nếu Sale chưa nói trước
  assert.equal(isActualStockLeak("mẫu này còn 2 cái đúng không em?", "2"), true);

  console.log("Test 4.1: Ambiguous Model Guard...");
  const emptyMemory = createEmptyMemory(); // product_context_status = "unknown"
  const gatedReply = "Mẫu này giá bao nhiêu vậy em?";
  const guardsResult = applySafetyGuards(gatedReply, emptyMemory, femaleIdentity, "Dạ em chào chị", []);
  assert.equal(guardsResult.guardTriggered, true, "Should trigger guard when product is unknown and reply contains gated terms");
  assert.equal(guardsResult.ambiguous_model_guard_triggered, true);
  assert.equal(guardsResult.reply.includes("chưa chốt model cụ thể"), true, "Should return dynamic clarify reply");

  // Test 5: Tiêu chí chấm điểm hành vi (Behavior Scoring Criteria)
  console.log("Test 5: Xác thực các tiêu chí hành vi động của phản hồi...");
  const validateBehavior = (reply: string, identity: ConversationIdentityProfile, memory: ConversationMemorySlots) => {
    const drift = detectIdentityDrift(reply, identity);
    const hasLeak = memory.product_candidates_summary ? memory.product_candidates_summary.some(c => isActualStockLeak(reply, String(c.stock_qty))) : false;
    
    return {
      identity_correct: !drift.identity_drift_detected,
      no_stock_leak: !hasLeak,
      is_natural: !reply.includes("deterministic_fallback") && reply.length > 5
    };
  };

  const memWithCandidates = {
    ...emptyMemory,
    product_candidates_summary: [
      { model_code: "HP-Z2", display_name: "HP Z2 G9", brand: "HP", price_si: 15000000, price_le: 18000000, stock_qty: 650, stock_status: "in_stock" as const }
    ]
  };

  const score1 = validateBehavior("Chị đang cần cấu hình chi tiết của HP Z2", femaleIdentity, memWithCandidates);
  assert.equal(score1.identity_correct, true);
  assert.equal(score1.no_stock_leak, true);
  assert.equal(score1.is_natural, true);

  console.log("=== ALL PHASE 12H.1-T BEHAVIOR SCORING REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
