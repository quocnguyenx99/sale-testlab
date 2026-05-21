import {
  buildIdentityProfileFromPersona,
  buildIdentityProfileFromOpening
} from "../runtime/conversationIdentity";
import {
  createEmptyConversationProgress,
  getFirstUnresolvedTopic,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage
} from "../runtime/conversationProgressTracker";
import {
  buildResponseBankReply,
  listResponseBankTopics
} from "../runtime/responseBank";
import { detectRepeatedFreeFormLoop } from "../runtime/repetitionGuard";
import {
  buildCompletionReply,
  evaluateConversationCompletion,
  shouldForceCompletionReply
} from "../runtime/conversationCompletion";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function report(name: string, ok: boolean, detail: string): void {
  const status = ok ? "PASS" : "PARTIAL";
  console.log(`[${status}] ${name} - ${detail}`);
}

function main(): void {
  const bankTopics = listResponseBankTopics().length;
  console.log(`Response bank topics: ${bankTopics}`);

  let progress = createEmptyConversationProgress();
  progress = updateProgressFromCustomerMessage(progress, "Em ơi, giá cho mẫu đó bao nhiêu vậy?");
  progress = updateProgressFromSaleMessage(progress, "25 anh");
  report(
    "Scenario A - price resolution",
    progress.price.answered && getFirstUnresolvedTopic(progress) !== "price",
    `price.answered=${progress.price.answered}, next=${getFirstUnresolvedTopic(progress)}`
  );

  const femaleIdentity = buildIdentityProfileFromPersona({
    salutation_style: "chị-em",
    display_name: "Chị Lan"
  });
  const femaleReply = buildResponseBankReply({
    topic: "next_step",
    nextTopic: "next_step",
    identity: femaleIdentity,
    recentFallbackVariantIds: [],
    recentReplies: []
  }).reply;
  report(
    "Scenario B - female identity",
    femaleIdentity.customer_self_pronoun === "chị" &&
      femaleIdentity.customer_target_pronoun === "em" &&
      !normalize(femaleReply).includes("anh can") &&
      !normalize(femaleReply).startsWith("da"),
    `self=${femaleIdentity.customer_self_pronoun}, target=${femaleIdentity.customer_target_pronoun}, reply=${femaleReply}`
  );

  progress = createEmptyConversationProgress();
  progress = updateProgressFromCustomerMessage(progress, "Em ơi, bên mình còn laptop văn phòng i5 RAM 16GB không?");
  progress = updateProgressFromSaleMessage(progress, "còn anh");
  report(
    "Scenario C - stock answer",
    progress.stock.answered,
    `stock.answered=${progress.stock.answered}`
  );

  progress = createEmptyConversationProgress();
  progress = updateProgressFromSaleMessage(
    progress,
    "Dạ mẫu này giá 25 triệu, còn 12 máy, giao hôm nay được, bảo hành 12 tháng anh."
  );
  report(
    "Scenario D - proactive sale info",
    progress.price.answered &&
      progress.stock.answered &&
      progress.delivery.answered &&
      progress.warranty.answered,
    `price=${progress.price.answered}, stock=${progress.stock.answered}, delivery=${progress.delivery.answered}, warranty=${progress.warranty.answered}`
  );

  const freeFormLoop = detectRepeatedFreeFormLoop(
    "Anh xem thêm mẫu nào khác được không em?",
    [
      "Anh xem thêm mẫu nào khác được không em?",
      "Anh xem thêm mẫu nào khác được không em?",
      "Anh xem thêm mẫu nào khác được không em?"
    ]
  );
  const loopReply = buildResponseBankReply({
    topic: "stock",
    nextTopic: "stock",
    identity: buildIdentityProfileFromOpening("Anh Nam đang xem laptop văn phòng i5 RAM 16GB."),
    recentFallbackVariantIds: ["stock_1", "stock_2", "stock_3"],
    recentReplies: [
      "Anh muốn kiểm tra lại mẫu này còn sẵn hàng không em?",
      "Mẫu này hiện còn hàng chứ em? Anh cần xác nhận trước khi đi tiếp.",
      "Anh đang ưu tiên mẫu còn sẵn hàng để khỏi mất thời gian."
    ]
  }).reply;
  report(
    "Scenario E - free-form loop",
    freeFormLoop && !normalize(loopReply).startsWith("da"),
    `freeFormLoop=${freeFormLoop}, reply=${loopReply}`
  );

  const completionProgress = createEmptyConversationProgress();
  completionProgress.configuration.answered = true;
  completionProgress.price.answered = true;
  completionProgress.stock.answered = true;
  completionProgress.delivery.answered = true;
  completionProgress.warranty.answered = true;
  completionProgress.invoice_or_document.answered = true;
  const completion = evaluateConversationCompletion({
    conversation_progress: completionProgress,
    identity_profile: buildIdentityProfileFromPersona({
      salutation_style: "anh-em",
      display_name: "Anh Nam"
    }),
    next_unresolved_topic: "next_step",
    recent_turns: [
      { role: "customer_ai", text: "Anh xem thêm mẫu nào khác được không em?" },
      { role: "customer_ai", text: "Anh xem thêm mẫu nào khác được không em?" }
    ]
  });
  const completionReply = buildCompletionReply({
    completion,
    identity: buildIdentityProfileFromPersona({
      salutation_style: "anh-em",
      display_name: "Anh Nam"
    }),
    recentReplies: [
      "Anh xem thêm mẫu nào khác được không em?",
      "Anh xem thêm mẫu nào khác được không em?"
    ],
    nextUnresolvedTopic: "next_step"
  }).reply;
  report(
    "Scenario F - completion close",
    completion.completion_ready &&
      shouldForceCompletionReply({
        candidateReply: "Anh xem thêm mẫu nào khác được không em?",
        completion,
        progress: completionProgress,
        identity: buildIdentityProfileFromPersona({
          salutation_style: "anh-em",
          display_name: "Anh Nam"
        }),
        recentReplies: [
          "Anh xem thêm mẫu nào khác được không em?",
          "Anh xem thêm mẫu nào khác được không em?"
        ],
        nextUnresolvedTopic: "next_step"
      }) &&
      !normalize(completionReply).startsWith("da"),
    `ready=${completion.completion_ready}, reply=${completionReply}`
  );
}

main();
