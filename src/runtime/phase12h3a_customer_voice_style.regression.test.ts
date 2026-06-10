import assert from "node:assert/strict";
import { analyzeBuyerVoiceStyle, rewriteVoiceDrift, ConversationIdentityProfile } from "./conversationIdentity";
import { createEmptyMemory } from "./conversationMemory";
import { createEmptyConversationProgress } from "./conversationProgressTracker";
import { buildEnrichedRuntimePrompt } from "./runtimePromptBuilder";

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
  console.log("=== STARTING PHASE 12H.3-A CUSTOMER VOICE STYLE REGRESSION TESTS ===");

  console.log("Test 1: Prompt contains buyer voice calibration guidance...");
  const prompt = buildEnrichedRuntimePrompt({
    persona: {
      role_prompt: "Bạn là khách hàng đang mua máy tính cho công việc.",
      behavior_rules: ["Trả lời đúng vai khách hàng."],
      product_interest_categories: ["Laptop"],
      purchase_context: "Mua máy cho văn phòng",
      closing_conditions: [],
      do_not_do: []
    },
    runtimeState: "research_phase",
    recentMessages: ["Sale: Em chào anh", "Khach AI: Anh đang xem laptop"],
    scenarioContext: undefined,
    memorySlots: createEmptyMemory(),
    progress: createEmptyConversationProgress(),
    identity: maleIdentity
  });
  const promptNorm = prompt.toLowerCase();
  assert.equal(prompt.includes("BUYER VOICE CALIBRATION:"), true);
  assert.equal(promptNorm.includes("không phải cskh"), true);
  assert.equal(promptNorm.includes("không lặp nguyên văn câu của sale"), true);

  console.log("Test 2: Soft style markers reduce score but do not create severe style risk by themselves...");
  const softStyle = analyzeBuyerVoiceStyle(
    "Vâng em, anh chờ báo giá nhé.",
    "để em check giá rồi báo lại anh",
    maleIdentity
  );
  assert.equal(softStyle.support_phrase_count, 0);
  assert.equal(softStyle.sale_tone_risk !== "high", true);
  assert.equal(softStyle.over_polite_marker_count >= 2, true);

  console.log("Test 3: Sale-style ending and echo create high sale tone risk...");
  const saleLike = analyzeBuyerVoiceStyle(
    "Vâng em, mẫu này giá sỉ 12 triệu chị nhé.",
    "mẫu này giá sỉ 12 triệu chị nhé",
    femaleIdentity
  );
  assert.equal(saleLike.sale_tone_risk, "high");
  assert.equal(saleLike.sale_echo_marker_count >= 2, true);
  assert.equal(saleLike.buyer_voice_score < 70, true);

  console.log("Test 4: Support-side phrasing is penalized heavily...");
  const supportLike = analyzeBuyerVoiceStyle(
    "Em báo giá giúp anh mẫu này nhé, bên em còn hàng không?",
    "mẫu này còn hàng anh",
    maleIdentity
  );
  assert.equal(supportLike.support_phrase_count >= 1, true);
  assert.equal(supportLike.sale_tone_risk, "high");

  console.log("Test 5: Buyer-neutral rewrite no longer sounds like support template...");
  const rewritten = rewriteVoiceDrift("chị đang tìm máy tính xách tay ạ", femaleIdentity);
  assert.equal(/tư vấn giúp/i.test(rewritten), false);
  assert.equal(/gửi chị vài mẫu phù hợp/i.test(rewritten), true);

  console.log("Test 6: Buyer-side nhé is allowed and scores better than sale-side nhé...");
  const buyerSide = analyzeBuyerVoiceStyle(
    "Em gửi anh cấu hình trước nhé.",
    "để em báo giá model HP Z2 Tower G9 cho anh",
    maleIdentity
  );
  const saleSide = analyzeBuyerVoiceStyle(
    "Vâng em, giá này anh nhé.",
    "mẫu này giá sỉ 12 triệu anh nhé",
    maleIdentity
  );
  assert.equal(buyerSide.sale_tone_risk === "high", false);
  assert.equal(saleSide.sale_tone_risk, "high");
  assert.equal(buyerSide.buyer_voice_score > saleSide.buyer_voice_score, true);

  console.log("=== ALL PHASE 12H.3-A CUSTOMER VOICE STYLE REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
