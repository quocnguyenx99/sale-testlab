# REPORT 27 - Phase 8c 10x3 Validation

## 1. Timestamp
- Generated at: 2026-06-12 14:47:44 +07:00

## 2. Current checkpoint status
- `REPORT_26` has been committed and pushed.
- Current branch was clean before this report creation.
- Phase 8c checkpoint status before this report:
  - sampled gate `5x3`: PASS
  - wider gate `10x3`: PASS

## 3. Dry-run command and result
Command:

```bash
npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=10 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only --dry-run
```

Result:
- PASS
- `selected_record_count = 10`
- `selected_scenario_count = 3`
- `ai_called = false`
- `endpoint_validation = pass`

## 4. Real 10x3 command and result
Command:

```bash
npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=10 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only
```

Result:
- PASS

## 5. Aggregate call counts
- `selected_record_count = 10`
- `selected_scenario_count = 3`
- `planned_call_count = 30`
- `actual_call_count = 30`

## 6. Local AI / Qwen status
- `ai_called = true`
- `local_ai_generated_count = 30`
- `fallback_count = 0`
- `fallback_rate = 0.0%`
- `timeout_count = 0`
- `timeout_rate = 0.0%`

## 7. Latency summary
- min: `101 ms`
- avg: `180.37 ms`
- max: `332 ms`

## 8. Evaluator summary
- `evaluator_passed_count = 30`
- `evaluator_failed_count = 0`
- `evaluator_violation_counts = {}`
- `state_signal_missing_count = 0`
- `state_mismatch_count = 0`
- `state_tie_order_bias_count = 8`
- `buyer_move_mismatch_count = 0`
- `mismatch_reason_counts = {}`
- `classifier_decision_reason_counts = { single_top_score: 30 }`

## 9. Scenario-level metadata-only outcome
### S1_pricing_question
- `10/10 pass`
- `actual_state = pricing_phase x10`
- `detected_buyer_move = price_probe x10`
- `state_tie_order_bias warnings = 8`

### S2_product_comparison
- `10/10 pass`
- `actual_state = research_phase x10`
- `detected_buyer_move = comparison_probe x10`

### S3_logistics_question
- `10/10 pass`
- `actual_state = logistics_phase x10`
- `detected_buyer_move = delivery_probe x10`

## 10. Interpreting state_tie_order_bias_count = 8
- `state_tie_order_bias_count = 8` is a warning/observability metric only.
- The warnings occurred in S1 pricing rows.
- The evaluator still passed those rows because:
  - `pricing_phase` was correctly detected
  - `price_probe` was correctly detected
- This is not a blocker for the 10x3 gate.
- It should remain visible and be monitored in larger gates.

## 11. Privacy checks
- `privacy_leak_detected = false`
- `blocked_fields_detected_count = 0`
- Prompt text written anywhere: `NO`
- Full reply text written anywhere: `NO`
- Reasoning text written anywhere: `NO`
- Persona/archetype/raw/session/evidence content printed: `NO`

## 12. Output artifacts
- `D:\Workspace\sale-testlab-data-pipeline\sale-testlab-data\08_runtime_simulator\2026-03\gemma_eval_results.jsonl`
  - size: `46827 bytes`
- `D:\Workspace\sale-testlab-data-pipeline\sale-testlab-data\08_runtime_simulator\2026-03\gemma_eval_summary.json`
  - size: `1539 bytes`
- `D:\Workspace\sale-testlab-data-pipeline\sale-testlab-data\08_runtime_simulator\2026-03\gemma_eval_audit.json`
  - size: `2721 bytes`

## 13. Decision
- Phase 8c blocked after 10x3: `NO`
- Safe to continue to a larger gate: `YES`
- Safe to run full month automatically: `NO`
- Cleanup should wait: `YES`

## 14. Recommended next steps
1. Commit `REPORT_27`.
2. Optionally push the report commit.
3. Decide next gate:
   - `20x3`
   - or return to Phase 12H.3-B follow-up work
4. Do not run full month without an approved plan.

## 15. Final recommendation
- Phase 8c is now confirmed PASS at the `10 archetypes x 3 scenarios` gate.
- The next step should be a deliberate decision, not automatic scale-up.
- Preserve the current metadata-only and privacy-safe execution pattern for any larger gate.
