# REPORT 45 - Patch 2 Stability Rerun

- Timestamp: 2026-07-17 09:35:56 +07:00
- Committed Patch 2 tested: `3f7c4de fix(runtime): reduce fallback-heavy buyer responses`
- Scope: same 12 target slots and 48 chat calls used in REPORT_44 and REPORT_44B.

## 1. Deterministic regression gate

| Test | Result |
|---|---|
| `phase12h3b_salutation_buyer_role_lock` | PASS |
| `phase12h1_buyer_voice_guard` | PASS |
| `phase12h3a_customer_voice_style` | PASS |
| `phase12h3b_fallback_naturalness_fastfix` | PASS |

## 2. Runtime and privacy boundary

- Customer-start calls: 12.
- Chat calls: 48.
- `/api/chat` called: yes, through `localhost:3009`.
- Local Qwen called indirectly: yes.
- External/cloud AI called: no.
- No prompt, full reply, reasoning, persona body, product row, or raw stock quantity was
  persisted by the checker or included in this report.

## 3. Stability Run C metrics

| Metric | Result |
|---|---:|
| Customer-start pass | 12/12 |
| Chat pass / fail | 48 / 0 |
| Timeout / error | 0 / 0 |
| `local_ai_generated` | 25/48 (52.1%) |
| `local_ai_rewritten` | 11/48 (22.9%) |
| `deterministic_fallback` | 12/48 (25.0%) |
| Low-human proxy | 23/48 |
| Turn 2 low-human proxy | 7/12 |
| Salutation issue | 0 |
| Buyer-role issue | 0 |
| Seller/support issue | 0 |
| Privacy issue | 0 |
| Raw stock leak | 0 |
| Prompt/reasoning visibility | 0 |

No full catalog dump signal was observed in the metadata-only path. The runtime has no
dedicated full-catalog-dump flag, so this remains an observation rather than content review.

## 4. Comparison across Patch 2 runs

| Metric | Run A: REPORT_44 | Run B: REPORT_44B | Run C: stability |
|---|---:|---:|---:|
| Local AI generated | 22 | 25 | 25 |
| Local AI rewritten | 9 | 11 | 11 |
| Deterministic fallback | 17 | 12 | 12 |
| Low-human proxy | 26 | 23 | 23 |
| Turn 2 low-human | 6 | 9 | 7 |
| Safety/role/privacy issues | 0 | 0 | 0 |

Aggregate source distribution and total low-human proxy are stable between Run B and Run C.
Turn-level placement remains variable because local Qwen generation and guard activation are
not deterministic.

## 5. Run C fallback distribution

| Fallback group | Count | Notes |
|---|---:|---|
| Final guard forced | 3 | Completion/repetition recovery path |
| Multi-topic repetition / free-form loop | 8 | Loop-protecting path |
| Generic loop | 1 | Loop-protecting path |

Fallback by turn: Turn 1 = 1, Turn 2 = 5, Turn 3 = 2, Turn 4 = 4.

One fallback is classified mandatory because it combines payment-related repetition with a
free-form loop. The other 11 are repairable only with evidence that preserving the candidate
would not reintroduce repetition or completion regressions.

## 6. Low-human distribution

| Source | Count |
|---|---:|
| Deterministic fallback | 12 |
| Local AI rewritten | 11 |
| Local AI generated | 0 |

| Turn | Count |
|---|---:|
| Turn 1 | 8 |
| Turn 2 | 7 |
| Turn 3 | 4 |
| Turn 4 | 4 |

The remaining low-human proxy is entirely in guard/fallback paths, not untouched local AI.

## 7. Stability verdict

**STABLE_PARTIAL**

Patch 2 is stable for safety, buyer role, salutation, privacy, fallback volume, and aggregate
low-human proxy. It does not meet the strict stability gate because Turn 2 is `7/12`, one
call above the required `<= 6/12`; Run B was also above this turn-specific threshold.

## 8. Full 38-persona audit decision

**Not recommended yet.**

Do not widen to the full quality audit while the most robotic turn remains above its stability
threshold. First perform a metadata-only Turn 2 residual audit to determine whether the seven
low-human calls are unavoidable loop protection, ambiguous-model rewrite, or a narrowly
preservable safe candidate path.

## 9. Known limitations

- This is a targeted 12-slot gate, not a full 38-persona quality audit.
- Low-human is a source-path proxy, not a human semantic annotation.
- Metadata-only handling intentionally does not retain candidate reply content, so no
  additional routing relaxation is justified from this report alone.
- No Patch 2.1 was implemented.

## 10. Next action

Run a metadata-only Turn 2 residual audit only. Do not modify runtime routing, do not run the
full 38-persona audit, and do not implement Patch 2.1 until that audit separates safe
preservable candidates from genuine loop/completion recovery.
