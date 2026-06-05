import assert from "node:assert/strict";
import { buildIdentityProfileFromPersona } from "./conversationIdentity";
import {
  ConversationProgress,
  createEmptyConversationProgress,
  updateProgressFromSaleMessage
} from "./conversationProgressTracker";
import {
  buildCompletionReply,
  detectReopenedAnsweredTopics,
  evaluateConversationCompletion,
  shouldForceCompletionReply
} from "./conversationCompletion";

function mkProgress(): ConversationProgress {
  return createEmptyConversationProgress();
}

function run(): void {
  // 1) Female identity from salutation_style must lock as chi/em.
  const female = buildIdentityProfileFromPersona({
    salutation_style: "chi-em",
    display_name: "Chi Lan"
  });
  assert.equal(female.customer_self_pronoun, "chị");
  assert.equal(female.customer_target_pronoun, "em");

  // 2) Reopen price detection on answered topic.
  let progress = mkProgress();
  progress.price.answered = true;
  const reopenPrice = detectReopenedAnsweredTopics("Gia sao em?", progress);
  assert.ok(reopenPrice.includes("price"));

  // 3) Reopen stock detection on answered topic.
  progress = mkProgress();
  progress.stock.answered = true;
  const reopenStock = detectReopenedAnsweredTopics("Con hang khong em?", progress);
  assert.ok(reopenStock.includes("stock"));

  // 4) Proactive sale info marks all key topics as answered.
  progress = mkProgress();
  progress = updateProgressFromSaleMessage(
    progress,
    "Da mau nay i5 RAM 16GB, gia 25 trieu, con hang, con 12 may, giao hom nay duoc, bao hanh 12 thang, co xuat hoa don cong ty va thanh toan chuyen khoan duoc anh."
  );
  assert.equal(progress.configuration.answered, true);
  assert.equal(progress.price.answered, true);
  assert.equal(progress.stock.answered, true);
  assert.equal(progress.delivery.answered, true);
  assert.equal(progress.warranty.answered, true);
  assert.equal(progress.invoice_or_document.answered, true);
  assert.equal(progress.payment.answered, true);

  // 5) Completion priority: completion_ready + reopen candidate => force completion reply.
  progress = mkProgress();
  progress.configuration.answered = true;
  progress.price.answered = true;
  progress.stock.answered = true;
  progress.delivery.answered = true;
  const completion = evaluateConversationCompletion({
    conversation_progress: progress,
    identity_profile: buildIdentityProfileFromPersona({
      salutation_style: "anh-em",
      display_name: "Anh Nam"
    }),
    next_unresolved_topic: "next_step",
    recent_turns: []
  });
  assert.equal(completion.completion_ready, true);
  const force = shouldForceCompletionReply({
    candidateReply: "Gia sao em?",
    completion,
    progress,
    identity: buildIdentityProfileFromPersona({
      salutation_style: "anh-em",
      display_name: "Anh Nam"
    }),
    recentReplies: [],
    nextUnresolvedTopic: "next_step"
  });
  assert.equal(force, true);
  const closing = buildCompletionReply({
    completion,
    identity: buildIdentityProfileFromPersona({
      salutation_style: "anh-em",
      display_name: "Anh Nam"
    }),
    recentReplies: [],
    nextUnresolvedTopic: "next_step"
  });
  assert.ok(closing.reply.length > 0);

  // 6) False positive guard: non-question confirmation must not be flagged reopen.
  progress = mkProgress();
  progress.price.answered = true;
  const noReopen = detectReopenedAnsweredTopics("Gia vay ok em", progress);
  assert.equal(noReopen.length, 0);

  console.log("Phase12F2 regression tests: PASS");
}

run();

