# REPORT 44B - Patch 2 Residual Fallback And Low-Human Audit

- Timestamp: 2026-07-17 09:17:23 +07:00
- Git baseline: `2af0c88 docs(playground): add patch 1 live validation reports`
- State inspected: uncommitted Patch 2 source plus REPORT_44.
- Scope: repeat the same 12-slot, 48-chat-call targeted gate with metadata only.

## 1. Current Patch 2 files

- `src/playground/server.ts`
- `src/runtime/conversationCompletion.ts`
- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`
- `src/runtime/phase12h3b_fallback_naturalness_fastfix.regression.test.ts`
- `docs/audits/phase12h3b/REPORT_44_FALLBACK_NATURALNESS_FASTFIX.md`

## 2. Commands and privacy boundary

- Local playground was started from the current working tree.
- `GET /api/version` and `GET /api/personas` were used for local metadata and slot selection.
- `POST /api/customer-start`: 12 calls.
- `POST /api/chat`: 48 calls.
- Local Qwen was called indirectly through the local playground path.
- External/cloud AI was not called.
- No prompt, full reply, reasoning, persona body, product row, or raw stock quantity was
  written to this report or its metadata artifact.

## 3. Runtime result

| Metric | Result |
|---|---:|
| Target slots | 12 |
| Customer-start pass | 12/12 |
| Chat pass | 48/48 |
| Timeout / error | 0 / 0 |
| Salutation issue | 0 |
| Buyer-role issue | 0 |
| Support-tone issue | 0 |
| Privacy issue | 0 |
| Raw stock leak | 0 |

This is a fresh Qwen rerun. Its source distribution is better than the first Patch 2 run,
so it must be treated as a residual/stability observation rather than replacing REPORT_44.

## 4. Source distribution

| Source | Calls | Rate |
|---|---:|---:|
| `local_ai_generated` | 25 | 52.1% |
| `local_ai_rewritten` | 11 | 22.9% |
| `deterministic_fallback` | 12 | 25.0% |

The residual rerun satisfies the Patch 2 numerical gates: fallback is below `18/48`, local
generation is above `20/48`, and the low-human proxy is below `24/48`.

## 5. Remaining deterministic fallback

### By turn

| Turn | Fallback calls |
|---|---:|
| Turn 1 - price/budget | 1 |
| Turn 2 - configuration/comparison | 8 |
| Turn 3 - stock/delivery/warranty | 2 |
| Turn 4 - next step/closing | 1 |

### By reason group

| Reason group | Count | Safety class | Patch 2.1 action |
|---|---:|---|---|
| `final_guard_forced` | 5 | Repairable, but loop-sensitive | Do not relax without candidate-level evidence |
| Multi-topic repeated guard | 5 | Repairable, loop-protecting | Keep in this patch scope |
| Voice drift plus repeated topic | 1 | Conditional mandatory | Keep buyer-role/identity protection |
| Repeated configuration plus free-form loop | 1 | Mandatory loop recovery | Keep |

All 12 fallback calls are concentrated in final guard or repetition paths. No residual
fallback was attributed to privacy, raw stock secrecy, or external/model failure.

### Mandatory, repairable, and soft classification

| Class | Count | Interpretation |
|---|---:|---|
| Mandatory / conditional mandatory | 2 | Identity/role recovery or confirmed free-form loop must remain protected. |
| Repairable but loop-sensitive | 10 | Final guard and multi-topic repetition can be improved only with evidence that the original reply is safe and non-looping. |
| Soft fallback | 0 | No fallback was caused by soft ambiguity alone in this rerun. |

## 6. Residual low-human analysis

### By source

| Source | Low-human calls |
|---|---:|
| `deterministic_fallback` | 12 |
| `local_ai_rewritten` | 11 |
| `local_ai_generated` | 0 |
| Total | 23 |

### By turn

| Turn | Low-human calls |
|---|---:|
| Turn 1 - price/budget | 8 |
| Turn 2 - configuration/comparison | 9 |
| Turn 3 - stock/delivery/warranty | 5 |
| Turn 4 - next step/closing | 1 |

### Top residual causes

1. Ambiguous-model light rewrite: 11 calls. These are safe rewrites, but the current
   source-based proxy still labels every rewrite as low-human.
2. Final guard forced fallback: 5 calls. This is the largest remaining fallback branch.
3. Multi-topic/repetition recovery: 7 calls. These protect against stale or looping buyer
   questions and should not be broadly relaxed.

The smallest required improvement to meet the former `<= 24/48` target was two calls.
This rerun records `23/48`, so no additional implementation is required to meet that gate.

## 7. Smallest Patch 2.1 assessment

**No Patch 2.1 implementation is recommended from this evidence.**

The narrowest imaginable target would be the five `final_guard_forced` calls in
`src/playground/server.ts` and `src/runtime/conversationCompletion.ts`. However, this audit
has intentionally retained no reply text, so it cannot prove that any individual original
candidate was safe, buyer-natural, and non-looping. Relaxing that branch now would risk
turning a completion/repetition safeguard into a loop regression.

If a future patch is required after another failed stability gate, it should only preserve a
candidate when the final guard is the sole trigger and a metadata-safe classifier confirms
no repeated topic, identity drift, buyer-role violation, privacy issue, or stock leak.

## 8. Do-not-touch list

- Buyer-role and salutation locks from Patch 1.
- Privacy and raw stock quantity guards.
- Explicit payment/hold recovery for unknown product context.
- Product knowledge loading and Runtime Contract.
- Broad repetition/progression rewrite (Patch 3 scope).
- Stock/delivery/warranty grounding redesign (Patch 4 scope).
- Database/frontend work and full 38-persona rerun in this audit task.

## 9. Final recommendation

**Verdict: PATCH_2_ACCEPTABLE_AS_IS**

Patch 2 has a successful residual rerun with `23/48` low-human proxy and `12/48` fallback.
Do not implement Patch 2.1 merely to chase a source-path proxy. Review and commit Patch 2
as a checkpoint, then run one additional same-gate stability rerun before deciding whether
to open the full 38-persona quality audit.
