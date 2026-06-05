import assert from "node:assert/strict";
import { buildIdentityProfileFromOpening } from "./conversationIdentity";
import {
  createEmptyConversationProgress,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage,
  getFirstUnresolvedTopic
} from "./conversationProgressTracker";
import { buildResponseBankReply } from "./responseBank";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function run(): void {
  const identity = buildIdentityProfileFromOpening("Anh Nam đang xem laptop văn phòng i5 RAM 16GB.");

  const stockReply = buildResponseBankReply({
    topic: "stock",
    nextTopic: "stock",
    identity,
    recentFallbackVariantIds: ["stock_1", "stock_2", "stock_3"],
    recentReplies: [
      "Anh muốn kiểm tra lại mẫu này còn sẵn hàng không em?",
      "Mẫu này hiện còn hàng chứ em? Anh cần xác nhận trước khi đi tiếp.",
      "Anh đang ưu tiên mẫu còn sẵn hàng để khỏi mất thời gian."
    ],
    product_context_status: "specific",
    is_price_quoted: true
  });
  assert.ok(stockReply.reply.length > 0, "stock fallback must return text");
  assert.equal(normalize(stockReply.reply).startsWith("da"), false, "fallback must not start with Dạ");
  assert.ok(!normalize(stockReply.reply).includes("xac nhan ngan gon"), "fallback must avoid generic confirmation");
  assert.ok(stockReply.reply.includes("anh") || stockReply.reply.includes("em"), "fallback must keep pronouns");

  const priceReply = buildResponseBankReply({
    topic: "price",
    nextTopic: "stock",
    identity,
    recentFallbackVariantIds: ["price_1", "price_2", "price_3"],
    recentReplies: [
      "Anh muốn chốt mức giá rõ hơn cho mẫu này.",
      "Anh cần thêm mức giá cụ thể để so sánh.",
      "Giá này nếu còn linh hoạt thì anh sẽ dễ chốt hơn."
    ],
    product_context_status: "specific",
    is_price_quoted: true
  });
  assert.equal(priceReply.topic_used, "stock", "price fallback must transition to stock after price is handled");
  assert.ok(!normalize(priceReply.reply).includes("xac nhan ngan gon"), "price fallback must avoid generic confirmation");
  assert.ok(normalize(priceReply.reply).includes("anh"), "price fallback must keep customer pronoun");

  let progress = createEmptyConversationProgress();
  progress.product_model.answered = true;
  progress.configuration.answered = true;
  progress = updateProgressFromCustomerMessage(progress, "Em ơi, giá cho mẫu đó bao nhiêu vậy?");
  progress = updateProgressFromSaleMessage(progress, "25 triệu anh");
  const next = getFirstUnresolvedTopic(progress);
  const transitionReply = buildResponseBankReply({
    topic: "price",
    nextTopic: next,
    identity,
    recentFallbackVariantIds: [],
    recentReplies: [],
    product_context_status: "specific",
    is_price_quoted: true
  });
  assert.equal(transitionReply.topic_used, "stock", "after price answered the fallback should transition to stock");
  assert.ok(
    /san hang|hang chu|con hang|kiem tra lai/.test(normalize(transitionReply.reply)),
    "transition fallback must move naturally to next topic"
  );
  assert.equal(normalize(transitionReply.reply).startsWith("da"), false, "transition fallback must not start with Dạ");

  console.log("Phase12E regression tests: PASS");
}

run();
