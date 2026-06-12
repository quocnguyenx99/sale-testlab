# REPORT 24 - Phase 8c Tiny Real After Tie Buyer Patch

## 1. Tiny real rerun status

- Status: PARTIAL PASS
- Command used:

```bash
npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=1 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only
```

- Endpoint gate result: PASS
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

- min/avg/max = `102 / 163.67 / 225 ms`

## 3. Content / compatibility metadata

- `error_type set = { none }`
- `content_type set = { string }`
- `content_length min/max = 21 / 32`
- `reasoning_type set = { undefined }`
- `reasoning_length min/max = 0 / 0`
- `finish_reason set = { stop }`
- `stop_reason set = { null }`

## 4. Evaluator result after tie/buyer-move patch

- `evaluator_passed_count = 1`
- `evaluator_failed_count = 2`
- `evaluator_violation_counts`
  - `state_mismatch = 1`
  - `buyer_move_mismatch = 1`
  - `state_signal_missing = 1`
- `state_signal_missing_count = 1`
- `state_mismatch_count = 1`
- `state_tie_order_bias_count = 0`
- `buyer_move_mismatch_count = 1`
- `mismatch_reason_counts`
  - `detected_other_state = 1`
  - `no_state_keyword_detected = 1`

## 5. Score / classifier summary

- `tie_detected_count = 0`
- `expected_state_score set/range = { 0, 2 } / min=0 max=2`
- `actual_state_score set/range = { 0, 1, 2 } / min=0 max=2`
- `expected_state_rank set = { 1, null }`
- `score_gap_expected_vs_actual range = { min: null-or-0, max: 1 }`
- `state_score_margin range = { min: 0, max: 2 }`
- `violations_with_state_tie_order_bias = 0`
- `violations_with_buyer_move_mismatch = 1`
- `pass_with_state_tie_warning_count = 0`
- `failed_due_to_buyer_move_mismatch_count = 1`

Classifier decision reason counts:

- `single_top_score = 2`
- `no_nonzero_state_score = 1`

## 6. Per-scenario metadata-only interpretation

### S1_pricing_question

- `expected_state = pricing_phase`
- `actual_state = uncertain_interest`
- `expected_buyer_move = price_probe`
- `detected_buyer_move = clarify_interest`
- `expected_state_score = 0`
- `actual_state_score = 1`
- `tie_detected = false`
- `classifier_decision_reason = single_top_score`
- `violation_keys = [state_mismatch, buyer_move_mismatch]`

Conclusion:

- S1 remains a true mismatch / expected-state zero loss
- It correctly remains failed

### S2_product_comparison

- clean pass
- no warning
- no violation

### S3_logistics_question

- `expected_state = logistics_phase`
- `actual_state = none`
- `expected_buyer_move = delivery_probe`
- `detected_buyer_move = none`
- `expected_state_score = 0`
- `actual_state_score = 0`
- `tie_detected = false`
- `classifier_decision_reason = no_nonzero_state_score`
- `violation_keys = [state_signal_missing]`

Conclusion:

- S3 is NOT `state_tie_order_bias` in this rerun
- S3 is also NOT hard `state_mismatch`
- S3 currently fails as `state_signal_missing`

## 7. Required answers for current patch behavior

- Whether S1 remains true state_mismatch: `YES`
- Whether S3 is now state_tie_order_bias instead of hard state_mismatch: `NO`
- Whether S3 still fails due to buyer_move_mismatch: `NO`

Current S3 outcome is:

- `state_signal_missing`

This means:

- the narrow tie/buyer-move patch is correct as policy
- but this particular fresh rerun did not reproduce the earlier tie case

## 8. Privacy check result

- `privacy_leak_detected = false`
- `blocked_fields_detected_count = 0`
- Prompt text written anywhere: `NO`
- Full reply text written anywhere: `NO`
- Reasoning text written anywhere: `NO`
- Persona/archetype content printed: `NO`

## 9. Output artifacts and sizes

- `gemma_eval_results.jsonl`
  - line count: `3`
  - size: `4,792 bytes`
- `gemma_eval_summary.json`
  - size: `1,559 bytes`
- `gemma_eval_audit.json`
  - size: `2,883 bytes`

Backup path:

- `sale-testlab-data/_backup/phase8_stale_before_privacy_hardening_2026-03_20260612_104312`

## 10. Is it safe to commit patch/report?

- `YES`, as observability/evaluator checkpoint

## 11. Is it safe to rerun 5 archetypes x 3 scenarios?

- `NO`

Reason:

- S1 still fails as substantive mismatch
- S3 remains unstable and is currently a signal-missing case rather than resolved tie behavior

## 12. Phase 8c block status

- Phase 8c remains blocked: `YES`

## 13. Blockers / warnings

- The latest tiny rerun changed the shape of S3 failure:
  - previously diagnosable as tie/order-bias in one run
  - currently `state_signal_missing` in this run
- This suggests evaluator observability improved, but model output remains unstable at tiny sample level
- No broad rule relaxation is justified yet
