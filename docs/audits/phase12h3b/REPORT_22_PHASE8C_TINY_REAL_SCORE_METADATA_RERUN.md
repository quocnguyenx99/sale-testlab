# REPORT 22 - Phase 8c Tiny Real Score Metadata Rerun

## 1. Tiny real rerun status

- Status: PARTIAL PASS
- Command used:

```bash
npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=1 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only
```

- Endpoint gate: PASS
- Input source: `archetypes`
- Selected records/scenarios/calls:
  - `selected_record_count = 1`
  - `selected_scenario_count = 3`
  - `planned_call_count = 3`
  - `actual_call_count = 3`

## 2. Qwen/AI status

- `ai_called = true`
- `local_ai_generated_count = 3`
- `fallback_count = 0`
- `fallback_rate = 0.0%`
- `timeout_count = 0`
- `timeout_rate = 0.0%`

Latency:

- min/avg/max = `138 / 167.67 / 215 ms`

## 3. Content / compatibility metadata

- `error_type set = { none }`
- `content_type set = { string }`
- `content_length min/max = 28 / 33`
- `reasoning_type set = { undefined }`
- `reasoning_length min/max = 0 / 0`
- `finish_reason set = { stop }`
- `stop_reason set = { null }`

## 4. Evaluator result with score-level metadata

- `evaluator_passed_count = 1`
- `evaluator_failed_count = 2`
- `evaluator_violation_counts = { state_mismatch: 2 }`
- `state_signal_missing_count = 0`
- `state_mismatch_count = 2`
- `mismatch_reason_counts = { detected_other_state: 2 }`

## 5. Tie / score analysis

### Aggregate

- `tie_detected_count = 1`
- `tied_top_states_counts`
  - `uncertain_interest = 1`
  - `research_phase = 1`
  - `pricing_phase|logistics_phase = 1`
- `expected_state_score set = { 0, 1, 2 }`
- `actual_state_score set = { 1, 2 }`
- `expected_state_rank set = { 1, null }`
- `score_gap_expected_vs_actual range = { min: 0, max: 1 }`
- `state_score_margin range = { min: 1, max: 2 }`
- `violations_with_expected_state_nonzero = 1`
- `violations_with_tie_detected = 1`
- `violations_with_expected_state_tied = 1`
- `violations_with_actual_state_stronger = 1`
- `classifier_decision_reason counts`
  - `single_top_score = 2`
  - `tie_preserved_state_rules_order = 1`

### Candidate state score summary by row

#### S1_pricing_question

- `expected_state_value = pricing_phase`
- `actual_state_value = uncertain_interest`
- `expected_buyer_move = price_probe`
- `detected_buyer_move = clarify_interest`
- `candidate_state_scores`
  - `pricing_phase = 0`
  - `logistics_phase = 0`
  - `payment_phase = 0`
  - `research_phase = 0`
  - `uncertain_interest = 1`
- `top_score = 1`
- `tie_detected = false`
- `tied_top_states = [uncertain_interest]`
- `expected_state_score = 0`
- `actual_state_score = 1`
- `expected_state_rank = null`
- `score_gap_expected_vs_actual = 1`
- `state_score_margin = 1`
- `classifier_decision_reason = single_top_score`

Classification:

- `true mismatch` vs `weak signal` vs `tie`:
  - This row is best classified as `expected-state zero loss`
  - Not a tie
  - Not weak/no-signal, because one non-zero state was detected
  - Actual state is stronger than expected

Interpretation:

- S1 is not an evaluator tie artifact.
- It is also not a `state_signal_missing` case.
- Based on metadata only, the reply exposed one explicit `uncertain_interest` signal and zero
  `pricing_phase` signals.
- This is not safe to auto-relax.

#### S2_product_comparison

- `expected_state_value = research_phase`
- `actual_state_value = research_phase`
- `expected_buyer_move = comparison_probe`
- `detected_buyer_move = comparison_probe`
- `candidate_state_scores`
  - `pricing_phase = 0`
  - `logistics_phase = 0`
  - `payment_phase = 0`
  - `research_phase = 2`
  - `uncertain_interest = 0`
- `top_score = 2`
- `tie_detected = false`
- `expected_state_score = 2`
- `actual_state_score = 2`
- `expected_state_rank = 1`
- `score_gap_expected_vs_actual = 0`
- `state_score_margin = 2`
- `classifier_decision_reason = single_top_score`

Classification:

- clean pass

#### S3_logistics_question

- `expected_state_value = logistics_phase`
- `actual_state_value = pricing_phase`
- `expected_buyer_move = delivery_probe`
- `detected_buyer_move = price_probe`
- `candidate_state_scores`
  - `pricing_phase = 1`
  - `logistics_phase = 1`
  - `payment_phase = 0`
  - `research_phase = 0`
  - `uncertain_interest = 0`
- `top_score = 1`
- `tie_detected = true`
- `tied_top_states = [pricing_phase, logistics_phase]`
- `expected_state_score = 1`
- `actual_state_score = 1`
- `expected_state_rank = 1`
- `score_gap_expected_vs_actual = 0`
- `state_score_margin = 1`
- `classifier_decision_reason = tie_preserved_state_rules_order`

Classification:

- This row is a `tie`
- It is not a strong actual-state-over-expected loss
- Winner is determined by current `STATE_RULES` order preservation

Interpretation:

- S3 is now clearly explained by score metadata.
- This is the near-tie / order-bias case identified in REPORT_20.

## 6. Are mismatches true mismatch, weak signal, tie, or expected-state nonzero loss?

- `S1_pricing_question`
  - category: `expected-state zero loss / true mismatch`
- `S3_logistics_question`
  - category: `tie with order bias`

## 7. Privacy check result

- `privacy_leak_detected = false`
- `blocked_fields_detected_count = 0`
- Prompt text written anywhere: `NO`
- Full reply text written anywhere: `NO`
- Reasoning text written anywhere: `NO`
- Persona/archetype content printed: `NO`

## 8. Output artifacts

- `gemma_eval_results.jsonl`
  - line count: `3`
  - size: `4,330 bytes`
- `gemma_eval_summary.json`
  - size: `1,290 bytes`
- `gemma_eval_audit.json`
  - size: `2,648 bytes`

Backup path:

- `sale-testlab-data/_backup/phase8_stale_before_privacy_hardening_2026-03_20260612_093121`

## 9. Is it safe to patch evaluator rules now?

- Safe to patch targeted evaluator rules: `YES, narrowly`
- Safe to broadly relax evaluator: `NO`

Recommended safe scope:

1. Keep S1 as fail
   - expected state score is zero
   - no evidence for pricing signal
2. Consider special handling for S3-like ties only
   - if expected state is tied for top score
   - and mismatch is purely order-biased
   - expose as downgraded warning or tie-class violation instead of hard mismatch

## 10. Is it safe to rerun 5 archetypes x 3 scenarios?

- `NO`

Reason:

- one mismatch remains a real expected-state zero loss
- tie handling policy has not been updated yet

## 11. Is it safe to commit score metadata changes/reports?

- `YES`

As:

- checkpoint for evaluator observability
- not as behavioral-clearance checkpoint

## 12. Phase 8c block status

- Phase 8c remains blocked: `YES`

Reason:

- S1 still fails as a substantive mismatch
- S3 is now diagnosable as tie/order bias, but no evaluator policy change has been applied yet

## 13. Blockers / warnings

- Current active metadata artifacts now reflect this latest tiny real rerun, not the previous one
- Score metadata solved observability, not behavioral alignment
