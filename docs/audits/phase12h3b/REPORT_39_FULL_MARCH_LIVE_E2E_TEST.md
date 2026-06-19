# REPORT 39 - Full March Live E2E Test

Timestamp: 2026-06-19 17:11:34 +07:00
Git commit tested: `8581e80`

## 1. Scope

Full local live E2E test for month `2026-03` across all enriched personas.

Covered endpoints:
- `GET /api/version`
- `GET /api/personas`
- `POST /api/customer-start` for all 38 personas
- `POST /api/chat` for all 38 personas x 3 controlled seller turns

Hard constraints preserved:
- local-only execution
- no external/cloud AI
- metadata-only reporting
- no prompt text persisted
- no full reply text persisted
- no reasoning text persisted
- no full persona content printed
- no full product rows printed

## 2. Server Status

| Field | Value |
|---|---|
| server_ready | true |
| version | `phase11-training-personas` |
| persona_count | 38 |
| recommended_count | 9 |
| server_restart_required | true |

## 3. Test Matrix

| Metric | Count |
|---|---:|
| total_personas | 38 |
| customer_start_calls | 38 |
| chat_calls | 114 |
| total_interaction_calls | 152 |

Controlled chat turns:
- `turn_1_pricing`
- `turn_2_comparison_or_config`
- `turn_3_delivery_warranty_next_step`

## 4. Aggregate Result

| Metric | Value |
|---|---:|
| customer_start_pass_count | 38 |
| customer_start_fail_count | 0 |
| chat_pass_count | 114 |
| chat_fail_count | 0 |
| chat_timeout_count | 0 |
| chat_error_count | 0 |
| pricing_turn_pass_count | 38 |
| comparison_config_turn_pass_count | 38 |
| delivery_warranty_next_step_turn_pass_count | 38 |
| verdict | PASS |

## 5. Customer-Start Product Grounding

| Metric | Value |
|---|---:|
| catalog_grounded_start_count | 38 |
| product_grounding_used_count | 38 |
| average_candidate_count | 3 |
| personas_with_candidates | 38 |
| personas_without_candidates | 0 |

Opening source summary:
- `opening_source_type=catalog_grounded`: 38/38
- focused endpoint validation earlier remains consistent with full run
- grounding path stayed deterministic; no direct Qwen call was needed for customer-start

## 6. Chat Runtime Outcome

| Metric | Value |
|---|---:|
| local_qwen_called_indirectly | true |
| external_cloud_ai_called | false |
| assistant_style_detected_count | 0 |
| basic_loop_detected_count | 8 |

Product context distribution by turn:

| Turn | Distribution |
|---|---|
| turn_1 | `unknown=11`, `vague=15`, `specific=12` |
| turn_2 | `vague=38` |
| turn_3 | `vague=26`, `specific=12` |

Latency buckets:

| Turn | Distribution |
|---|---|
| turn_1 | `fast=38` |
| turn_2 | `fast=38` |
| turn_3 | `fast=38` |

## 7. Privacy and Safety

| Metric | Value |
|---|---:|
| privacy_issue_count | 0 |
| raw_stock_leak_count | 0 |
| prompt_or_reasoning_visible_count | 0 |
| full_catalog_dump_count | 0 |
| prompt text written anywhere | NO |
| full reply text written anywhere | NO |
| reasoning text written anywhere | NO |

Additional checks:
- raw stock quantity exposure detected: NO
- full catalog dump detected: NO
- visible privacy issue detected: NO

## 8. Known Soft Finding

Observed repeat-risk slots (`loop_detected_basic=true`):
- `recommended_1`
- `recommended_2`
- `recommended_5`
- `non_recommended_11`
- `non_recommended_15`
- `non_recommended_20`
- `non_recommended_25`
- `non_recommended_29`

Interpretation:
- this did not cause endpoint failure
- this is a soft quality signal only
- should be reviewed before broader demo scaling or stricter conversation-quality gating

## 9. Per-Persona Metadata Summary

| Metric | Value |
|---|---:|
| recommended personas tested | 9 |
| non-recommended personas tested | 29 |
| customer-start reply present | 38 |
| chat turn 1 reply present | 38 |
| chat turn 2 reply present | 38 |
| chat turn 3 reply present | 38 |
| vietnamese_like_basic | 38 |
| timeout_count total | 0 |
| error_code non-null | 0 |

## 10. Final Decision

| Decision | Status |
|---|---|
| Full March live E2E | PASS |
| Safe for report commit after review | YES |
| Safe to claim source unchanged during run | YES |
| Safe to continue broader demo planning | YES, with loop-quality note |
| Safe to treat privacy boundary as preserved | YES |

## 11. Recommendation

Recommended next step:
- review the 8 soft loop-risk persona slots with metadata-only QA
- keep current customer-start grounding patch
- do not refactor `/api/chat` safety stack based on this run alone
- if a broader live demo is planned, add one focused follow-up audit for repeat-risk handling first

Not recommended yet:
- broad runtime refactor
- removal of fallback/safety guards
- committing local temp execution artifacts

## 12. Artifact Notes

Repo artifact created by this audit:
- `docs/audits/phase12h3b/REPORT_39_FULL_MARCH_LIVE_E2E_TEST.md`

Local temp artifacts created outside repo during execution:
- `%TEMP%/report39_full_e2e.ts`
- `%TEMP%/report39_full_e2e_result.json`

These temp artifacts are local-only and were not added to git.
