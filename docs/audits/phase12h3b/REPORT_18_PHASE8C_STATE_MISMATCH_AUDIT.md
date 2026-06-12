# REPORT 18 - Phase 8c State Mismatch Audit

## 1. Audit status

- Status: PASS
- Scope: audit evaluator `state_mismatch` path only
- AI/Qwen called in this audit: NO
- Real Phase 8c sample rerun: NO
- Privacy mode preserved: YES

## 2. Root cause

Root cause found: YES

Classification:

- A. evaluator bug: YES
- B. scenario mapping bug: NO evidence
- C. prompt/state injection bug: NO evidence
- D. model behavior issue: not proven from metadata-only artifacts
- E. missing metadata because outputs are metadata-only: YES

Exact conclusion:

- `state_mismatch` in the previous real sample did not compare an `expected_state` field
  against a structured `actual_state` field.
- The old evaluator in `src/run-phase8c.ts` used:
  - expected source: `scenario.runtime_state`
  - actual signal: direct regex hit on raw reply text
- Therefore, all 15 failures were labeled as `state_mismatch` even when the reply may
  simply have lacked explicit state keywords.
- This is an evaluator-labeling problem first, not proven model failure.

## 3. Exact state_mismatch path

Source file:

- `src/run-phase8c.ts`

Old path before patch:

- `evaluateReply(...)`
- `checkStateMatch(scenario.runtime_state, reply)`
- if `false` => push `state_mismatch`

Fields compared before patch:

- expected field name: `scenario.runtime_state`
- actual field name: none
- actual comparison target: reply text keyword regex only
- normalization applied: NO
- buyer_move field compared: NO
- topic state compared: NO structured field

Important:

- No `detected_state`
- No `actual_state`
- No `expected_buyer_move`
- No `detected_buyer_move`
- No `mismatch_reason`

## 4. Why all 15 became state_mismatch

Because the old evaluator had only one failure bucket for state checking:

- if expected-state keywords were not found in reply text
- it immediately emitted `state_mismatch`

This conflated two different cases:

1. reply truly signals another state
2. reply is short/generic and contains no state keywords at all

The previous artifacts did not preserve enough metadata to distinguish these two cases.

## 5. Prompt/state injection audit

Inspected:

- `src/run-phase8c.ts`
- `src/runtime/runtimeSessionManager.ts`
- `src/runtime/runtimePromptBuilder.ts`

Findings:

- `scenario.runtime_state` is injected into:
  - `conversation_context.current_phase`
  - `session.runtime_state`
  - prompt context section (`Runtime State`, `Current Phase`)
- Therefore Phase 8c prompt/state injection exists and is wired.
- No evidence that all 15 failures came from missing scenario state injection.

Conclusion:

- C. prompt/state injection bug: NO evidence

## 6. Metadata-only diagnostics added

Minimal patch applied: YES

Changed file:

- `src/run-phase8c.ts`

Added diagnostics fields:

- `expected_state_key`
- `expected_state_value`
- `actual_state_key`
- `actual_state_value`
- `expected_buyer_move`
- `detected_buyer_move`
- `evaluator_rule_id`
- `evaluator_rule_name`
- `state_normalization_applied`
- `mismatch_reason`
- `missing_state_fields`

Added aggregate metadata:

- `allowed_state_values`
- `violation_counts_by_scenario`
- `violation_counts_by_expected_state`
- `violation_counts_by_actual_state`
- `mismatch_reason_counts`

## 7. Minimal evaluator fix applied

Minimal fix applied: YES

What changed:

1. Added normalized text matching
   - diacritic-insensitive
   - `đ/Đ` normalized
2. Replaced old binary state check with detected-state classifier
3. Split failure modes:
   - `state_signal_missing`
   - `state_mismatch`

What was preserved:

- state validation still exists
- mismatch is not auto-converted to pass
- evaluator is not broadly weakened
- no prompt/reply text stored

## 8. Validation without AI

Validation run:

1. No-AI regression test
   - command:
     - `npx tsx src/runtime/phase8c_state_mismatch.regression.test.ts`
   - result: PASS

2. Phase 8c dry-run only
   - command:
     - `npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=5 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only --dry-run`
   - result: PASS
   - AI called: false
   - endpoint validation: pass
   - selected_count: 5
   - planned_call_count: 15

## 9. Files changed

- `src/run-phase8c.ts`
- `src/runtime/phase8c_state_mismatch.regression.test.ts`
- `docs/audits/phase12h3b/REPORT_18_PHASE8C_STATE_MISMATCH_AUDIT.md`

## 10. Current Phase 8c status

- Phase 8c behavioral pass: still NOT confirmed
- Phase 8c infrastructure/privacy: already confirmed
- Phase 8c evaluator diagnostics: now improved

## 11. Safe next step

- Safe to rerun a tiny Phase 8c real sample later: YES
- Recommended scope for rerun:
  - `--limit-records=1`
  - `--limit-scenarios=3`
  - metadata-only
- Goal of rerun:
  - populate new `actual_state_value`
  - populate `mismatch_reason`
  - distinguish:
    - true mismatch
    - missing state signal

## 12. Commit / blocking status

- Safe to commit current Phase 8c reports: YES, as audit/checkpoint docs
- Safe to treat Phase 8c as cleared: NO
- Phase 8c remains blocked: YES, until one tiny real rerun confirms new diagnostics

## 13. Privacy status

- Raw Zalo data inspected: NO
- Prompt text printed: NO
- Reply text printed: NO
- Reasoning text printed: NO
- Persona/archetype content printed: NO
- sale-testlab-data staged/tracked in git status: NO

## 14. Warnings

- The no-AI dry-run overwrote current Phase 8c metadata artifacts with dry-run outputs.
- This is privacy-safe and expected for validation, but it means current output folder no
  longer contains the previous real-sample metadata snapshot.
- Real behavioral confirmation still requires one explicit future real rerun with the new
  diagnostics.
