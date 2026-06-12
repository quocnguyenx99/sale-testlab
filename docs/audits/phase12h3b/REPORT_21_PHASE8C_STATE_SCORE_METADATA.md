# REPORT 21 - Phase 8c State Score Metadata

## 1. Status

- Status: PASS
- Scope: add score-level state classifier metadata only
- AI/Qwen called: NO
- Real Phase 8c run: NO
- Pass/fail relaxation applied: NO

## 2. Files changed

- `src/run-phase8c.ts`
- `src/runtime/phase8c_state_mismatch.regression.test.ts`
- `docs/audits/phase12h3b/REPORT_21_PHASE8C_STATE_SCORE_METADATA.md`

## 3. Metadata fields added

Per-row diagnostics added:

- `candidate_state_scores`
- `top_score`
- `tied_top_states`
- `tie_detected`
- `winning_state_rule_id`
- `winning_state_rule_name`
- `expected_state_score`
- `actual_state_score`
- `expected_state_rank`
- `score_gap_expected_vs_actual`
- `state_score_margin`
- `classifier_decision_reason`

Aggregate summary/audit fields added:

- `tie_detected_count`
- `tied_top_states_counts`
- `score_gap_range`
- `expected_state_nonzero_count`
- `expected_state_zero_count`
- `violations_with_expected_state_nonzero`
- `violations_with_tie_detected`
- `violations_with_expected_state_tied`
- `violations_with_actual_state_stronger`

Important:

- Metadata only contains state names and numeric scores/counts
- No prompt text
- No reply text
- No reasoning text
- No matched keyword strings are exported

## 4. Pass/fail logic change

- Pass/fail logic changed: NO

What was preserved:

- winner selection remains unchanged
- tie cases are still visible but not auto-passed
- adjacent states are still not auto-passed
- `state_signal_missing` vs `state_mismatch` behavior remains intact

## 5. Regression test result

Command:

```bash
npx tsx src/runtime/phase8c_state_mismatch.regression.test.ts
```

Result:

- PASS

Covered cases:

- clear pricing signal wins `pricing_phase`
- clear logistics signal wins `logistics_phase`
- pricing/logistics tie exposes `tie_detected`
- expected state non-zero but loses to another state
- expected state zero and actual state wins
- no state signal => `state_signal_missing`

## 6. Dry-run result

Command:

```bash
npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=1 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only --dry-run
```

Result:

- PASS
- `ai_called = false`
- `endpoint_validation = pass`
- `selected_count = 1`
- `scenarios_selected = 3`
- `planned_call_count = 3`
- `actual_call_count = 0`
- `tie_detected_count = 0`
- `score_gap_range = { min: 0, max: 0 }`
- `expected_state_nonzero_count = 0`
- `expected_state_zero_count = 0`

Artifacts after dry-run:

- `gemma_eval_results.jsonl`
  - size: `1,906 bytes`
  - line count: `3`
- `gemma_eval_summary.json`
  - size: `1,158 bytes`
- `gemma_eval_audit.json`
  - size: `1,741 bytes`

## 7. Privacy status

- Raw/session/persona content inspected: NO
- Prompt text written: NO
- Reply text written: NO
- Reasoning text written: NO
- sale-testlab-data staged/tracked: NO

## 8. Safe next step

- Safe to run tiny real Phase 8c rerun later: YES
- Reason:
  - score-level metadata is now present
  - future rerun can distinguish:
    - true mismatch
    - weak signal
    - top-score tie
    - expected-state non-zero loss

## 9. Block status

- Phase 8c remains blocked: YES

Reason:

- This patch improves observability only
- It does not clear behavioral alignment
- Any future relaxation still requires evidence from a tiny real rerun with the new score metadata

## 10. Warnings

- Dry-run overwrote active `08_runtime_simulator/2026-03` metadata artifacts with dry-run outputs
- This is expected and privacy-safe
- Do not interpret the current active artifacts as real-sample behavioral results
