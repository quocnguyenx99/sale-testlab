# REPORT 43 - Patch 1 Targeted Live Validation

Timestamp: 2026-06-30 09:31:00 +07:00

Git commit tested: `0239c3b`

Patch tested:

- `fix(runtime): lock buyer role and salutation in replies`

## 1. Scope

- Targeted metadata-only live validation
- Scope limited to Patch 1
- No full 38-persona rerun
- No Patch 2 / loop / grounding changes

## 2. Target slots

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

## 3. Commands run

- `git status --short`
- `git status --short --untracked-files=all`
- `git log --oneline -10`
- `GET http://localhost:3009/api/version`
- `GET http://localhost:3009/api/personas`
- Temporary local `tsx` checker from system temp path
- `POST /api/customer-start` for 12 target slots
- `POST /api/chat` for 4 turns per slot

## 4. Local runtime call status

- `/api/chat` called: YES
- Local Qwen/local AI called indirectly: YES
- External/cloud AI called: NO
- Local endpoint path used: `localhost:3009`

## 5. Metadata-only privacy statement

- No full prompt stored in report
- No full reply stored in report
- No reasoning text stored in report
- No raw persona body stored in report
- No raw product rows stored in report
- No raw stock quantity stored in report
- Only flags, counts, sources, and short notes recorded

## 6. Targeted summary table

| slot_id | customer_start | chat | salutation | seller_like | support_tone | buyer_role | low_human_risk | privacy | stock_leak | prompt/reasoning | note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `recommended_3` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `recommended_4` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `recommended_5` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `recommended_6` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `recommended_8` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `non_recommended_16` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `non_recommended_18` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `non_recommended_7` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `non_recommended_13` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `non_recommended_24` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `non_recommended_3` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |
| `non_recommended_12` | pass | pass | no | no | no | yes | yes | no | no | no | van hoi khuon mau |

## 7. Issue counts on targeted slots

Interaction counts:

- target slots tested: `12`
- customer-start pass: `12/12`
- customer-start fail: `0/12`
- chat call pass: `48/48`
- chat call fail: `0/48`
- slot chat pass: `12/12`
- slot chat fail: `0/12`
- timeout: `0`
- error: `0`

Issue counts:

- salutation issues remaining: `0`
- seller-like issues remaining: `0`
- assistant/support tone issues remaining: `0`
- buyer role preserved: `12/12`
- low human naturalness risk: `12/12`
- privacy issue: `0`
- raw stock leak: `0`
- prompt/reasoning visible: `0`
- full catalog dump: `0`

## 8. Comparison to REPORT_40 targeted baseline

Targeted baseline from `REPORT_40` for the same 12 slots:

- salutation issue baseline: `12`
- seller-like baseline: `12`
- assistant/support tone baseline proxy: `12`
- low human naturalness baseline: `12`

Targeted result after Patch 1:

- salutation issue: `12 -> 0`
- seller-like issue: `12 -> 0`
- assistant/support tone: `12 -> 0`
- low human naturalness risk: `12 -> 12`

Interpretation:

- Patch 1 materially improved the exact intended problem cluster.
- Patch 1 did not materially improve naturalness.
- No safety/privacy regression was observed in this targeted subset.

## 9. Reply source observation

Observed reply source sets across targeted slots:

- `local_ai_generated`
- `local_ai_rewritten`
- `deterministic_fallback`

Interpretation:

- Buyer-role lock is working even when fallback still occurs.
- Naturalness risk remains because deterministic fallback is still present in the final path.

## 10. Verdict

Verdict: **PASS**

Reason:

- Patch 1 clearly reduced salutation and buyer-role failures on all 12 target slots.
- No timeout, no error, no privacy leak, no stock leak, no prompt/reasoning leak.
- No obvious regression in safety behavior.

Important qualifier:

- This is a scope-limited Patch 1 pass.
- This is not a full conversation-quality pass.
- Naturalness is still weak and remains a separate blocker.

## 11. Known limitations

- Targeted subset only, not full March rerun
- Human naturalness still weak on all 12 slots
- Deterministic fallback still appears in many target flows
- Loop behavior not revalidated broadly yet
- Stock/delivery/warranty grounding not retuned yet

## 12. Recommended next step

Recommended next step:

1. Commit and review `REPORT_43`
2. Start Patch 2 only
3. Focus Patch 2 on:
   - anti_agent_like wording
   - buyer_voice calibration
   - deterministic fallback phrasing quality
4. Do not start loop guard or grounding patch yet

Pragmatic conclusion:

- Patch 1 solved the right problem cluster.
- Patch 2 is now justified because the remaining visible blocker is naturalness, not salutation drift.
