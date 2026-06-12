# REPORT 23 - Phase 8c Tie And Buyer Move Evaluator Patch

## 1. Status

- Status: PASS
- Scope: narrow evaluator patch only
- AI/Qwen called during validation: NO
- Real Phase 8c rerun in this task: NO

## 2. Files changed

- `src/run-phase8c.ts`
- `src/runtime/phase8c_state_mismatch.regression.test.ts`
- `docs/audits/phase12h3b/REPORT_23_PHASE8C_TIE_AND_BUYER_MOVE_EVALUATOR_PATCH.md`

## 3. Exact evaluator policy change

Previous behavior:

- any detected state different from expected state => `state_mismatch`

New narrow behavior:

1. `state_signal_missing`
   - when no non-zero state score exists

2. `state_mismatch`
   - when expected state score is effectively lost and expected state is not tied for top

3. `state_tie_order_bias`
   - warning/diagnostic only
   - emitted when:
     - `tie_detected = true`
     - expected state is in `tied_top_states`
   - does not auto-pass by itself

4. `buyer_move_mismatch`
   - emitted when detected buyer move differs from expected buyer move
   - remains a failing violation

Policy guardrails preserved:

- S1-like expected-state-zero loss still fails
- no broad adjacent-state relaxation
- no automatic pass for S3-like tie when buyer move is wrong

## 4. Pass/fail logic changed?

- YES, but narrowly

What changed:

- tie/order-bias no longer becomes hard `state_mismatch` by default when expected state is tied
- buyer-move validation now explicitly controls failure in that tie case

What did not change:

- no auto-pass for true mismatch
- no auto-pass for S1
- no auto-pass for all ties

## 5. How S1 is handled

S1-like rule:

- if `expected_state_score = 0`
- and another state wins
- keep `state_mismatch`

Result:

- S1 remains fail

## 6. How S3 is handled

S3-like tie rule:

- if expected state is in `tied_top_states`
- and `tie_detected = true`
- do not emit hard `state_mismatch`
- emit `state_tie_order_bias` warning
- still require expected buyer move to match

Result:

- if buyer move mismatches:
  - fail with `buyer_move_mismatch`
  - plus `state_tie_order_bias` warning
- if buyer move matches:
  - may pass with tie warning only

## 7. Regression test result

Command:

```bash
npx tsx src/runtime/phase8c_state_mismatch.regression.test.ts
```

Result:

- PASS

Covered synthetic cases:

- clear pricing win
- clear logistics win
- tie with expected state as winner => pass + `state_tie_order_bias` warning
- S1-like expected-state zero loss => fail `state_mismatch`
- S3-like tie/order-bias + wrong buyer move => fail `buyer_move_mismatch`, not hard `state_mismatch`
- no signal => `state_signal_missing`

## 8. Dry-run result

Command:

```bash
npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=1 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only --dry-run
```

Result:

- PASS
- `ai_called = false`
- `endpoint_validation = pass`
- `selected_count = 1`
- `planned_call_count = 3`
- `actual_call_count = 0`

Dry-run aggregate metadata:

- `state_tie_order_bias_count = 0`
- `buyer_move_mismatch_count = 0`
- `violations_with_state_tie_order_bias = 0`
- `violations_with_buyer_move_mismatch = 0`
- `pass_with_state_tie_warning_count = 0`
- `failed_due_to_buyer_move_mismatch_count = 0`

Artifacts after dry-run:

- `gemma_eval_results.jsonl`
  - size: `1,906 bytes`
  - line count: `3`
- `gemma_eval_summary.json`
  - size: `1,406 bytes`
- `gemma_eval_audit.json`
  - size: `1,989 bytes`

## 9. Privacy status

- Prompt text written: NO
- Reply text written: NO
- Reasoning text written: NO
- Persona/archetype content printed: NO
- sale-testlab-data staged/tracked: NO

## 10. Safe next step

- Safe to run tiny real Phase 8c rerun later: YES

Reason:

- evaluator now distinguishes:
  - true state mismatch
  - state tie/order bias
  - buyer move mismatch

## 11. Current block status

- Phase 8c remains blocked: YES

Reason:

- no new real rerun was executed in this task
- S1 still must fail
- S3 policy is now narrowed, but needs a fresh tiny real rerun to confirm observed metadata

## 12. Blockers / warnings

- Current active metadata artifacts now reflect dry-run output, not a fresh real rerun after this patch
- Any claim about S3 operational improvement still requires one tiny real rerun
