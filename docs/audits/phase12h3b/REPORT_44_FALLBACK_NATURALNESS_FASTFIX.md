# REPORT 44 - Fallback Naturalness Fast-Fix

- Timestamp: 2026-07-15 11:47:46 +07:00
- Commit inspected: `2af0c88 docs(playground): add patch 1 live validation reports`
- Scope: Phase 12H.3-B Patch 2 only.
- Validation gate: the same 12 target slots and 48 chat calls used by REPORT_43/43B.

## 1. Objective

Reduce unnecessary deterministic fallback while preserving Patch 1 buyer-role and salutation
locks, privacy safeguards, stock-quantity secrecy, local-only AI, and product-knowledge loading.

## 2. Files changed

- `src/playground/server.ts`
- `src/runtime/conversationCompletion.ts`
- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`
- `src/runtime/phase12h3b_fallback_naturalness_fastfix.regression.test.ts`

## 3. Fallback trigger classification

| Trigger class | Handling after Patch 2 |
|---|---|
| Privacy, raw stock quantity, non-recoverable role/identity violation | Severe: repair or deterministic fallback remains mandatory |
| Explicit hold/payment/transfer action with an unknown product | Severe: deterministic recovery remains mandatory |
| Confirmed generic loop, free-form loop, or multiple repeated/reopened topics | Severe: deterministic fallback remains allowed |
| Ambiguous model with price/stock wording but no hard action | Medium: buyer-side light rewrite, `local_ai_rewritten` |
| One repeated topic, one reopened topic, generic confirmation | Soft: preserve safe local AI reply and record metadata reason |
| Completion-ready state with a safe specific buyer reply | Soft: preserve the reply rather than force a close |

## 4. Routing changes

- `server.ts` no longer sends a single repeated topic, generic confirmation, or a single
  reopened topic directly to the response bank.
- Completion is now a recovery condition only when the candidate reply is empty or a
  confirmed repeated loop; it no longer replaces a safe local buyer reply by default.
- `safetyGuards.ts` keeps deterministic recovery for hard payment/hold actions but marks
  repairable ambiguous price/stock/model wording as `local_ai_rewritten`.
- `responseBank.ts` shortens configuration, stock, and next-step variants into buyer-side
  asks. `conversationCompletion.ts` uses less procedural recovery wording.

## 5. Deterministic regression results

| Test | Result |
|---|---|
| `phase12h3b_salutation_buyer_role_lock` | PASS |
| `phase12h1_buyer_voice_guard` | PASS |
| `phase12h3a_customer_voice_style` | PASS |
| `phase12h3b_fallback_naturalness_fastfix` | PASS |

The existing ambiguous product/payment regression initially caught an over-broad rewrite.
The final implementation retains deterministic fallback for explicit payment/hold actions.

## 6. Targeted live validation

- Customer-start: `12/12` pass.
- Chat: `48/48` pass.
- Timeout: `0`.
- Error: `0`.
- `/api/chat` called: yes, through `localhost:3009`.
- Local Qwen called indirectly: yes.
- External/cloud AI called: no.

### Reply source distribution

| Source | REPORT_43B before | Patch 2 | Change |
|---|---:|---:|---:|
| `local_ai_generated` | 10 (20.8%) | 22 (45.8%) | +12 |
| `local_ai_rewritten` | 9 (18.8%) | 9 (18.8%) | 0 |
| `deterministic_fallback` | 29 (60.4%) | 17 (35.4%) | -12 |

### Naturalness proxy

| Metric | Before | Patch 2 | Result |
|---|---:|---:|---|
| Low-human risk by source path | 39/48 | 26/48 | Improved by 13 (33.3%) |
| Turn 2 low-human risk | 12/12 | 6/12 | Meets gate |

The low-human proxy remains two calls above the strict target of `<= 24/48`.

### Safety and role checks

| Metric | Result |
|---|---:|
| Salutation issues | 0 |
| Buyer-role issues | 0 |
| Assistant-style issues | 0 |
| Privacy issues | 0 |
| Raw stock quantity leaks | 0 |
| Prompt text persisted | no |
| Reply text persisted | no |
| Reasoning text persisted | no |

## 7. Verdict

**PARTIAL PASS**

Patch 2 materially improves routing without a safety, buyer-role, stock-secrecy, or privacy
regression. It meets the fallback (`<= 18`) and local AI generation (`>= 20`) targets, but
misses the strict low-human target by two calls. This is still a targeted gate only; no full
38-persona conversation-quality rerun was performed.

## 8. Known limitations

- The remaining low-human proxy is source-path based; it is not a human annotation score.
- Remaining fallback reasons include confirmed loop, multi-topic repetition, final guard, and
  hard product-context recovery.
- Loop/progression and stock/delivery/warranty grounding were intentionally not broadly
  changed in Patch 2.
- No Runtime Contract, product-knowledge loader, database, frontend, or Phase 1-11 pipeline
  code was changed.

## 9. Recommended next step

Audit the remaining 17 deterministic fallback calls by metadata-only reason and turn before
making any further routing change. Do not start the full 38-persona quality rerun until that
audit determines whether the remaining calls are severe recoveries or over-strict loop/final
guard paths.
