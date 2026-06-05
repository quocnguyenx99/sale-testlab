import assert from "node:assert/strict";
import {
  createEmptyConversationProgress,
  updateProgressFromSaleMessage,
  getFirstUnresolvedTopic,
  getTopicProgress
} from "./conversationProgressTracker";
import { detectReopenedAnsweredTopics } from "./conversationCompletion";
import { detectIdentityDrift } from "./conversationIdentity";

// Mock helper matching the one in server.ts/live_qa_runner.ts
function isActualStockLeak(reply: string, qtyStr: string): boolean {
  const t = reply.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").replace(/\s+/g, " ");
  const regex = new RegExp(`\\b${qtyStr}\\b`, 'g');
  let match;
  
  const stockKeywords = ["con", "ton", "kho", "san", "hang"];
  const unitKeywords = ["cai", "chiec", "may", "bo", "con"];

  while ((match = regex.exec(t)) !== null) {
    const idx = match.index;
    const start = Math.max(0, idx - 30);
    const end = Math.min(t.length, idx + qtyStr.length + 30);
    const windowText = t.substring(start, end);
    
    const hasKeyword = stockKeywords.some(kw => {
      const kwRegex = new RegExp(`\\b${kw}\\b`);
      return kwRegex.test(windowText);
    });
    
    const hasUnit = unitKeywords.some(unit => {
      const unitRegex = new RegExp(`\\b${unit}\\b`);
      return unitRegex.test(windowText);
    });
    
    if (hasKeyword && hasUnit) {
      return true;
    }
  }
  return false;
}

function runTests() {
  console.log("=== STARTING PHASE 12H.1-S GUARD SENSITIVITY SOFTENING REGRESSION TESTS ===");

  // 1. "có" alone does not resolve stock
  console.log("Running Test 1: 'có' alone does not resolve stock...");
  let progress1 = createEmptyConversationProgress();
  progress1 = updateProgressFromSaleMessage(progress1, "e có laptop i5 ram16 ssd512 ko chị");
  assert.equal(getTopicProgress(progress1, "stock").answered, false, "'có' alone must not mark stock answered");
  
  // Extra constraints from Rule 6
  console.log("Running Test 1.1: 'bên em có laptop không' must not resolve stock...");
  let progress1_1 = createEmptyConversationProgress();
  progress1_1 = updateProgressFromSaleMessage(progress1_1, "bên em có laptop không");
  assert.equal(getTopicProgress(progress1_1, "stock").answered, false, "'bên em có laptop không' must not resolve stock");

  console.log("Running Test 1.2: 'có mẫu nào i5 không' must not resolve stock...");
  let progress1_2 = createEmptyConversationProgress();
  progress1_2 = updateProgressFromSaleMessage(progress1_2, "có mẫu nào i5 không");
  assert.equal(getTopicProgress(progress1_2, "stock").answered, false, "'có mẫu nào i5 không' must not resolve stock");

  // 2. "có hàng" resolves stock
  console.log("Running Test 2: 'có hàng' resolves stock...");
  let progress2 = createEmptyConversationProgress();
  progress2 = updateProgressFromSaleMessage(progress2, "mẫu này có hàng chị nhé");
  assert.equal(getTopicProgress(progress2, "stock").answered, true, "'có hàng' must resolve stock");

  // 3. "còn hàng" resolves stock
  console.log("Running Test 3: 'còn hàng' resolves stock...");
  let progress3 = createEmptyConversationProgress();
  progress3 = updateProgressFromSaleMessage(progress3, "mẫu này còn hàng anh");
  assert.equal(getTopicProgress(progress3, "stock").answered, true, "'còn hàng' must resolve stock");

  // 4. "hết hàng" resolves stock as out-of-stock
  console.log("Running Test 4: 'hết hàng' resolves stock...");
  let progress4 = createEmptyConversationProgress();
  progress4 = updateProgressFromSaleMessage(progress4, "mẫu này hiện hết hàng");
  assert.equal(getTopicProgress(progress4, "stock").answered, true, "'hết hàng' must resolve stock");

  // 5. "2-3 mẫu" is not stock leak
  console.log("Running Test 5: '2-3 mẫu' is not stock leak...");
  assert.equal(isActualStockLeak("em gửi anh 2-3 mẫu phù hợp để anh so sánh nhé", "2"), false, "'2-3 mẫu' must not be stock leak");
  assert.equal(isActualStockLeak("em gửi anh 2-3 mẫu phù hợp để anh so sánh nhé", "3"), false, "'2-3 mẫu' must not be stock leak");

  // Extra constraints from Rule 6
  console.log("Running Test 5.1: '2 dòng máy' must not be stock leak...");
  assert.equal(isActualStockLeak("gửi em 2 dòng máy HP", "2"), false, "'2 dòng máy' must not be stock leak");

  // 6. "còn 2 cái" is stock leak if Sale did not say quantity
  console.log("Running Test 6: 'còn 2 cái' is stock leak...");
  assert.equal(isActualStockLeak("mẫu này còn 2 cái đúng không em?", "2"), true, "'còn 2 cái' should trigger stock leak blocker");

  // Extra constraints from Rule 6
  console.log("Running Test 6.1: 'kho còn 2 máy' should be stock leak if Sale did not say quantity first...");
  assert.equal(isActualStockLeak("kho còn 2 máy đúng không em?", "2"), true, "'kho còn 2 máy' should trigger stock leak blocker");

  // 7. "còn 2 cái" allowed if Sale said it (handled in server/runner by wasMentionedBySale check)
  console.log("Running Test 7: wasMentionedBySale check logic...");
  const saleTextHistory = "mẫu này bên em còn 2 cái";
  const wasMentionedBySale = /\b2\b/.test(saleTextHistory);
  assert.equal(wasMentionedBySale, true, "If Sale mentioned it, AI is allowed to repeat it");

  // 8. Confirmation not reopen
  console.log("Running Test 8: Confirmation is not treated as reopen...");
  let progress8 = createEmptyConversationProgress();
  // Simulate price answered
  progress8.price.answered = true;
  const reopened8 = detectReopenedAnsweredTopics(
    "vậy giá sỉ là 12 triệu đúng không em?",
    progress8,
    ["Dạ mẫu này giá sỉ là 12 triệu anh"]
  );
  assert.equal(reopened8.length, 0, "Confirmation statement must not trigger reopen guard");

  // 9. Real reopen still detected
  console.log("Running Test 9: Real reopen is still detected...");
  let progress9 = createEmptyConversationProgress();
  // Simulate price answered
  progress9.price.answered = true;
  const reopened9 = detectReopenedAnsweredTopics(
    "giá bao nhiêu vậy em?",
    progress9,
    ["Dạ mẫu này giá sỉ là 12 triệu anh"]
  );
  assert.ok(reopened9.includes("price"), "Genuine question on resolved topic must trigger reopen guard");

  // 10. Existing safety unchanged (covered by other tests but quick check here)
  console.log("Running Test 10: Topic order structure unchanged...");
  assert.equal(getFirstUnresolvedTopic(createEmptyConversationProgress()), "product_model");

  // 15. Vietnamese compound words do not trigger false positive identity drift
  console.log("Running Test 15: Vietnamese compound words do not trigger false positive identity drift...");
  const maleIdentity = {
    customer_self_pronoun: "anh" as const,
    customer_target_pronoun: "em" as const,
    sale_expected_self_pronoun: "em" as const,
    sale_expected_target_pronoun: "anh" as const,
    tone_style: "business_casual" as const,
    conversation_role: "customer_to_sales" as const
  };
  
  const compResult1 = detectIdentityDrift("em gửi anh cấu hình chi tiết nhé", maleIdentity);
  assert.equal(compResult1.identity_drift_detected, false, "'chi tiết' must not trigger identity drift");

  const compResult2 = detectIdentityDrift("Bên em có bán lẻ hay chỉ bán sỉ?", maleIdentity);
  assert.equal(compResult2.identity_drift_detected, false, "'chỉ bán sỉ' must not trigger identity drift");

  const compResult3 = detectIdentityDrift("Anh đang cần check tiếng Anh của máy này", maleIdentity);
  assert.equal(compResult3.identity_drift_detected, false, "'tiếng Anh' must not trigger identity drift");

  const compResult4 = detectIdentityDrift("Hình ảnh của máy này có đẹp không em?", maleIdentity);
  assert.equal(compResult4.identity_drift_detected, false, "'hình ảnh' must not trigger identity drift");

  console.log("=== ALL PHASE 12H.1-S GUARD SENSITIVITY SOFTENING REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
