# REPORT 42 - Salutation Buyer Role Lock Patch

Timestamp: 2026-06-30 09:01:27 +07:00

Git commit inspected: `54506229921864cb0dff8c82c3d0062f35b540d6`

Status:

- Source patch applied: YES
- Qwen/local AI called: NO
- `/api/chat` called: NO
- External/cloud AI called: NO

## 1. Issue targeted

Targeted from REPORT_40 / REPORT_41:

- wrong or inconsistent salutation
- seller-like instead of buyer
- assistant/support-agent tone

Patch scope only:

- tune_salutation
- buyer_role_lock
- final reply role/salutation validation
- response bank identity-consistent rendering
- minimal buyer-side repair wording

Not included:

- buyer voice calibration patch 2
- loop guard patch 3
- stock/delivery/warranty grounding patch 4
- Runtime Contract changes
- product knowledge loading changes

## 2. Files changed

- `src/runtime/conversationIdentity.ts`
- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`
- `src/playground/server.ts`
- `src/runtime/phase12h3b_salutation_buyer_role_lock.regression.test.ts`

## 3. Implementation summary

`src/runtime/conversationIdentity.ts`

- Added narrow buyer-role violation detector.
- Added narrow buyer-role repair path.
- Integrated buyer-role check into customer voice guard.
- Kept pronoun drift repair intact.

`src/runtime/responseBank.ts`

- Tightened fallback replies to buyer-side wording.
- Reduced support/procedural phrasing in selected variants.
- Added post-render buyer-role lock on bank output.

`src/runtime/safetyGuards.ts`

- Kept existing privacy and stock leakage guards.
- Softened repair wording into short buyer-side phrasing.
- Added buyer-role lock recheck after safety repair.

`src/playground/server.ts`

- Added final buyer-role validation before returning reply.
- If repair succeeds, keep reply.
- If repair still fails, fall back through deterministic bank path.

## 4. Safety and privacy constraints preserved

Preserved:

- stock secrecy behavior
- privacy guard behavior
- no raw stock quantity exposure
- no prompt visibility
- no reasoning visibility
- no external/cloud AI path

Not changed:

- Runtime Contract
- product knowledge loading
- deterministic pipeline phases

## 5. Validation commands run

Deterministic regressions only:

- `npx tsx src/runtime/phase12h3b_salutation_buyer_role_lock.regression.test.ts`
- `npx tsx src/runtime/phase12h1_buyer_voice_guard.regression.test.ts`
- `npx tsx src/runtime/phase12h3a_customer_voice_style.regression.test.ts`

Live validation:

- `/api/chat`: NOT RUN
- targeted live endpoint check: NOT RUN

## 6. Validation results

Results:

- New salutation/buyer-role regression: PASS
- Existing buyer voice guard regression: PASS
- Existing customer voice style regression: PASS

Coverage validated:

- seller/support-like phrase is blocked or repaired
- buyer-safe phrase with `em` remains allowed
- response bank output stays buyer-side
- active salutation remains stable
- stock privacy guard remains active

## 7. Targeted slots tested

Live slot-level validation:

- NOT RUN in this patch

Reason:

- Patch 1 was validated with deterministic regression first.
- No Qwen or `/api/chat` call was used in this task.

Recommended next targeted live check:

- `recommended_3`
- `recommended_4`
- `recommended_5`
- `recommended_6`
- `recommended_8`
- `non_recommended_16`
- `non_recommended_18`
- `non_recommended_7`
- `non_recommended_13`
- `non_recommended_24`
- `non_recommended_3`
- `non_recommended_12`

## 8. Expected impact

Before patch:

- final reply could drift into seller/support tone after fallback or rewrite
- salutation could stay wrong after deterministic fallback
- response bank could sound procedural

Expected after patch:

- fewer seller/support-style replies in final output
- better salutation consistency in deterministic fallbacks
- lower chance of role inversion surviving post-processing

## 9. Known limitations

- No live sampled rerun yet
- No loop reduction yet
- No turn_3 / turn_4 grounding improvement yet
- No naturalness optimization beyond narrow buyer-role repair

This means:

- REPORT_40 counts are not re-measured yet
- patch impact is currently regression-confirmed, not live-audit-confirmed

## 10. Recommended next step

Immediate next step:

1. Commit REPORT_41 and REPORT_42 if review passes
2. Run targeted metadata-only live check on top FIX slots
3. Re-measure salutation and buyer-role error counts
4. Only then decide whether Patch 2 is needed next

Recommendation:

- Do not jump to loop or grounding patch yet
- Validate Patch 1 impact first on the known FIX slots
