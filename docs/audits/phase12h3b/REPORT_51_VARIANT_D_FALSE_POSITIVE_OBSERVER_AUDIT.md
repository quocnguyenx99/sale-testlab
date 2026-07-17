# REPORT 51 - Variant D False-Positive Observer Audit

Timestamp: 2026-07-17

## Scope

- Commit tested: `9555b3d` with Patch 2 production behavior unchanged.
- REPORT_50 is present but still uncommitted; no source changes exist.
- Temporary local harness ran three alternating CONTROL/D repetitions across six slots.
- Total local-Qwen calls: 72. External/cloud AI calls: 0.
- No prompt, candidate, final reply, reasoning, persona body, product row or raw stock quantity was persisted.

## REPORT 47 versus REPORT 50 observer difference

REPORT_47 classified candidate safety using guard-derived candidate metadata and paired the candidate
with the final reply in the same invocation. It reported zero false positives over 27 pairs.

REPORT_50 used a reduced temporary classifier. It inferred repeated-topic from direct text heuristics
in its first control implementation, then aligned partially to REPORT_47 guard labels. It did not
capture all state-level inputs that can justify a final fallback or rewrite. Therefore its `3/12`
CONTROL and `2/12` D apparent-false-positive counts are not comparable to REPORT_47.

## Canonical definition

A candidate is SAFE only when invalid, buyer-role, salutation, seller/support, privacy, raw-stock,
prompt/reasoning exposure, repeated-topic, multi-topic repetition, free-form loop and severe
product-context flags are all false.

An altered SAFE candidate is a true runtime false positive only if no state-level reason exists.
State-level reasons include progress/history constraints, product-context state, completion gating,
reopened-topic handling and final-guard family. Missing state data must be classified as an observer
or schema error, never as a runtime error.

## Paired results

| Variant | Pairs | Low-human | Repeated | Fallback | Rewrite | Generated |
|---|---:|---:|---:|---:|---:|---:|
| CONTROL | 18 | 14 | 13 | 13 | 1 | 4 |
| D | 18 | 5 | 5 | 8 | 2 | 8 |

Variant D improves candidate low-human and repetition, and improves generated volume. It does not
yet qualify for implementation because final-state justification cannot be observed reliably.

## Observer finding

The harness recorded `history_count=0` for every apparent false-positive row. This is impossible for
the evaluated Turn 2 path, which has a prior Sale turn and customer turn. The API response does not
expose the field assumed by the observer, or the observer read the wrong response schema.

Seven apparent rows are therefore reclassified as `OBSERVER_CLASSIFICATION_ERROR`, not true runtime
false positives:

| Variant | Apparent rows | Canonical result |
|---|---:|---|
| CONTROL | 3 | OBSERVER_CLASSIFICATION_ERROR |
| D | 4 | OBSERVER_CLASSIFICATION_ERROR |

All seven had empty guard-reason labels, `next_unresolved_topic=stock`, vague product context and no
captured history. That combination cannot establish whether fallback/rewrite was state-justified.

## State-justified and model/candidate counts

| Variant | Candidate/model justified fallback | Candidate/model justified repair | Safe preserved |
|---|---:|---:|---:|
| CONTROL | 10 | 1 | 4 |
| D | 5 | 1 | 8 |

State-justified repair/fallback count is unknown rather than zero because the observer schema lacks
the required history/state boundary. True runtime false-positive count is also unknown, not zero.

## Sampling limitation

The local adapter does not expose a generation seed in this audit path. Alternating CONTROL/D reduces
order bias but does not eliminate Qwen sampling variation. The strong CONTROL variation between
REPORT_47, REPORT_50 and this run is explained by both sampling and observer-definition/schema drift.

## Variant D decision

Do not implement Variant D. Although its candidate metrics improved in this limited run, the required
safe-candidate-preservation proof is invalid until the observer captures the actual runtime history,
progress and final-guard state fields from the correct schema.

## Next action

Create a temporary label-only observer that obtains state directly at the runtime boundary, not from
an assumed API field. Validate it against a synthetic paired record before another 6-slot run. Keep
all production code unchanged and do not run full-38.

## Verdict

`OBSERVER_CLASSIFICATION_FIXED_RERUN_REQUIRED`
