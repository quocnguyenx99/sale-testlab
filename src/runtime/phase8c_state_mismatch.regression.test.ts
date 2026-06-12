import assert from "node:assert/strict";
import { evaluateReply } from "../run-phase8c";

type ScenarioLike = {
  id: string;
  runtime_state:
    | "pricing_phase"
    | "logistics_phase"
    | "payment_phase"
    | "research_phase"
    | "uncertain_interest";
  user_input: string;
  tags: string[];
};

function makeScenario(
  runtime_state: ScenarioLike["runtime_state"],
  id = `test_${runtime_state}`,
): ScenarioLike {
  return {
    id,
    runtime_state,
    user_input: "synthetic",
    tags: ["test"],
  };
}

const pricingWin = evaluateReply(
  "anh can gia bao gia giam",
  "local_ai_generated",
  makeScenario("pricing_phase", "pricing_win") as never,
);
assert.equal(pricingWin.passed, true);
assert.deepEqual(pricingWin.violationKeys, []);
assert.deepEqual(pricingWin.warningKeys, []);
assert.equal(pricingWin.diagnostics.actual_state_value, "pricing_phase");
assert.equal(pricingWin.diagnostics.tie_detected, false);
assert.equal(pricingWin.diagnostics.classifier_decision_reason, "single_top_score");

const logisticsWin = evaluateReply(
  "anh can biet lich giao va ton kho",
  "local_ai_generated",
  makeScenario("logistics_phase", "logistics_win") as never,
);
assert.equal(logisticsWin.passed, true);
assert.deepEqual(logisticsWin.violationKeys, []);
assert.deepEqual(logisticsWin.warningKeys, []);
assert.equal(logisticsWin.diagnostics.actual_state_value, "logistics_phase");
assert.equal(logisticsWin.diagnostics.expected_state_score >= 2, true);

const tieExpectedWinnerWithWarning = evaluateReply(
  "anh can gia lich giao",
  "local_ai_generated",
  makeScenario("pricing_phase", "tie_expected_winner") as never,
);
assert.equal(tieExpectedWinnerWithWarning.passed, true);
assert.deepEqual(tieExpectedWinnerWithWarning.violationKeys, []);
assert.ok(tieExpectedWinnerWithWarning.warningKeys.includes("state_tie_order_bias"));
assert.equal(tieExpectedWinnerWithWarning.diagnostics.actual_state_value, "pricing_phase");
assert.equal(tieExpectedWinnerWithWarning.diagnostics.expected_state_is_tied_top, true);
assert.equal(tieExpectedWinnerWithWarning.diagnostics.buyer_move_matches_expected, true);
assert.equal(
  tieExpectedWinnerWithWarning.diagnostics.classifier_decision_reason,
  "tie_preserved_state_rules_order",
);

const s1LikeWeakUncertainFail = evaluateReply(
  "anh dang can nhac them",
  "local_ai_generated",
  makeScenario("pricing_phase", "s1_like_weak_uncertain_fail") as never,
);
assert.equal(s1LikeWeakUncertainFail.passed, false);
assert.ok(s1LikeWeakUncertainFail.violationKeys.includes("state_mismatch"));
assert.equal(s1LikeWeakUncertainFail.violationKeys.includes("buyer_move_mismatch"), true);
assert.equal(s1LikeWeakUncertainFail.warningKeys.includes("state_tie_order_bias"), false);
assert.equal(s1LikeWeakUncertainFail.diagnostics.expected_state_score, 0);
assert.equal(s1LikeWeakUncertainFail.diagnostics.actual_state_value, "uncertain_interest");
assert.equal(s1LikeWeakUncertainFail.diagnostics.actual_state_score, 1);

const s1LikeResearchDriftFail = evaluateReply(
  "anh can so sanh ma nay",
  "local_ai_generated",
  makeScenario("pricing_phase", "s1_like_research_drift_fail") as never,
);
assert.equal(s1LikeResearchDriftFail.passed, false);
assert.ok(s1LikeResearchDriftFail.violationKeys.includes("state_mismatch"));
assert.ok(s1LikeResearchDriftFail.violationKeys.includes("buyer_move_mismatch"));
assert.equal(s1LikeResearchDriftFail.diagnostics.actual_state_value, "research_phase");
assert.equal(s1LikeResearchDriftFail.diagnostics.detected_buyer_move, "comparison_probe");

const s1LikeExplicitPricingPass = evaluateReply(
  "anh can bao gia va gia net",
  "local_ai_generated",
  makeScenario("pricing_phase", "s1_like_explicit_pricing_pass") as never,
);
assert.equal(s1LikeExplicitPricingPass.passed, true);
assert.deepEqual(s1LikeExplicitPricingPass.violationKeys, []);
assert.deepEqual(s1LikeExplicitPricingPass.warningKeys, []);
assert.equal(s1LikeExplicitPricingPass.diagnostics.actual_state_value, "pricing_phase");
assert.equal(s1LikeExplicitPricingPass.diagnostics.detected_buyer_move, "price_probe");

const s3LikeTieBuyerMoveMismatch = evaluateReply(
  "anh can gia lich giao",
  "local_ai_generated",
  makeScenario("logistics_phase", "s3_like_tie_buyer_move_mismatch") as never,
);
assert.equal(s3LikeTieBuyerMoveMismatch.passed, false);
assert.equal(s3LikeTieBuyerMoveMismatch.violationKeys.includes("state_mismatch"), false);
assert.ok(s3LikeTieBuyerMoveMismatch.violationKeys.includes("buyer_move_mismatch"));
assert.ok(s3LikeTieBuyerMoveMismatch.warningKeys.includes("state_tie_order_bias"));
assert.equal(s3LikeTieBuyerMoveMismatch.diagnostics.expected_state_is_tied_top, true);
assert.equal(s3LikeTieBuyerMoveMismatch.diagnostics.buyer_move_matches_expected, false);
assert.equal(s3LikeTieBuyerMoveMismatch.diagnostics.actual_state_value, "pricing_phase");
assert.equal(s3LikeTieBuyerMoveMismatch.diagnostics.expected_state_score, 1);
assert.equal(s3LikeTieBuyerMoveMismatch.diagnostics.actual_state_score, 1);

const s3LikeExplicitLogisticsPass = evaluateReply(
  "anh can biet con hang va ngay giao",
  "local_ai_generated",
  makeScenario("logistics_phase", "s3_like_explicit_logistics_pass") as never,
);
assert.equal(s3LikeExplicitLogisticsPass.passed, true);
assert.deepEqual(s3LikeExplicitLogisticsPass.violationKeys, []);
assert.deepEqual(s3LikeExplicitLogisticsPass.warningKeys, []);
assert.equal(s3LikeExplicitLogisticsPass.diagnostics.actual_state_value, "logistics_phase");
assert.equal(s3LikeExplicitLogisticsPass.diagnostics.detected_buyer_move, "delivery_probe");

const s2LikeShortVietnameseResearchPass = evaluateReply(
  "ok gui minh so sanh ma nay nhe",
  "local_ai_generated",
  makeScenario("research_phase", "s2_like_short_vietnamese_research_pass") as never,
);
assert.equal(s2LikeShortVietnameseResearchPass.passed, true);
assert.equal(
  s2LikeShortVietnameseResearchPass.violationKeys.includes("not_vietnamese_like"),
  false,
);
assert.equal(
  s2LikeShortVietnameseResearchPass.diagnostics.actual_state_value,
  "research_phase",
);
assert.equal(
  s2LikeShortVietnameseResearchPass.diagnostics.detected_buyer_move,
  "comparison_probe",
);

const noSignal = evaluateReply(
  "ok em",
  "local_ai_generated",
  makeScenario("pricing_phase", "no_signal") as never,
);
assert.equal(noSignal.passed, false);
assert.ok(noSignal.violationKeys.includes("state_signal_missing"));
assert.equal(noSignal.violationKeys.includes("state_mismatch"), false);
assert.equal(noSignal.warningKeys.includes("state_tie_order_bias"), false);
assert.equal(noSignal.diagnostics.actual_state_value, "none");
assert.equal(noSignal.diagnostics.top_score, 0);
assert.equal(noSignal.diagnostics.classifier_decision_reason, "no_nonzero_state_score");

const okAloneStillFailsLanguageGuard = evaluateReply(
  "ok",
  "local_ai_generated",
  makeScenario("research_phase", "ok_alone_still_fails_language_guard") as never,
);
assert.equal(okAloneStillFailsLanguageGuard.passed, false);
assert.ok(okAloneStillFailsLanguageGuard.violationKeys.includes("not_vietnamese_like"));

console.log("phase8c_state_mismatch.regression.test: PASS");
