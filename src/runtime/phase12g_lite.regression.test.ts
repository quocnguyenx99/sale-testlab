import assert from "node:assert/strict";
import {
  buildIdentityProfileFromSaleOpening,
  buildIdentityProfileFromPersona,
  runCustomerVoiceGuard,
  rewriteVoiceDrift,
  detectIdentityDrift
} from "./conversationIdentity";
import {
  buildCustomerOpeningEnriched
} from "./customerOpeningBuilder";
import {
  inferVoiceGroup,
  buildResponseBankReply
} from "./responseBank";

function run(): void {
  console.log("Starting Phase 12G-lite regression tests...");

  // 1. Test Sale-start identity locking
  const identity1 = buildIdentityProfileFromSaleOpening("em chào chị");
  assert.equal(identity1.customer_self_pronoun, "chị");
  assert.equal(identity1.customer_target_pronoun, "em");

  const identity2 = buildIdentityProfileFromSaleOpening("dạ bên em còn hàng anh nhé");
  assert.equal(identity2.customer_self_pronoun, "anh");
  assert.equal(identity2.customer_target_pronoun, "em");

  const identity3 = buildIdentityProfileFromSaleOpening("anh chào em nha");
  assert.equal(identity3.customer_self_pronoun, "em");
  assert.equal(identity3.customer_target_pronoun, "anh");

  // New specific test cases for buildIdentityProfileFromPersona priority
  // Test 1: isSaleOpening=true, persona name="Anh Minh", openingText="dạ em chào chị" -> Expected: chị/em
  const p1 = buildIdentityProfileFromPersona({ display_name: "Anh Minh" }, "dạ em chào chị", true);
  assert.equal(p1.customer_self_pronoun, "chị");
  assert.equal(p1.customer_target_pronoun, "em");

  // Test 2: isSaleOpening=true, persona name="Chị Lan", openingText="em chào anh" -> Expected: anh/em
  const p2 = buildIdentityProfileFromPersona({ display_name: "Chị Lan" }, "em chào anh", true);
  assert.equal(p2.customer_self_pronoun, "anh");
  assert.equal(p2.customer_target_pronoun, "em");

  // Test 3: isSaleOpening=true, openingText has no clear pronoun -> Expected: fallback to persona display_name
  const p3 = buildIdentityProfileFromPersona({ display_name: "Anh Minh" }, "alo shop ơi", true);
  assert.equal(p3.customer_self_pronoun, "anh");
  assert.equal(p3.customer_target_pronoun, "em");

  console.log("1. Sale-start identity locking: PASS");

  // 2. Test Opening Placeholder Prevention & Pronoun Mismatches
  // Mock a persona that is female, has no model in name, but triggers a laptop scenario
  const personaFemale = {
    persona_id: "female_test",
    display_name: "Chị Hạnh",
    buyer_role: "Nhân viên văn phòng",
    product_interest_categories: ["Máy tính xách tay"]
  };
  const openingFemale = buildCustomerOpeningEnriched(personaFemale);
  assert.equal(openingFemale.text.includes("[tên model A]"), false, "Opening must not contain placeholder brackets");
  assert.equal(openingFemale.text.includes("undefined"), false, "Opening must not contain undefined");
  assert.equal(openingFemale.text.includes("null"), false, "Opening must not contain null");
  assert.equal(openingFemale.text.includes("[model]"), false, "Opening must not contain [model]");
  assert.equal(openingFemale.text.includes("Anh"), false, "Female persona opening must not use 'Anh' pronoun");
  assert.ok(openingFemale.text.includes("Chị") || openingFemale.text.includes("Chị chào em") || openingFemale.text.includes("chị") || openingFemale.text.includes("em"), "Female persona opening should use correct pronouns");

  console.log("2. Opening placeholder & pronoun mismatch prevention: PASS");

  // 3. Test Customer Voice Guard & Rewrite
  const targetIdentity = {
    customer_self_pronoun: "chị" as const,
    customer_target_pronoun: "em" as const,
    sale_expected_self_pronoun: "em" as const,
    sale_expected_target_pronoun: "chị" as const,
    tone_style: "business_casual" as const,
    conversation_role: "customer_to_sales" as const
  };

  // Support phrase check
  const supportGuard = runCustomerVoiceGuard("Chào bạn, tôi có thể hỗ trợ gì cho bạn?", targetIdentity);
  assert.equal(supportGuard.customer_voice_drift_detected, true);
  assert.equal(supportGuard.customer_voice_guard_reason?.startsWith("support_phrase"), true);

  // Awkward "ạ" ending check (with support tone)
  const awkwardGuard = runCustomerVoiceGuard("chị đang tìm máy tính xách tay tư vấn ạ", targetIdentity);
  assert.equal(awkwardGuard.customer_voice_drift_detected, true);
  assert.equal(awkwardGuard.customer_voice_guard_reason, "awkward_ạ_ending");

  // Rewriting drift check
  const rewritten = rewriteVoiceDrift("chị đang tìm máy tính xách tay ạ", targetIdentity);
  assert.ok(rewritten.includes("Chị đang tìm máy tính xách tay cho công việc"));
  assert.ok(rewritten.includes("em tư vấn giúp chị"));

  // Softened "mình" and "ạ" checks
  const maleIdentity = {
    customer_self_pronoun: "anh" as const,
    customer_target_pronoun: "em" as const,
    sale_expected_self_pronoun: "em" as const,
    sale_expected_target_pronoun: "anh" as const,
    tone_style: "business_casual" as const,
    conversation_role: "customer_to_sales" as const
  };

  // Qwen-like reply "Mình đang so sánh vài model..." should not trigger self_pronoun_drift
  const driftResult = detectIdentityDrift("Mình đang so sánh vài model...", maleIdentity);
  assert.equal(driftResult.identity_drift_detected, false, "'mình đang' should not trigger identity drift");

  // Qwen-like reply "Cho anh hỏi giá bao nhiêu ạ?" should not trigger awkward_ạ_ending
  const awkwardQuestionGuard = runCustomerVoiceGuard("Cho anh hỏi giá bao nhiêu ạ?", maleIdentity);
  assert.equal(awkwardQuestionGuard.customer_voice_drift_detected, false, "Natural question ending in ạ should be allowed");

  // Support reply "Mình sẽ hỗ trợ kiểm tra cấu hình cho bạn" must still be blocked
  const supportTextGuard = runCustomerVoiceGuard("Mình sẽ hỗ trợ kiểm tra cấu hình cho bạn", maleIdentity);
  assert.equal(supportTextGuard.customer_voice_drift_detected, true, "Support-tone with mình must still be blocked");

  console.log("3. Voice Guard & Rewrite: PASS");

  // 4. Test Lightweight Persona Voice Layer
  const itPersona = {
    buyer_role: "Trưởng phòng IT",
    purchase_context: "Mua lắp đặt cho dự án công nghệ nội bộ",
    behavior_rules: ["Kiểm tra kỹ cấu hình trước khi mua"]
  };
  const voiceIT = inferVoiceGroup(itPersona);
  assert.equal(voiceIT, "internal_it");

  const corpPersona = {
    buyer_role: "Thu mua vật tư",
    purchase_context: "Cần xuất VAT đầy đủ",
    behavior_rules: ["Cần VAT", "Yêu cầu trình duyệt nhanh"]
  };
  const voiceCorp = inferVoiceGroup(corpPersona);
  assert.equal(voiceCorp, "corporate_buyer");

  // Fallback adaptation
  const paymentFallback = buildResponseBankReply({
    topic: "payment",
    nextTopic: "payment",
    identity: {
      customer_self_pronoun: "chị" as const,
      customer_target_pronoun: "em" as const,
      sale_expected_self_pronoun: "em" as const,
      sale_expected_target_pronoun: "chị" as const,
      tone_style: "business_casual" as const,
      conversation_role: "customer_to_sales" as const
    },
    recentFallbackVariantIds: [],
    recentReplies: [],
    persona: corpPersona
  });
  assert.equal(paymentFallback.variant_id, "voice_corporate_fallback");
  assert.ok(paymentFallback.reply.includes("xuất hóa đơn VAT"));

  console.log("4. Lightweight Persona Voice Layer: PASS");

  console.log("All Phase 12G-lite regression tests completed successfully!");
}

run();
