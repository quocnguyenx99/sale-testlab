# REPORT 37 - Customer-start Product Grounding Patch

- Timestamp: 2026-06-19 Asia/Bangkok
- Git commit inspected: `399954e`
- Audit/patch mode: local-only, metadata-only

## 1. Files inspected

- `D:\Workspace\sale-testlab-data-pipeline\src\playground\server.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\customerOpeningBuilder.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\productScenarioCatalog.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\productKnowledge\productKnowledge.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\productKnowledge\product_knowledge.compact.json` (metadata only)
- `D:\Workspace\sale-testlab-data-pipeline\sale-testlab-data\10d_training_personas_enriched\2026-03\training_personas_enriched.jsonl` (metadata only)

## 2. Source files changed

- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\customerOpeningBuilder.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\playground\server.ts`

## 3. Customer-start flow before patch

Previous flow:

- `server.ts` -> `handleCustomerStartEnriched(...)`
- `handleCustomerStartEnriched(...)` -> `buildCustomerOpeningEnriched(ep)`
- `buildCustomerOpeningEnriched(...)`:
  - choose static scenario from `PRODUCT_SCENARIOS`
  - choose static `opening_templates`
  - fallback to `VOICE_OPENINGS_DEFAULT` only for placeholder/pronoun issues
- response metadata did not say whether opening was catalog-grounded

Result before patch:

- customer-start was persona-driven + static scenario/opening template first
- no direct local product candidate grounding step

## 4. Customer-start flow after patch

Current flow:

- `server.ts` -> `handleCustomerStartEnriched(...)`
- `handleCustomerStartEnriched(...)` -> `buildCustomerOpeningEnriched(ep)`
- `buildCustomerOpeningEnriched(...)` now does:
  1. choose persona-aligned scenario using existing deterministic scenario scoring
  2. derive catalog queries from `product_interest_categories`
  3. run local deterministic `searchProducts(...)`
  4. select up to 3 unique local candidates
  5. if at least 1 candidate exists:
     - pick one candidate deterministically
     - ground `scenario_context.scenario_product` from local catalog candidate
     - build opening from existing voice template family
     - mark `opening_source_type = catalog_grounded`
  6. if no candidate exists:
     - fall back to previous static scenario/opening template path
     - still preserve old `VOICE_OPENINGS_DEFAULT` fallback when needed

Behavior change:

- from: `persona + static template first`
- to: `persona + local product candidate first`
- fallback path preserved

## 5. Product knowledge source used

Local source used:

- `src/runtime/productKnowledge/product_knowledge.compact.json`

Lookup logic used:

- `src/runtime/productKnowledge/productKnowledge.ts`
- function: `searchProducts(query, { limit })`

Local-only and deterministic status:

- local file-based lookup: `YES`
- network/external AI call: `NO`
- deterministic for same persona input: `YES`

## 6. Persona/product field usage

Persona fields used for grounding:

- `persona_id`
- `product_interest_categories`
- existing scenario-scored persona context
- existing identity/voice routing

Safe product fields used internally:

- `display_name`
- `brand`
- `category1`
- `category2`
- `price_si` presence only
- `price_le` presence only
- `stock_status` presence only

Not exposed:

- raw `stock_qty`
- full `specs`
- full product JSON rows
- warehouse/internal business rules

## 7. Coverage measurement

Coverage source month:

- `2026-03`

Coverage counts:

+--------------------------------------+-------+
| Metric                               | Value |
+--------------------------------------+-------+
| total_persona_count                  | 38    |
| recommended_persona_count            | 9     |
| personas_with_candidate_count        | 38    |
| recommended_with_candidate_count     | 9     |
| personas_with_3_candidates_count     | 38    |
| no_candidate_count                   | 0     |
| all_recommended_have_candidate       | true  |
+--------------------------------------+-------+

Category match distribution counts only:

+----------------------+-------+
| Category             | Count |
+----------------------+-------+
| Màn hình             | 38    |
| Máy tính để bàn      | 38    |
| Máy tính xách tay    | 38    |
| Workstation          | 26    |
| Máy in               | 12    |
+----------------------+-------+

Interpretation:

- current 38 enriched personas have strong candidate coverage under existing category labels
- all 9 recommended personas have at least 1 candidate
- all 38 currently reach 3 candidates under the local search path

## 8. Metadata fields added

Added to `customer-start` response:

- `opening_source_type`
  - `catalog_grounded`
  - `persona_template`
  - `fallback_template`
- `product_grounding_used`
- `candidate_count`
- `selected_catalog_category`
- `selected_catalog_model_present`
- `selected_catalog_price_available`
- `selected_catalog_stock_status_present`

Important:

- no full product record added to response
- no raw stock quantity added to response

## 9. Safety and privacy rules applied

Preserved:

- Runtime Contract unchanged
- `/api/chat` logic unchanged
- `responseBank.ts` unchanged
- `safetyGuards.ts` unchanged
- `PRODUCT_SCENARIOS` preserved
- `VOICE_OPENINGS_DEFAULT` preserved
- fallback behavior preserved

Protected:

- no prompt text printed
- no full reply text printed in validation output
- no reasoning text printed
- no full persona content printed
- no full product rows printed
- no raw stock quantity exposed

## 10. Validation commands run

Coverage + deterministic validation:

- temporary local TSX coverage/validation scripts
- removed after execution

Focused endpoint validation:

- local temporary server start on port `3010`
- `GET /api/version`
- `POST /api/customer-start`
- no `/api/chat` call

## 11. Validation results

### 11.1 Determinism and fallback

+--------------------------------------+--------------------+
| Validation item                      | Result             |
+--------------------------------------+--------------------+
| deterministic_pass                   | true               |
| grounded_persona_count               | 38                 |
| recommended_grounded_count           | 9                  |
| opening_source_counts.catalog_grounded | 38               |
| synthetic_fallback_source_type       | persona_template   |
| synthetic_fallback_grounding_used    | false              |
| synthetic_fallback_candidate_count   | 0                  |
+--------------------------------------+--------------------+

Interpretation:

- real enriched personas are now catalog-grounded under current coverage
- fallback still remains reachable when a persona has no product categories/candidates

### 11.2 Customer-start endpoint-only validation

+--------------------------------------+------------------+
| Validation item                      | Result           |
+--------------------------------------+------------------+
| endpoint_ready                       | true             |
| api_version                          | phase11-training-personas |
| reply_present                        | true             |
| opening_source_type                  | catalog_grounded |
| product_grounding_used               | true             |
| candidate_count                      | 3                |
| selected_catalog_category_present    | true             |
| selected_catalog_model_present       | true             |
| selected_catalog_price_available     | true             |
| selected_catalog_stock_status_present| true             |
| reply_source                         | deterministic_fallback |
| ai_called                            | false            |
| chat_called                          | false            |
+--------------------------------------+------------------+

## 12. Qwen/local AI and chat usage status

- Qwen/local AI called: `NO`
- `/api/chat` called: `NO`
- external/cloud AI called: `NO`

## 13. Whether full content was printed

- full product data printed: `NO`
- full persona data printed: `NO`
- full prompt text printed: `NO`
- full reply text printed: `NO`
- reasoning text printed: `NO`

## 14. Whether fallback behavior remains

Fallback behavior remains: `YES`

Paths preserved:

- `persona_template`
- `fallback_template`

Observed explicitly:

- synthetic no-category validation still falls back without grounding

## 15. Known limitations

1. Current 38 enriched personas have very broad category coverage.
- This makes catalog grounding almost universal in the current sample.
- Larger/future persona sets may expose weaker coverage.

2. Customer-start is now catalog-first but still template-rendered.
- It is not using Qwen.
- It is not generating from full catalog semantics.

3. `/api/chat` remains reactive.
- It still relies on sale-message-triggered product extraction/search.
- This patch intentionally does not change that path.

4. Structured warranty/delivery/warehouse resources are still not integrated.
- Those remain prompt/guard-level logic only.

## 16. Recommended next step

Recommended next step:

1. review patch and metadata fields
2. commit source + `REPORT_37`
3. run a focused manual smoke test for `customer-start` grounding only
4. only after that, decide whether to improve persona-to-runtime-persona mapping or structured resource integration
