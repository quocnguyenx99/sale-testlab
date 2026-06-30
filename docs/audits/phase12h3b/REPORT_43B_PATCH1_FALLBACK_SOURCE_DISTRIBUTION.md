# REPORT 43B - Patch 1 Fallback Source Distribution

Timestamp: 2026-06-30T03:18:36.514Z

Git commit tested: `0239c3b`

## 1. Scope

- Targeted metadata-only live audit on the same 12 Patch 1 slots
- No source changes
- No Patch 2 implementation
- No full 38-persona rerun

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
- `POST /api/customer-start` for 12 target slots
- `POST /api/chat` for 4 turns per slot

## 4. Runtime call status

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

## 6. Per-turn metadata summary table

| slot_id | turn_id | topic | start | chat | source | safety_repair | buyer_role_repair | salutation_repair | fallback_reason | rewrite_reason | low_human | loop | note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `recommended_3` | `turn_1_price_budget` | `price_budget` | pass | pass | `local_ai_generated` | no | no | no | - | - | yes | no | van hoi khuon mau |
| `recommended_3` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | product_context_vague_not_specific | - | yes | yes | fallback khuon mau |
| `recommended_3` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `recommended_3` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_rewritten` | yes | yes | yes | - | repeated_topic:stock,generic_confirmation,final_guard | yes | yes | rewrite khoa vai khach |
| `recommended_4` | `turn_1_price_budget` | `price_budget` | pass | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `recommended_4` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `recommended_4` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `recommended_4` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_rewritten` | yes | yes | yes | - | repeated_topic:price,generic_confirmation,final_guard | yes | yes | rewrite khoa vai khach |
| `recommended_5` | `turn_1_price_budget` | `price_budget` | pass | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `recommended_5` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `recommended_5` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `recommended_5` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_rewritten` | yes | yes | yes | - | repeated_topic:stock,final_guard,buyer_role_lock:sale_style_salutation_ending | yes | yes | rewrite khoa vai khach |
| `recommended_6` | `turn_1_price_budget` | `price_budget` | pass | pass | `local_ai_rewritten` | yes | no | no | - | buyer_voice_sale_echo_repaired | yes | no | rewrite nhe sau guard |
| `recommended_6` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | product_context_vague_not_specific | - | yes | no | fallback khuon mau |
| `recommended_6` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | no | fallback khuon mau |
| `recommended_6` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_rewritten` | yes | yes | yes | - | generic_confirmation,final_guard,buyer_role_lock:sale_style_salutation_ending | yes | yes | rewrite khoa vai khach |
| `recommended_8` | `turn_1_price_budget` | `price_budget` | pass | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `recommended_8` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | product_context_vague_not_specific | - | yes | no | fallback khuon mau |
| `recommended_8` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `recommended_8` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `non_recommended_16` | `turn_1_price_budget` | `price_budget` | pass | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `non_recommended_16` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_16` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `non_recommended_16` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_rewritten` | yes | yes | yes | - | repeated_topic:configuration,final_guard,buyer_role_lock:sale_style_salutation_ending | yes | yes | rewrite khoa vai khach |
| `non_recommended_18` | `turn_1_price_budget` | `price_budget` | pass | pass | `deterministic_fallback` | no | no | no | product_context_vague_not_specific | - | yes | no | fallback khuon mau |
| `non_recommended_18` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_18` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `non_recommended_18` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_rewritten` | yes | no | no | - | delivery_main_topic_blocked | yes | no | rewrite nhe sau guard |
| `non_recommended_7` | `turn_1_price_budget` | `price_budget` | pass | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_7` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_7` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `non_recommended_7` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `non_recommended_13` | `turn_1_price_budget` | `price_budget` | pass | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_13` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_13` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `non_recommended_13` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `deterministic_fallback` | no | no | yes | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `non_recommended_24` | `turn_1_price_budget` | `price_budget` | pass | pass | `deterministic_fallback` | no | no | no | product_context_vague_not_specific | - | yes | no | fallback khuon mau |
| `non_recommended_24` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_24` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `non_recommended_24` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_rewritten` | yes | yes | yes | - | repeated_topic:price,generic_confirmation,final_guard | yes | yes | rewrite khoa vai khach |
| `non_recommended_3` | `turn_1_price_budget` | `price_budget` | pass | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_3` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | final_guard_forced | - | yes | no | fallback khuon mau |
| `non_recommended_3` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `non_recommended_3` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `non_recommended_12` | `turn_1_price_budget` | `price_budget` | pass | pass | `local_ai_generated` | no | no | no | - | - | no | no | on dinh |
| `non_recommended_12` | `turn_2_need_config_comparison` | `config_comparison` | n/a | pass | `deterministic_fallback` | no | no | no | product_context_vague_not_specific | - | yes | no | fallback khuon mau |
| `non_recommended_12` | `turn_3_stock_delivery_warranty` | `stock_delivery_warranty` | n/a | pass | `deterministic_fallback` | no | no | no | product_stock_out_of_stock | - | yes | yes | fallback khuon mau |
| `non_recommended_12` | `turn_4_next_step_or_closing` | `next_step_or_closing` | n/a | pass | `local_ai_rewritten` | yes | yes | yes | - | repeated_topic:price,generic_confirmation,final_guard | yes | yes | rewrite khoa vai khach |

## 7. Source distribution counts and percentages

- total target slots tested: `12`
- total customer-start calls: `12`
- customer-start pass: `12/12`
- total chat calls: `48`
- chat pass: `48/48`
- timeout: `0`
- error: `0`
- local_ai_generated: `10` (20.8%)
- local_ai_rewritten: `9` (18.8%)
- deterministic_fallback: `29` (60.4%)
- safety repairs: `9` (18.8%)
- buyer-role repairs: `7` (14.6%)
- salutation repairs: `8` (16.7%)

## 8. Low-human risk by source

- deterministic_fallback: 29
- local_ai_rewritten: 9
- local_ai_generated: 1

## 9. Low-human risk by turn

- turn_2_need_config_comparison: 12
- turn_4_next_step_or_closing: 10
- turn_3_stock_delivery_warranty: 9
- turn_1_price_budget: 8

## 10. Fallback/rewrite concentration by slot

- non_recommended_18: 4
- non_recommended_24: 4
- recommended_4: 4
- recommended_6: 4
- non_recommended_12: 3
- non_recommended_13: 3
- non_recommended_16: 3
- non_recommended_3: 3
- recommended_3: 3
- recommended_5: 3
- non_recommended_7: 2
- recommended_8: 2

## 11. Fallback/rewrite concentration by turn topic

- turn_2_need_config_comparison: 12
- turn_4_next_step_or_closing: 10
- turn_3_stock_delivery_warranty: 9
- turn_1_price_budget: 7

## 12. Interpretation

- Fallback-heavy actually high: YES
- Source causing most low-human risk: `deterministic_fallback`
- Most robotic turn: `turn_2_need_config_comparison`
- Patch 2 main focus: responseBank + conversationCompletion
- Preserve more local_ai_generated replies: YES
- Soften deterministic fallback text: YES
- Narrow rewrite triggers: NO

## 13. Recommended Patch 2 focus

1. Preserve acceptable `local_ai_generated` replies whenever no severe guard fires.
2. Reduce robotic cadence in deterministic fallback phrasing before widening any other patch scope.
3. Narrow rewrite paths only after fallback phrasing is softened and source distribution is rechecked.
4. Keep buyer-role and salutation lock intact; current issue is naturalness, not role safety.

## 14. Known limitations

- Same 12-slot targeted gate only
- Metadata-only audit; no full reply text retained
- Low-human risk is inferred from source path + visible runtime flags, not human annotation text

## 15. Final verdict

Verdict: **FALLBACK_HEAVY_CONFIRMED**

Pragmatic conclusion:

- Patch 1 solved salutation/buyer-role drift on the target subset.
- Remaining issue is now source-path naturalness concentration, not safety regression.
- REPORT_43B should be reviewed before Patch 2 so scope stays narrow and evidence-based.