import assert from "node:assert/strict";
import { buildIdentityProfileFromPersona } from "./conversationIdentity";
import {
  createEmptyConversationProgress,
  getFirstUnresolvedTopic,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage
} from "./conversationProgressTracker";
import { buildResponseBankReply } from "./responseBank";
import { detectRepeatedFreeFormLoop } from "./repetitionGuard";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function run(): void {
  const femaleIdentity = buildIdentityProfileFromPersona({
    salutation_style: "chị-em",
    display_name: "Chị Lan"
  });
  assert.equal(femaleIdentity.customer_self_pronoun, "chị");
  assert.equal(femaleIdentity.customer_target_pronoun, "em");

  const femaleReply = buildResponseBankReply({
    topic: "next_step",
    nextTopic: "next_step",
    identity: femaleIdentity,
    recentFallbackVariantIds: [],
    recentReplies: []
  }).reply;
  assert.ok(!normalize(femaleReply).includes("anh can"));
  assert.ok(!normalize(femaleReply).includes("anh muon"));
  assert.ok(!normalize(femaleReply).includes("anh se"));
  assert.equal(normalize(femaleReply).startsWith("da"), false);

  let progress = createEmptyConversationProgress();
  progress = updateProgressFromCustomerMessage(progress, "Em ơi, giá cho mẫu đó bao nhiêu vậy?");
  progress = updateProgressFromSaleMessage(progress, "25 anh");
  assert.equal(progress.price.answered, true);
  assert.notEqual(getFirstUnresolvedTopic(progress), "price");

  progress = createEmptyConversationProgress();
  progress = updateProgressFromCustomerMessage(progress, "Em ơi, bên mình còn laptop văn phòng i5 RAM 16GB không?");
  progress = updateProgressFromSaleMessage(progress, "còn anh");
  assert.equal(progress.stock.answered, true);

  progress = createEmptyConversationProgress();
  progress = updateProgressFromSaleMessage(
    progress,
    "Dạ mẫu này giá 25 triệu, còn 12 máy, giao hôm nay được, bảo hành 12 tháng anh."
  );
  assert.equal(progress.price.answered, true);
  assert.equal(progress.stock.answered, true);
  assert.equal(progress.delivery.answered, true);
  assert.equal(progress.warranty.answered, true);

  const freeFormLoop = detectRepeatedFreeFormLoop(
    "Anh xem thêm mẫu nào khác được không em?",
    [
      "Anh xem thêm mẫu nào khác được không em?",
      "Anh xem thêm mẫu nào khác được không em?",
      "Anh xem thêm mẫu nào khác được không em?"
    ]
  );
  assert.equal(freeFormLoop, true);

  const bankReply = buildResponseBankReply({
    topic: "stock",
    nextTopic: "stock",
    identity: femaleIdentity,
    recentFallbackVariantIds: ["stock_1", "stock_2", "stock_3"],
    recentReplies: [
      "Chị muốn kiểm tra lại mẫu này còn sẵn hàng không em?",
      "Mẫu này hiện còn hàng chứ em? Chị cần xác nhận trước khi đi tiếp.",
      "Chị đang ưu tiên mẫu còn sẵn hàng để khỏi mất thời gian."
    ]
  }).reply;
  assert.equal(normalize(bankReply).startsWith("da"), false);

  console.log("Phase12E1 regression tests: PASS");
}

run();
