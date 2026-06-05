import assert from "node:assert/strict";
import {
  processDealState,
  evaluateDealOutcome,
  shouldEndSession,
  evaluateTrainingSuccess,
  detectCustomerBuyingSignals,
  detectCustomerClosingSignals,
  detectCustomerObjectionSignals
} from "./dealState";
import { createEmptyConversationProgress } from "./conversationProgressTracker";
import { detectReopenedAnsweredTopics } from "./conversationCompletion";

function run(): void {
  console.log("Starting Phase 12H / 13A Deal State regression tests...");

  // Mock conversation progress
  const progressEmpty = createEmptyConversationProgress();
  const progressWithCore = {
    ...progressEmpty,
    product_model: { requested: true, answered: true, confirmed: true },
    configuration: { requested: true, answered: true, confirmed: true },
    price: { requested: true, answered: true, confirmed: true },
    stock: { requested: true, answered: true, confirmed: true }
  };

  const identityDefault = {
    customer_self_pronoun: "anh" as const,
    customer_target_pronoun: "em" as const,
    sale_expected_self_pronoun: "em" as const,
    sale_expected_target_pronoun: "anh" as const,
    tone_style: "business_casual" as const,
    conversation_role: "customer_to_sales" as const
  };

  // 1. Test quote_requested does not always end session
  const turnsQuote = [
    { role: "sale" as const, text: "Dạ đây là cấu hình máy." },
    { role: "customer_ai" as const, text: "Vậy em gửi giúp anh báo giá và cấu hình chi tiết nhé." }
  ];
  const stateQuote = processDealState({
    progress: progressEmpty,
    recent_turns: turnsQuote,
    completion_ready: false,
    missing_topics: ["price", "stock"]
  });
  assert.equal(stateQuote.deal_outcome, "quote_requested");
  assert.equal(stateQuote.should_end_session, false, "Quote requested should not end session automatically");
  console.log("- Test 1: quote_requested does not end session: PASS");

  // 2. Test payment_info_requested can end if next action clear (core resolved)
  const turnsPaymentResolved = [
    { role: "sale" as const, text: "Dạ mẫu này giá 25 triệu và có sẵn hàng." },
    { role: "customer_ai" as const, text: "Ok em, cho anh xin stk để anh chuyển khoản." }
  ];
  const statePaymentResolved = processDealState({
    progress: progressWithCore,
    recent_turns: turnsPaymentResolved,
    completion_ready: true,
    missing_topics: []
  });
  assert.equal(statePaymentResolved.deal_outcome, "payment_info_requested");
  assert.equal(statePaymentResolved.should_end_session, true, "Payment requested should end session if core resolved");
  console.log("- Test 2: payment_info_requested terminal if core resolved: PASS");

  // 3. Test pending_approval is partial_success
  const turnsApproval = [
    { role: "sale" as const, text: "Dạ bên em xuất VAT đầy đủ." },
    { role: "customer_ai" as const, text: "Để chị trình sếp duyệt chi phí rồi báo lại em nhé." }
  ];
  const stateApproval = processDealState({
    progress: progressWithCore,
    recent_turns: turnsApproval,
    completion_ready: true,
    missing_topics: []
  });
  assert.equal(stateApproval.deal_outcome, "pending_approval");
  assert.equal(stateApproval.training_success, "partial_success");
  console.log("- Test 3: pending_approval is partial_success: PASS");

  // 4. Test closed_lost ends session and has failed training
  const turnsLost = [
    { role: "sale" as const, text: "Dạ máy này giá 250 triệu." },
    { role: "customer_ai" as const, text: "Thôi đắt quá, mình không mua nữa đâu nhé." }
  ];
  const stateLost = processDealState({
    progress: progressEmpty,
    recent_turns: turnsLost,
    completion_ready: false,
    missing_topics: ["stock"]
  });
  assert.equal(stateLost.deal_outcome, "closed_lost");
  assert.equal(stateLost.should_end_session, true);
  assert.equal(stateLost.training_success, "failed");
  console.log("- Test 4: closed_lost terminal and failed training: PASS");

  // 5. Test closed_won requires explicit commitment
  const turnsCommit = [
    { role: "sale" as const, text: "Dạ đây là báo giá." },
    { role: "customer_ai" as const, text: "Ok em, anh lấy mẫu này nhé." }
  ];
  const stateCommit = processDealState({
    progress: progressWithCore,
    recent_turns: turnsCommit,
    completion_ready: true,
    missing_topics: []
  });
  assert.equal(stateCommit.deal_outcome, "closed_won_simulated", "Should be closed_won if explicit commitment exists");
  assert.equal(stateCommit.should_end_session, true);
  assert.equal(stateCommit.training_success, "success");
  console.log("- Test 5: closed_won_simulated requires explicit commitment: PASS");

  // 6. Test stalled requires no new progress/signals over multiple turns
  const turnsStalled = [
    { role: "sale" as const, text: "Dạ vâng ạ." },
    { role: "customer_ai" as const, text: "Ok em." },
    { role: "sale" as const, text: "Dạ vâng." },
    { role: "customer_ai" as const, text: "Ok." },
    { role: "sale" as const, text: "Dạ đúng rồi ạ." },
    { role: "customer_ai" as const, text: "Ok." }
  ];
  const stateStalled = processDealState({
    progress: progressEmpty,
    recent_turns: turnsStalled,
    completion_ready: false,
    missing_topics: ["price", "stock"]
  });
  assert.equal(stateStalled.deal_outcome, "stalled");
  assert.equal(stateStalled.should_end_session, true);
  assert.equal(stateStalled.training_success, "failed");
  console.log("- Test 6: stalled loops detected: PASS");

  // 7. Test sale-offered payment info alone does not mean customer payment intent
  const turnsSalePayment = [
    { role: "sale" as const, text: "Dạ đây là STK của bên em: 123456789 VCB." },
    { role: "customer_ai" as const, text: "Để mình xem lại cấu hình rồi báo nhé." }
  ];
  const stateSalePayment = processDealState({
    progress: progressEmpty,
    recent_turns: turnsSalePayment,
    completion_ready: false,
    missing_topics: ["stock"]
  });
  assert.notEqual(stateSalePayment.deal_outcome, "closed_won_simulated");
  assert.notEqual(stateSalePayment.deal_outcome, "payment_info_requested");
  console.log("- Test 7: Sale-offered payment info alone does not lock outcome: PASS");

  // 8. Test price answered + candidate "Giá vậy cao quá em, để anh cân nhắc thêm"
  // Expected: no reopened topic detected, objection detected
  const progressPriceAnswered = {
    ...progressEmpty,
    price: { requested: true, answered: true, confirmed: false }
  };
  const reopened8 = detectReopenedAnsweredTopics("Giá vậy cao quá em, để anh cân nhắc thêm", progressPriceAnswered);
  assert.equal(reopened8.length, 0, "Objection must not trigger reopened topic");
  const objections8 = detectCustomerObjectionSignals("Giá vậy cao quá em, để anh cân nhắc thêm");
  assert.ok(objections8.includes("price_objection_signal"), "Price objection should be detected");
  console.log("- Test 8: Price objection does not trigger Reopen Guard: PASS");

  // 9. Test price answered + candidate "Giá vậy em cho anh xem mẫu nào phù hợp hơn"
  // Expected: no reopened topic detected
  const reopened9 = detectReopenedAnsweredTopics("Giá vậy em cho anh xem mẫu nào phù hợp hơn", progressPriceAnswered);
  assert.equal(reopened9.length, 0, "Objection question must not trigger reopened topic");
  console.log("- Test 9: Objection redirection does not trigger Reopen Guard: PASS");

  // 10. Test price answered + candidate "Giá bao nhiêu em?"
  // Expected: reopened topic still detected
  const reopened10 = detectReopenedAnsweredTopics("Giá bao nhiêu em?", progressPriceAnswered);
  assert.ok(reopened10.includes("price"), "True re-ask must still be caught as reopened topic");
  console.log("- Test 10: True re-ask is still caught by Reopen Guard: PASS");

  console.log("All Phase 12H / 13A Deal State regression tests completed successfully!");
}

run();
