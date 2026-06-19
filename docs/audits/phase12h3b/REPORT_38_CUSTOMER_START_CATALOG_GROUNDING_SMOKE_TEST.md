# REPORT 38 - Customer-start Catalog Grounding Smoke Test

- Timestamp: 2026-06-19 Asia/Bangkok
- Git commit tested: `dd10fd1`
- Scope: focused manual/local smoke for `customer-start` only

## 1. Server status

- Local server status: `PASS`
- Tested URL: `http://localhost:3009/`
- API version: `phase11-training-personas`
- Persona count: `38`
- Recommended count: `9`

Notes:

- Existing local server on `3009` was alive but appeared stale relative to the newly pushed patch.
- A local playground restart was performed to ensure the smoke test reflected commit `dd10fd1`.
- No external/cloud AI path was used.

## 2. Endpoint checks

Checked:

- `GET /api/version`: `PASS`
- `GET /api/personas`: `PASS`
- `POST /api/customer-start`: `PASS`
- `POST /api/chat`: `NOT CALLED`

## 3. Customer-start endpoint smoke metadata

Tested personas:

- recommended: `3`
- non-recommended: `2`
- total tested: `5`

Metadata table:

| Persona slot | Status | Reply | Source | Grounded | Candidates | Category | Model flag | Price flag | Stock flag | Length | Privacy | Raw stock | AI direct | Chat called |
|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|---|
| `recommended_1` | `200` | `true` | `catalog_grounded` | `true` | `3` | `true` | `true` | `true` | `true` | `medium` | `false` | `false` | `false` | `false` |
| `recommended_2` | `200` | `true` | `catalog_grounded` | `true` | `3` | `true` | `true` | `true` | `true` | `medium` | `false` | `false` | `false` | `false` |
| `recommended_3` | `200` | `true` | `catalog_grounded` | `true` | `3` | `true` | `true` | `true` | `true` | `long` | `false` | `false` | `false` | `false` |
| `non_recommended_1` | `200` | `true` | `catalog_grounded` | `true` | `3` | `true` | `true` | `true` | `true` | `medium` | `false` | `false` | `false` | `false` |
| `non_recommended_2` | `200` | `true` | `catalog_grounded` | `true` | `3` | `true` | `true` | `true` | `true` | `long` | `false` | `false` | `false` | `false` |

Endpoint grounding summary:

- tested persona count: `5`
- grounded count: `5`
- fallback count observed in endpoint smoke: `0`
- average candidate_count: `3.0`

## 4. UI customer-start smoke metadata

UI-tested personas:

- recommended: `2`
- non-recommended: `1`
- total UI tested: `3`

UI metadata table:

| Persona slot | Opening visible | Length | Buyer-like | Product/category grounded feel | Raw stock visible | Prompt visible | Reasoning visible | Catalog dump visible | Privacy issue | Persona detail visible | Chat called |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `recommended_ui_1` | `true` | `medium` | `true` | `false` | `false` | `false` | `false` | `false` | `false` | `true` | `false` |
| `recommended_ui_2` | `true` | `long` | `false` | `true` | `false` | `false` | `false` | `false` | `false` | `true` | `false` |
| `non_recommended_ui_1` | `true` | `medium` | `true` | `true` | `false` | `false` | `false` | `false` | `false` | `true` | `false` |

UI summary:

- opening appears: `3/3`
- raw stock quantity shown: `0/3`
- prompt shown: `0/3`
- reasoning shown: `0/3`
- full product catalog dump seen: `0/3`
- obvious privacy issue seen: `0/3`

Interpretation:

- UI customer-start path is functioning and displays grounded openings.
- The simple buyer-like heuristic is not perfect (`recommended_ui_2` = false), but this is a detector limitation, not direct evidence of seller-tone failure.
- The simple product/category-grounded heuristic is also conservative (`recommended_ui_1` = false) because it only flags visible product/category term cues, not all grounded phrasings.

## 5. Fallback sanity check

Observed directly in this smoke set:

- fallback path observed live: `NO`

Validated previously from focused patch validation metadata:

- fallback path available: `YES`
- fallback source type previously validated: `persona_template`
- `product_grounding_used = false`
- `candidate_count = 0`

Conclusion:

- fallback behavior remains available
- current smoke sample simply did not hit fallback because current persona coverage is high

## 6. Grounding summary

+------------------------------------------+-------+
| Metric                                   | Value |
+------------------------------------------+-------+
| tested endpoint personas                 | 5     |
| grounded endpoint personas               | 5     |
| endpoint fallback observed               | 0     |
| average endpoint candidate_count         | 3.0   |
| tested UI personas                       | 3     |
| UI openings visible                      | 3     |
| UI privacy issues observed               | 0     |
| UI raw stock exposure observed           | 0     |
+------------------------------------------+-------+

## 7. Safety/privacy checks

- full customer-start replies stored in report: `NO`
- full product data printed: `NO`
- full persona content printed: `NO`
- prompt text printed: `NO`
- reasoning text printed: `NO`
- raw stock_qty exposed: `NO`
- raw/session/evidence content printed: `NO`

## 8. AI usage status

- Qwen/local AI called directly by this smoke test: `NO`
- `/api/chat` called by this smoke test: `NO`
- external/cloud AI called: `NO`

## 9. Issues found

1. Local server had to be restarted to reflect the latest customer-start patch.
- Before restart, `/api/customer-start` appeared to return the older response shape without new grounding metadata.
- After restart, the new metadata was present and consistent.

2. UI buyer-like/product-grounded heuristics are coarse.
- They are suitable for smoke-level metadata only.
- They should not be treated as linguistic scoring or final behavior evaluation.

## 10. Demo readiness verdict

Customer-start catalog grounding ready for demo: `YES`

Reason:

- endpoint path passes
- UI customer-start path passes
- grounding metadata is present
- no privacy leak observed
- no raw stock quantity exposure observed
- no AI/chat dependency was needed for this smoke gate

## 11. Recommended next step

Recommended next step:

1. review `REPORT_38`
2. commit `REPORT_38` only
3. keep `/api/chat` unchanged for now
4. if needed, do a separate audit/plan for stronger buyer-voice/product-specific realism in chat, not in customer-start
