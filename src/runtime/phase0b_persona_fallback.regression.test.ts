import assert from "node:assert/strict";
import { routeRuntimeState } from "./runtimeStateRouter";

function route(contexts: string[], message: string) {
  return routeRuntimeState({
    latestSaleMessage: message,
    recentMessages: [],
    selectedPersonaRuntimeContexts: contexts,
    product_context_status: "specific",
  });
}

function runTests(): void {
  const pricingKeywordForLogisticsPersona = route(
    ["logistics_context"],
    "giá bao nhiêu em",
  );
  const pricingKeywordForPaymentPersona = route(
    ["payment_context"],
    "giá bao nhiêu em",
  );
  assert.equal(pricingKeywordForLogisticsPersona.runtime_state, "pricing_phase");
  assert.equal(pricingKeywordForPaymentPersona.runtime_state, "pricing_phase");
  assert.deepEqual(
    pricingKeywordForLogisticsPersona.matched_rules,
    pricingKeywordForPaymentPersona.matched_rules,
  );

  const logisticsFallback = route(["logistics_context"], "được rồi em");
  const paymentFallback = route(["payment_context"], "được rồi em");
  assert.equal(logisticsFallback.runtime_state, "logistics_phase");
  assert.equal(paymentFallback.runtime_state, "payment_phase");
  assert.equal(logisticsFallback.fallback_reason, "no_keyword_match_use_persona_default");
  assert.equal(paymentFallback.fallback_reason, "no_keyword_match_use_persona_default");

  console.log("Phase 0B persona-fallback regression tests: PASS");
}

runTests();
