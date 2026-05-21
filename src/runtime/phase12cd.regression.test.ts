import assert from "node:assert/strict";
import {
  createEmptyConversationProgress,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage,
  getFirstUnresolvedTopic
} from "./conversationProgressTracker";
import {
  detectRepeatedTopicAsking,
  isGenericConfirmationIntent,
  isRepeatedGenericFallback,
  buildDeterministicProgressionFallback
} from "./repetitionGuard";
import {
  buildIdentityProfileFromOpening,
  detectIdentityDrift
} from "./conversationIdentity";

function run(): void {
  let progress = createEmptyConversationProgress();
  const opening = "Em ơi, bên mình còn laptop văn phòng i5 RAM 16GB không?";
  const identity = buildIdentityProfileFromOpening(opening);

  progress = updateProgressFromCustomerMessage(progress, "Em ơi, giá cho mẫu đó bao nhiêu vậy?");
  progress = updateProgressFromSaleMessage(progress, "25 triệu anh");

  assert.equal(progress.price.requested, true, "price.requested must be true");
  assert.equal(progress.price.answered, true, "price.answered must be true after sale quote");

  const repeatedPriceAsk = "Em ơi, giá cho mẫu đó bao nhiêu vậy?";
  const blocked = detectRepeatedTopicAsking(repeatedPriceAsk, progress);
  assert.ok(blocked.includes("price"), "price re-ask must be blocked");

  const badGeneric = "em đang cần em xác nhận ngắn gọn giúp em thông tin tiếp theo nhé.";
  assert.equal(isGenericConfirmationIntent(badGeneric), true, "generic confirmation intent must be detected");
  assert.equal(isRepeatedGenericFallback(badGeneric, [badGeneric]), true, "generic fallback loop must be detected");

  const next = getFirstUnresolvedTopic(progress);
  const fallback = buildDeterministicProgressionFallback(next, identity);
  assert.equal(/xac nhan ngan gon|thong tin tiep theo/.test(fallback.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()), false, "fallback must avoid generic confirm loop");

  const emIdentity = buildIdentityProfileFromOpening("Em đang cần xem mini PC cho văn phòng, anh tư vấn giúp em nhé.");
  const drift = detectIdentityDrift("Anh đang cần em xác nhận ngắn gọn giúp anh.", emIdentity);
  assert.equal(drift.identity_drift_detected, true, "pronoun drift must be detected for em-locked customer");

  console.log("Phase12C-12D regression tests: PASS");
}

run();
