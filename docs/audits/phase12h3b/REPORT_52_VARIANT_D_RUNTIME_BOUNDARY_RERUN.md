# REPORT 52 - Variant D Runtime Boundary Rerun

Timestamp: 2026-07-17

## Checkpoint and scope

- Checkpoint: `383549b docs(playground): add prompt ablation and observer audits`.
- Production source remained unchanged. Variant D existed only in a temporary working copy.
- Six slots, three alternating repetitions: CONTROL-D, D-CONTROL, CONTROL-D.
- 18 Turn 2 pairs per variant; 72 local-Qwen calls including Turn 1 state setup.
- External/cloud AI: not called. Full-12 and full-38 gates: not run.

## Privacy boundary

No full prompt, candidate, final reply, reasoning, persona body, product row or raw stock quantity was
persisted. Temporary records retain labels, counts and reply-source metadata only.

## Corrected observer

The prior observer assumed an API `recent_turns` field and produced impossible Turn 2
`history_count=0`. The corrected observer derives history count and role sequence from its own paired
session construction: customer-start, Turn 1 Sale, then Turn 2 Sale. Candidate and final metadata are
captured from the same API invocation and same session/turn pair.

Synthetic label-only validation passed 7/7 cases: safe preserved, candidate fallback, state fallback,
candidate repair, true false positive, missing history and pairing mismatch.

## Aggregate results

| Variant | Pairs | Low-human | Repeated | Fallback | Generated | True false positive |
|---|---:|---:|---:|---:|---:|---:|
| CONTROL | 18 | 10 | 10 | 14 | 3 | 4 |
| D | 18 | 10 | 10 | 11 | 7 | 2 |

| Variant | Safe preserved | Candidate justified fallback | Candidate justified repair |
|---|---:|---:|---:|
| CONTROL | 3 | 10 | 1 |
| D | 7 | 9 | 0 |

The corrected observer has zero schema and pairing errors. However, both variants retain true runtime
false positives; D reduces but does not eliminate them. Safety labels for buyer role, salutation,
seller/support tone, privacy and raw stock remained zero.

## Variant D decision

Variant D reduces fallback by three calls and increases generated replies by four calls versus CONTROL,
but does not improve low-human or repeated-topic at this 18-pair gate. Its two true runtime false
positives violate the required zero-false-positive and 100% safe-preservation criteria.

Do not implement Variant D. Do not combine it with other prompt sections. The next investigation must
explain the remaining D false-positive interventions at the actual guard boundary before any production
prompt change.

## Limitations

The local adapter does not expose a seed here, so Qwen sampling remains a source of variation. The
observer captures the session sequence directly but does not alter production code to expose deeper
guard internals; a future temporary wrapper should capture those labels at the guard call boundary.

## Verdict

`VARIANT_D_NOT_SAFE`
