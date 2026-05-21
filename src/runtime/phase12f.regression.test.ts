import assert from "node:assert/strict";
import { buildIdentityProfileFromPersona } from "./conversationIdentity";
import {
  ConversationProgress,
  createEmptyConversationProgress,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage
} from "./conversationProgressTracker";
import {
  buildCompletionReply,
  evaluateConversationCompletion,
  shouldForceCompletionReply
} from "./conversationCompletion";

function baseProgress(): ConversationProgress {
  return createEmptyConversationProgress();
}

function run(): void {
  const anhIdentity = buildIdentityProfileFromPersona({
    salutation_style: "anh-em",
    display_name: "Anh Nam"
  });
  const chiIdentity = buildIdentityProfileFromPersona({
    salutation_style: "chị-em",
    display_name: "Chị Lan"
  });

  let progress = baseProgress();
  progress.configuration.answered = true;
  progress.stock.answered = true;
  progress.delivery.answered = true;
  progress.warranty.answered = true;
  progress.invoice_or_document.answered = true;
  let completion = evaluateConversationCompletion({
    conversation_progress: progress,
    identity_profile: anhIdentity,
    next_unresolved_topic: null,
    recent_turns: []
  });
  assert.equal(completion.completion_ready, false, "price missing must prevent closing");
  assert.equal(completion.recommended_action, "ask_for_quote");

  progress = baseProgress();
  progress.configuration.answered = true;
  progress.price.answered = true;
  progress.delivery.answered = true;
  progress.warranty.answered = true;
  progress.invoice_or_document.answered = true;
  completion = evaluateConversationCompletion({
    conversation_progress: progress,
    identity_profile: anhIdentity,
    next_unresolved_topic: null,
    recent_turns: []
  });
  assert.equal(completion.completion_ready, false, "stock missing must prevent closing");
  assert.equal(completion.recommended_action, "ask_to_hold_product");

  progress = baseProgress();
  progress.configuration.answered = true;
  progress.price.answered = true;
  progress.stock.answered = true;
  progress.delivery.answered = true;
  progress.warranty.answered = true;
  progress.invoice_or_document.answered = true;
  completion = evaluateConversationCompletion({
    conversation_progress: progress,
    identity_profile: anhIdentity,
    next_unresolved_topic: "next_step",
    recent_turns: []
  });
  assert.equal(completion.completion_ready, true, "core plus useful optional topics should enable completion");
  const anhClosing = buildCompletionReply({
    completion,
    identity: anhIdentity,
    recentReplies: [],
    nextUnresolvedTopic: "next_step"
  }).reply;
  assert.ok(anhClosing.includes("anh"));
  assert.ok(anhClosing.includes("em"));
  assert.equal(/^d[ạa]/i.test(anhClosing), false, "closing must not start with Dạ");

  const chiClosing = buildCompletionReply({
    completion,
    identity: chiIdentity,
    recentReplies: [],
    nextUnresolvedTopic: "next_step"
  }).reply;
  assert.ok(chiClosing.includes("chị"));
  assert.ok(chiClosing.includes("em"));
  assert.equal(/anh can|anh muon|anh se/i.test(chiClosing), false, "female closing must not drift to anh");

  let deliveryProgress = baseProgress();
  deliveryProgress = updateProgressFromCustomerMessage(deliveryProgress, "Em ơi, bao lâu giao được em?");
  deliveryProgress = updateProgressFromSaleMessage(deliveryProgress, "Giao thứ 4 anh nhé.");
  deliveryProgress.configuration.answered = true;
  deliveryProgress.price.answered = true;
  deliveryProgress.stock.answered = true;
  deliveryProgress.warranty.answered = true;
  deliveryProgress.invoice_or_document.answered = true;
  const deliveryCompletion = evaluateConversationCompletion({
    conversation_progress: deliveryProgress,
    identity_profile: anhIdentity,
    next_unresolved_topic: "next_step",
    recent_turns: [
      { role: "customer_ai", text: "Anh xem thêm mẫu nào khác được không em?" },
      { role: "customer_ai", text: "Anh xem thêm mẫu nào khác được không em?" }
    ]
  });
  assert.equal(deliveryCompletion.completion_ready, true);
  const forcedDelivery = shouldForceCompletionReply({
    candidateReply: "Em ơi, bao lâu giao được em?",
    completion: deliveryCompletion,
    progress: deliveryProgress,
    identity: anhIdentity,
    recentReplies: ["Anh xem thêm mẫu nào khác được không em?", "Anh xem thêm mẫu nào khác được không em?"],
    nextUnresolvedTopic: "next_step"
  });
  assert.equal(forcedDelivery, true, "delivery ask must be forced out after delivery is answered");

  const loopProgress = baseProgress();
  loopProgress.configuration.answered = true;
  loopProgress.price.answered = true;
  loopProgress.stock.answered = true;
  loopProgress.delivery.answered = true;
  loopProgress.warranty.answered = true;
  loopProgress.invoice_or_document.answered = true;
  const loopCompletion = evaluateConversationCompletion({
    conversation_progress: loopProgress,
    identity_profile: anhIdentity,
    next_unresolved_topic: "next_step",
    recent_turns: [
      { role: "customer_ai", text: "Anh xem thêm mẫu nào khác được không em?" },
      { role: "customer_ai", text: "Anh xem thêm mẫu nào khác được không em?" },
      { role: "customer_ai", text: "Anh xem thêm mẫu nào khác được không em?" }
    ]
  });
  const forcedLoop = shouldForceCompletionReply({
    candidateReply: "Anh xem thêm mẫu nào khác được không em?",
    completion: loopCompletion,
    progress: loopProgress,
    identity: anhIdentity,
    recentReplies: [
      "Anh xem thêm mẫu nào khác được không em?",
      "Anh xem thêm mẫu nào khác được không em?",
      "Anh xem thêm mẫu nào khác được không em?"
    ],
    nextUnresolvedTopic: "next_step"
  });
  assert.equal(forcedLoop, true, "all-core completion must force out repeated loop replies");

  console.log("Phase12F regression tests: PASS");
}

run();
