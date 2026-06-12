# Phase 8c Signal Alignment Patch

## Status
- Patch status: PASS
- Regression test: PASS
- Dry-run: PASS
- Tiny real rerun (1 record x 3 scenarios): PASS
- Qwen/local endpoint: PASS
- Privacy gate: PASS
- Commit: NOT PERFORMED

## Files changed
- src/run-phase8c.ts
- src/runtime/phase8c_state_mismatch.regression.test.ts

## Patch scope applied
- Added independent deterministic buyer_move detection in `src/run-phase8c.ts`.
- Tightened `uncertain_interest` state lexicon by removing overly generic markers such as `chi tiet` and bare `xac nhan`.
- Tightened payment lexicon by replacing bare `xac nhan` with `xac nhan thanh toan`.
- Expanded logistics detection with phrase-level tokens only.
- Did not add single-token `hang`.
- Added narrow Phase 8c prompt steering inside `src/run-phase8c.ts` only.
- Preserved current evaluator policy for:
  - `state_mismatch`
  - `state_signal_missing`
  - `state_tie_order_bias`
  - `buyer_move_mismatch`

## Validation commands
1. `npx tsx src/runtime/phase8c_state_mismatch.regression.test.ts`
2. `npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=1 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only --dry-run`
3. `npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=1 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only`

## Regression result
- Status: PASS
- Covered synthetic cases:
  - pricing explicit signal -> PASS
  - logistics explicit signal -> PASS
  - weak uncertainty-only pricing case -> FAIL as expected
  - weak/no-signal case -> `state_signal_missing` as expected
  - tie/order-bias protection -> preserved

## Dry-run result
- Status: PASS
- ai_called: false
- selected_count: 1
- scenarios_selected: 3
- endpoint_validation: pass
- prompt/reply/reasoning text written: NO

## Tiny real rerun result
- Status: PASS
- selected_count: 1
- selected_scenario_count: 3
- planned_call_count: 3
- actual_call_count: 3
- ai_called: true
- local_ai_generated_count: 3
- fallback_count: 0
- fallback_rate: 0.0%
- timeout_count: 0
- timeout_rate: 0.0%
- latency_min_ms: 116
- latency_avg_ms: 269
- latency_max_ms: 356
- evaluator_passed_count: 3
- evaluator_failed_count: 0
- evaluator_violation_counts: {}
- state_signal_missing_count: 0
- state_mismatch_count: 0
- state_tie_order_bias_count: 0
- buyer_move_mismatch_count: 0
- tie_detected_count: 0
- score_gap_range: min=0, max=0
- expected_state_nonzero_count: 3
- expected_state_zero_count: 0

## Scenario outcomes (metadata only)
### S1_pricing_question
- Result: PASS
- expected_state: pricing_phase
- actual_state: pricing_phase
- expected_buyer_move: price_probe
- detected_buyer_move: price_probe
- expected_state_score: 2
- actual_state_score: 2
- violations: none
- warnings: none

### S2_product_comparison
- Result: PASS
- expected_state: research_phase
- actual_state: research_phase
- expected_buyer_move: comparison_probe
- detected_buyer_move: comparison_probe
- expected_state_score: 2
- actual_state_score: 2
- violations: none
- warnings: none

### S3_logistics_question
- Result: PASS
- expected_state: logistics_phase
- actual_state: logistics_phase
- expected_buyer_move: delivery_probe
- detected_buyer_move: delivery_probe
- expected_state_score: 1
- actual_state_score: 1
- violations: none
- warnings: none

## Privacy and output checks
- privacy_leak_detected: false
- blocked_fields_detected_count: 0
- prompt text written anywhere: NO
- full reply text written anywhere: NO
- reasoning text written anywhere: NO
- output files:
  - `sale-testlab-data/08_runtime_simulator/2026-03/gemma_eval_results.jsonl` (4641 bytes)
  - `sale-testlab-data/08_runtime_simulator/2026-03/gemma_eval_summary.json` (1489 bytes)
  - `sale-testlab-data/08_runtime_simulator/2026-03/gemma_eval_audit.json` (2673 bytes)

## Interpretation
- The previous S1 blocker is no longer failing in the tiny real rerun.
- The previous S3 `state_signal_missing` blocker is no longer present in the tiny real rerun.
- The evaluator was not relaxed broadly; the improvement came from signal alignment and independent buyer_move detection.

## Readiness
- Phase 8c remains blocked: NO for the tiny rerun gate.
- Safe to run 5 archetypes x 3 scenarios next: YES.
- Safe to commit after review: YES, but not done in this task.

## Git status at report time
- Modified:
  - `src/run-phase8c.ts`
  - `src/runtime/phase8c_state_mismatch.regression.test.ts`
- Untracked:
  - `docs/audits/phase12h3b/REPORT_23_PHASE8C_TIE_AND_BUYER_MOVE_EVALUATOR_PATCH.md`
  - `docs/audits/phase12h3b/REPORT_24_PHASE8C_TINY_REAL_AFTER_TIE_BUYER_PATCH.md`
- This report file is also untracked until explicitly committed.
