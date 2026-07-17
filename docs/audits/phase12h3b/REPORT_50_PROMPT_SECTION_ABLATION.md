# REPORT 50 - Prompt Section Ablation

Timestamp: 2026-07-17

## Commit and scope

- Production commit tested: `9555b3d` (Patch 2 runtime behavior; rejected Patch 3 is absent).
- Scope: temporary, metadata-only Turn 2 harness outside the repository.
- Production source modified: no.
- Full 38-persona audit: not run.
- External/cloud AI: not called.

## Privacy boundary

- Qwen was reached only through the approved local playground/runtime path.
- The temporary artifacts contain aggregate flags, reply source and guard-reason labels only.
- No full prompt, reply, reasoning, persona body, product row or raw stock quantity was persisted.

## Failed Patch 3 attribution

REPORT_49 has aggregate, not turn-complete, runtime metadata. Its measurable regression was:

| Metric | Patch 2 | Rejected full compaction |
|---|---:|---:|
| Local AI generated | 25/48 | 21/48 |
| Local AI rewritten | 11/48 | 4/48 |
| Deterministic fallback | 12/48 | 23/48 |
| Aggregate low-human | 23/48 | 27/48 |
| Turn 2 low-human | 7/12 | 9/12 |

The only turn-specific evidence is Turn 2, where low-human worsened by two calls. The aggregate
fallback increase was 11 calls. REPORT_49 does not safely support assigning the remaining increase
to Turn 1, 3 or 4 individually; this report does not infer a distribution without metadata.

## Control and variants

Control is the exact current production prompt with no compaction. Each variant retained all other
production sections and changed one temporary-builder contribution only.

| Variant | Isolated temporary change |
|---|---|
| CONTROL | Current production prompt unchanged |
| A | Remove only fixed progression checklist |
| B | Replace only completed-topic positive actions with a state-only instruction |
| C | Compact only duplicate product-gate instructions; retain product context and safety |
| D | Add one concise focus only on Turn 2; retain original prompt on other turns |

Screening used six approved slots, two independent repetitions and one Turn 2 candidate/final pair
per repetition: 12 pairs per variant, 60 pairs total.

## Screening summary

| Variant | Candidate low-human | Repeated topic | Fallback | Generated | False positive | Advance |
|---|---:|---:|---:|---:|---:|---|
| CONTROL | 7/12 | 7/12 | 8/12 | 2/12 | 3/12 | Baseline |
| A | 8/12 | 8/12 | 10/12 | 2/12 | 4/12 | No |
| B | 8/12 | 8/12 | 9/12 | 3/12 | 2/12 | No |
| C | 7/12 | 7/12 | 9/12 | 3/12 | 2/12 | No |
| D | 6/12 | 5/12 | 7/12 | 5/12 | 2/12 | No |

All variants recorded zero buyer-role, salutation, privacy and raw-stock issue flags. No variant
meets the zero-runtime-false-positive requirement, so no variant is eligible to advance. D is the
only direction that improves both candidate low-human and repetition, but its two false positives
mean it cannot be converted into a production patch from this evidence.

## Persistent-slot metadata

Counts below are low-human / repeated-topic / fallback across two repetitions. They are labels only.

| Slot | Control | A | B | C | D |
|---|---|---|---|---|---|
| recommended_5 | 1/1/2 | 1/1/2 | 1/1/1 | 2/2/2 | 2/2/2 |
| non_recommended_16 | 1/1/1 | 1/1/1 | 0/0/2 | 0/0/1 | 0/0/2 |
| non_recommended_3 | 2/2/1 | 2/2/2 | 2/2/2 | 1/1/2 | 1/1/1 |
| non_recommended_12 | 1/1/1 | 2/2/1 | 2/2/1 | 1/1/1 | 2/1/1 |
| recommended_4 | 2/2/2 | 2/2/2 | 1/1/1 | 2/2/2 | 1/1/1 |
| recommended_8 | 0/0/1 | 0/0/2 | 2/2/2 | 1/1/1 | 0/0/0 |

## Runtime and safety result

- No winner was selected; therefore the 12-slot, four-turn gate was not run.
- No source patch is recommended from this screening.
- Qwen local calls: 120 total (two runtime turns per 60 Turn 2 pairs).
- External/cloud AI calls: 0.
- Prompt/reply/reasoning persistence: no.

## Raw-stock decision

REPORT_49 established that raw stock quantity reached the pre-rejection prompt. This ablation did
not change that field and did not print a quantity. Stock status alone should be evaluated in a
separate stock-secrecy hardening experiment, with independent grounding and safety regression gates.
It must not be bundled with a naturalness or prompt-focus change.

## Recommendation

- Do not combine A-D and do not revive full prompt compaction.
- Keep Patch 2 production behavior unchanged.
- Before any new prompt patch, build a label-only observer that explains the two D false positives
  by guard-reason category and candidate safety classification.
- Re-run an isolated D-style experiment only after that observer is validated; no full-38 gate yet.

## Verdict

`NO_PROMPT_SECTION_VARIANT_WINS`

The screening identifies a potentially useful Turn 2 focus direction, but it is not implementation
ready because safe candidates were not preserved at 100%.
