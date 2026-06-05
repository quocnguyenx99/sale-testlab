import assert from "node:assert/strict";
import {
  ConversationProgress,
  createEmptyConversationProgress,
  ensureConversationProgress,
  getFirstUnresolvedTopic,
  getTopicProgress,
  updateProgressFromSaleMessage,
} from "./conversationProgressTracker";
import {
  evaluateConversationCompletion,
  shouldForceCompletionReply,
} from "./conversationCompletion";
import { buildIdentityProfileFromPersona } from "./conversationIdentity";
import { getBlockedTopics } from "./repetitionGuard";

function run(): void {
  // 1) sale-start like flow without prior /api/customer-start should initialize safely.
  let progress = ensureConversationProgress(undefined);
  progress = updateProgressFromSaleMessage(progress, "con anh");
  assert.equal(typeof progress.stock.answered, "boolean");

  // 2) next_unresolved_topic can be null and must not crash downstream checks.
  const doneProgress = createEmptyConversationProgress();
  for (const topic of [
    "product_model",
    "configuration",
    "price",
    "stock",
    "delivery",
    "warranty",
    "payment",
    "invoice_or_document",
    "next_step",
  ] as const) {
    doneProgress[topic].answered = true;
  }
  const nullNext = getFirstUnresolvedTopic(doneProgress);
  assert.equal(nullNext, null);
  const completion = evaluateConversationCompletion({
    conversation_progress: doneProgress,
    identity_profile: buildIdentityProfileFromPersona({
      salutation_style: "anh-em",
      display_name: "Anh Nam",
    }),
    next_unresolved_topic: nullNext,
    recent_turns: [],
  });
  assert.equal(completion.completion_ready, true);
  const forced = shouldForceCompletionReply({
    candidateReply: "Gia sao em?",
    completion,
    progress: doneProgress,
    identity: buildIdentityProfileFromPersona({
      salutation_style: "anh-em",
      display_name: "Anh Nam",
    }),
    recentReplies: [],
    nextUnresolvedTopic: nullNext,
  });
  assert.equal(forced, true);

  // 3) missing topic key in conversationProgress should fallback to default topic state.
  const broken =
    createEmptyConversationProgress() as unknown as ConversationProgress &
      Record<string, unknown>;
  broken.price = null as unknown as ConversationProgress["price"];
  const safe = ensureConversationProgress(
    broken as unknown as ConversationProgress,
  );
  const safePrice = getTopicProgress(safe, "price");
  assert.equal(safePrice.requested, false);
  assert.equal(safePrice.answered, false);
  assert.equal(safePrice.confirmed, false);
  assert.doesNotThrow(() => getBlockedTopics(safe));

  // 4) short proactive sale answer still works on safe progress object.
  const proactive = updateProgressFromSaleMessage(
    ensureConversationProgress(undefined),
    "gia 25 trieu, con hang, con 12 may, giao hom nay duoc",
  );
  assert.equal(proactive.price.answered, true);
  assert.equal(proactive.stock.answered, true);
  assert.equal(proactive.delivery.answered, true);

  console.log("Phase12F2 null-guard regression tests: PASS");
}

run();
