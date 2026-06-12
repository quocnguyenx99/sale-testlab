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
assert.equal(pricingWin.diagnostics.actual_state_value, "pricing_phase");
assert.equal(pricingWin.diagnostics.tie_detected, false);
assert.equal(pricingWin.diagnostics.top_score >= 2, true);
assert.equal(pricingWin.diagnostics.classifier_decision_reason, "single_top_score");

const logisticsWin = evaluateReply(
  "anh can giao lich chung tu",
  "local_ai_generated",
  makeScenario("logistics_phase", "logistics_win") as never,
);
assert.equal(logisticsWin.passed, true);
assert.equal(logisticsWin.diagnostics.actual_state_value, "logistics_phase");
assert.equal(logisticsWin.diagnostics.tie_detected, false);
assert.equal(logisticsWin.diagnostics.expected_state_score >= 2, true);

const tiePricingLogistics = evaluateReply(
  "anh can gia giao",
  "local_ai_generated",
  makeScenario("pricing_phase", "tie_pricing_logistics") as never,
);
assert.equal(tiePricingLogistics.passed, true);
assert.equal(tiePricingLogistics.diagnostics.actual_state_value, "pricing_phase");
assert.equal(tiePricingLogistics.diagnostics.tie_detected, true);
assert.deepEqual(tiePricingLogistics.diagnostics.tied_top_states, [
  "pricing_phase",
  "logistics_phase",
]);
assert.equal(
  tiePricingLogistics.diagnostics.classifier_decision_reason,
  "tie_preserved_state_rules_order",
);

const expectedNonzeroLoses = evaluateReply(
  "gia so sanh cau hinh",
  "local_ai_generated",
  makeScenario("pricing_phase", "expected_nonzero_loses") as never,
);
assert.equal(expectedNonzeroLoses.passed, false);
assert.ok(expectedNonzeroLoses.violationKeys.includes("state_mismatch"));
assert.equal(expectedNonzeroLoses.diagnostics.expected_state_score, 1);
assert.equal(expectedNonzeroLoses.diagnostics.actual_state_value, "research_phase");
assert.equal(expectedNonzeroLoses.diagnostics.actual_state_score, 2);
assert.equal(expectedNonzeroLoses.diagnostics.expected_state_rank, 2);
assert.equal(expectedNonzeroLoses.diagnostics.score_gap_expected_vs_actual, 1);

const expectedZeroLoses = evaluateReply(
  "gia bao gia",
  "local_ai_generated",
  makeScenario("payment_phase", "expected_zero_loses") as never,
);
assert.equal(expectedZeroLoses.passed, false);
assert.ok(expectedZeroLoses.violationKeys.includes("state_mismatch"));
assert.equal(expectedZeroLoses.diagnostics.expected_state_score, 0);
assert.equal(expectedZeroLoses.diagnostics.actual_state_value, "pricing_phase");
assert.equal(expectedZeroLoses.diagnostics.actual_state_score, 2);
assert.equal(expectedZeroLoses.diagnostics.expected_state_rank, null);

const noSignal = evaluateReply(
  "ok em",
  "local_ai_generated",
  makeScenario("pricing_phase", "no_signal") as never,
);
assert.equal(noSignal.passed, false);
assert.ok(noSignal.violationKeys.includes("state_signal_missing"));
assert.equal(noSignal.violationKeys.includes("state_mismatch"), false);
assert.equal(noSignal.diagnostics.actual_state_value, "none");
assert.equal(noSignal.diagnostics.top_score, 0);
assert.equal(noSignal.diagnostics.tie_detected, false);
assert.equal(noSignal.diagnostics.classifier_decision_reason, "no_nonzero_state_score");

console.log("phase8c_state_mismatch.regression.test: PASS");
