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

const pricingPass = evaluateReply(
  "Anh muốn xem giá và mức chiết khấu cụ thể.",
  "local_ai_generated",
  makeScenario("pricing_phase") as never,
);
assert.equal(pricingPass.passed, true);
assert.deepEqual(pricingPass.violationKeys, []);
assert.equal(pricingPass.diagnostics.actual_state_value, "pricing_phase");
assert.equal(pricingPass.diagnostics.mismatch_reason, "none");

const missingSignal = evaluateReply(
  "Ok em.",
  "local_ai_generated",
  makeScenario("pricing_phase", "missing_signal") as never,
);
assert.equal(missingSignal.passed, false);
assert.ok(missingSignal.violationKeys.includes("state_signal_missing"));
assert.equal(missingSignal.diagnostics.actual_state_value, "none");
assert.equal(missingSignal.diagnostics.mismatch_reason, "no_state_keyword_detected");

const wrongState = evaluateReply(
  "Mình muốn so sánh thêm cấu hình trước.",
  "local_ai_generated",
  makeScenario("pricing_phase", "wrong_state") as never,
);
assert.equal(wrongState.passed, false);
assert.ok(wrongState.violationKeys.includes("state_mismatch"));
assert.equal(wrongState.diagnostics.actual_state_value, "research_phase");
assert.equal(wrongState.diagnostics.mismatch_reason, "detected_other_state");

console.log("phase8c_state_mismatch.regression.test: PASS");
