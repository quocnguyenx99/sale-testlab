# REPORT 36 - Customer AI Product/Resource Usage Audit

- Timestamp: 2026-06-19 Asia/Bangkok
- Git commit inspected: `a92ecd9`
- Audit mode: metadata-only, no AI call, no playground chat execution, no source change

## 1. Files inspected

- `D:\Workspace\sale-testlab-data-pipeline\src\playground\server.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\customerOpeningBuilder.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\runtimePromptBuilder.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\conversationMemory.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\productScenarioCatalog.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\productKnowledge\productKnowledge.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\productKnowledge\normalize_products.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\responseBank.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\runtime\runtimeSessionManager.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\pipeline\trainingPersonaIdentityBuilder.ts`
- `D:\Workspace\sale-testlab-data-pipeline\src\run-phase11b.ts`
- `D:\Workspace\sale-testlab-data-pipeline\package.json`
- `D:\Workspace\sale-testlab-data-pipeline\docs\audits\phase12h3b\REPORT_34_PERSONA_INVENTORY_SCENARIO_AND_PHASE12H3_STATUS.md`
- `D:\Workspace\sale-testlab-data-pipeline\docs\audits\phase12h3b\REPORT_35_MANUAL_PLAYGROUND_SMOKE_TEST.md`

## 2. Executive conclusion

Kết luận hiện tại:

- `customer-start`: persona-driven + static scenario/opening templates
- `/api/chat`: hybrid = enriched persona fields + runtime state/progress + local product knowledge grounding
- Full product/resource catalog is NOT driving the first opening turn directly
- Product/resource data is used reactively during chat, mainly after Sale message triggers product extraction/search

Phân loại tổng thể:

- Current conclusion: `hybrid`
- But bias is still: `persona-first`, not `catalog-first`

## 3. Customer-start data flow

### 3.1 Runtime path

Path observed:

- `server.ts` -> `handleCustomerStartEnriched(...)`
- `handleCustomerStartEnriched(...)` -> `buildCustomerOpeningEnriched(ep)`
- returned opening -> stored into session -> returned as API reply

### 3.2 Data sources used

Customer-start currently uses:

- enriched persona record from `10d_training_personas_enriched/<month>/training_personas_enriched.jsonl`
- fields such as:
  - `display_name`
  - `buyer_role`
  - `product_interest_categories`
  - `behavior_rules`
  - `purchase_context`
  - `runtime_contexts`
- static scenario catalog from `productScenarioCatalog.ts`
- static voice/opening fallback templates from `customerOpeningBuilder.ts`

### 3.3 Data sources NOT used directly

Customer-start does NOT directly use:

- local Qwen
- `productKnowledge.searchProducts(...)`
- `productKnowledge.extractProductMentions(...)`
- `product_knowledge.compact.json` lookup
- warehouse/inventory engine
- runtime product candidate grounding
- runtime memory product selection

### 3.4 Evidence summary

File/function references only:

- `src/playground/server.ts`
  - `handleCustomerStartEnriched(...)`
  - uses `buildCustomerOpeningEnriched(ep)`
  - returns `reply_source: "deterministic_fallback"`
- `src/runtime/customerOpeningBuilder.ts`
  - `findScenario(...)`
  - `buildCustomerOpeningEnriched(...)`
- `src/runtime/productScenarioCatalog.ts`
  - `PRODUCT_SCENARIOS`
  - `FALLBACK_SCENARIO`

## 4. Does customer-start use enriched opening messages or old generic samples?

### 4.1 Enriched persona source

The playground primary persona source is confirmed as:

- `sale-testlab-data/10d_training_personas_enriched/<month>/training_personas_enriched.jsonl`

This is loaded in:

- `src/playground/server.ts`
  - `ENRICHED_FILE`
  - `sortedEnriched`
- `src/run-phase11b.ts`
  - checks `current_playground_persona_source_detected`

### 4.2 Opening generation behavior

However, customer-start does NOT appear to use `opening_messages` from enriched personas as the direct opening payload.

Observed behavior instead:

- opening is built from `buildCustomerOpeningEnriched(...)`
- scenario is chosen from static `PRODUCT_SCENARIOS`
- text is selected from `opening_templates`
- if placeholder/pronoun mismatch occurs, fallback goes to `VOICE_OPENINGS_DEFAULT`

### 4.3 Conclusion

So customer-start is:

- using enriched persona identity/context fields
- NOT clearly using enriched persona `opening_messages` as the primary first-turn source
- still relying on static scenario/opening template logic

## 5. /api/chat data flow

### 5.1 Runtime path

Path observed:

- `server.ts` -> `handleChatEnriched(...)`
- loads enriched persona `ep`
- maps runtime persona compatibility as `const rp = runtimePersonas[0]`
- updates memory via `updateMemorySlots(...)`
- updates progress via progress tracker
- routes state via runtime state router
- builds prompt via `buildEnrichedRuntimePrompt(...)`
- calls local AI generation path
- then applies safety guards / response bank / completion logic

### 5.2 Data sources used by /api/chat

/api/chat currently uses:

1. Enriched persona fields
- `role_prompt`
- `behavior_rules`
- `product_interest_categories`
- `purchase_context`
- `closing_conditions`
- `do_not_do`

2. Session/runtime state
- conversation progress
- memory slots
- identity profile
- recent messages
- scenario context from customer-start

3. Product grounding from local product knowledge
- seller message is parsed by `updateMemorySlots(...)`
- exact model extraction via `extractProductMentions(...)`
- fuzzy product lookup via `searchProducts(...)`
- matching candidates are injected into prompt as product context block

4. Deterministic fallback/guard systems
- response bank
- safety guards
- completion engine

### 5.3 Evidence summary

File/function references only:

- `src/playground/server.ts`
  - `handleChatEnriched(...)`
  - `const rp = runtimePersonas[0]`
  - `updateMemorySlots(memorySlots, message)`
  - `buildEnrichedRuntimePrompt(...)`
- `src/runtime/conversationMemory.ts`
  - `updateMemorySlots(...)`
- `src/runtime/runtimePromptBuilder.ts`
  - `formatProductCandidatesBlock(...)`
  - `buildEnrichedRuntimePrompt(...)`
- `src/runtime/productKnowledge/productKnowledge.ts`
  - `extractProductMentions(...)`
  - `searchProducts(...)`
- `src/runtime/responseBank.ts`
  - `buildResponseBankReply(...)`
- `src/runtime/safetyGuards.ts`
  - product-context and guard fallback logic

## 6. Product/resource/catalog data used or not used

### 6.1 Where catalog/resource data is loaded from

Product knowledge is loaded from local compact data file:

- `src/runtime/productKnowledge/product_knowledge.compact.json`

Loader/search code:

- `src/runtime/productKnowledge/productKnowledge.ts`

Normalization/source shape defined in:

- `src/runtime/productKnowledge/normalize_products.ts`

### 6.2 Fields available in local product knowledge

Observed structured fields:

- `model_code`
- `display_name`
- `brand`
- `category1`
- `category2`
- `price_si`
- `price_le`
- `stock_status`
- `stock_qty`
- `specs`
- `searchable_text`

### 6.3 What the customer AI can access in chat

Via prompt grounding, customer AI can receive product metadata including:

- product name / display name
- model code
- wholesale/retail price fields
- stock status
- internal stock quantity marker
- spec summary
- product context status: `unknown | vague | specific`

### 6.4 What is NOT clearly present as structured catalog/runtime data

Not clearly found as structured product-resource inputs for customer AI:

- warehouse-specific business rules
- delivery SLA table / shipping policy catalog
- warranty policy catalog per product
- invoice/business-rule catalog
- separate resource planner for stock allocation

These topics are currently handled more by:

- prompt rules
- conversation state gating
- deterministic guard/fallback logic

## 7. Are product names, models, prices, stock, warranty, delivery rules available?

+----------------------+-----------------------------+-------------------------------+
| Resource             | Available to chat AI?       | Notes                         |
+----------------------+-----------------------------+-------------------------------+
| Product name/model   | Yes                         | via product knowledge         |
| Model code           | Yes                         | via product knowledge         |
| Price                | Yes                         | `price_si`, `price_le`        |
| Stock status         | Yes                         | `stock_status`                |
| Stock quantity       | Partially/internal          | hidden marker, guard-protect  |
| Specs                | Yes                         | summarized in product block   |
| Warranty rules       | Not as catalog evidence     | mainly prompt/topic logic     |
| Delivery rules       | Not as catalog evidence     | mainly prompt/topic logic     |
| Warehouse rules      | Not found                   | no dedicated source observed  |
+----------------------+-----------------------------+-------------------------------+

## 8. Buyer-side use vs seller-side use

Current behavior suggests:

- customer AI uses product knowledge mainly as buyer-question grounding during chat
- it is NOT acting like a seller-side product assistant
- but product knowledge enters only after Sale message triggers model/category grounding
- customer-start does not proactively open from real product candidates

So the product catalog is currently used:

- reactively in buyer dialogue
- not proactively as the first-turn generator

## 9. Old sample/fallback data still used?

Yes.

Still present in current playground/runtime path:

1. Static scenario catalog
- `PRODUCT_SCENARIOS`
- `FALLBACK_SCENARIO`

2. Static opening fallbacks
- `VOICE_OPENINGS_DEFAULT`

3. Deterministic response fallbacks
- `responseBank.ts`
- topic fallback variants for price/stock/delivery/warranty/payment/etc.

4. Safety fallback/rewrites
- `safetyGuards.ts`
- deterministic fallback for consultant tone, stock leak, ambiguous model, delivery gating

5. QA-only sample messages
- `src/run-phase11b.ts` contains `sampleMessages`
- these are QA runner inputs only, not primary runtime prompt catalog

Conclusion:

- fallback/sample logic still exists
- but `/api/chat` is not limited to old generic samples only
- current runtime is hybrid with real local product grounding during chat

## 10. Runtime persona compatibility usage

Observed in `server.ts`:

- runtime personas are loaded from `07_runtime_personas/<month>/runtime_personas.jsonl`
- non-archive runtime personas are kept as compatibility/state-routing source
- chat currently uses `const rp = runtimePersonas[0]`

This implies:

- runtime persona usage in playground chat is compatibility/state-routing oriented
- it does not prove per-enriched-persona precise runtime-persona mapping
- primary dialogue persona is still the enriched 10d persona

## 11. Current architecture verdict

+----------------------------------+-----------------------------+
| Question                         | Verdict                     |
+----------------------------------+-----------------------------+
| Customer-start uses 10d persona? | Yes                         |
| Customer-start uses opening text | Indirect/static scenario    |
| Customer-start uses product DB?  | No direct evidence          |
| Chat uses enriched persona?      | Yes                         |
| Chat uses product knowledge?     | Yes                         |
| Chat uses warehouse rules?       | No clear evidence           |
| Chat uses old fallbacks?         | Yes, as guard/fallback path |
| Overall mode                     | Hybrid, persona-first       |
+----------------------------------+-----------------------------+

## 12. Gap analysis

Main gaps before saying customer AI is truly product/resource-driven:

1. Opening turn is not catalog-grounded
- first buyer question is chosen from static scenario templates
- no evidence of live product candidate selection during customer-start

2. Persona-to-runtime-persona mapping is still weak
- `runtimePersonas[0]` compatibility fallback is not a stable persona-specific mapping

3. Warranty/delivery/business policy are not sourced from structured resource catalogs
- they are controlled by prompt/guard logic, not grounded data

4. Catalog grounding is sale-message-triggered
- if Sale message is vague, product grounding is still limited
- product knowledge is more reactive than proactive

5. Static fallback inventory remains important
- response bank and safety guards still provide a significant deterministic safety net

## 13. Recommended next implementation options

### Option A - Minimal safe improvement

Add product candidate grounding to customer-start only.

Scope:

- before `buildCustomerOpeningEnriched(...)`, map persona interest categories to 1-3 local product candidates
- use those candidate categories/models to choose a more realistic opening topic
- keep fallback to current static scenario catalog if no safe match exists

Pros:

- smallest risk
- improves first-turn realism
- does not disturb `/api/chat` safety stack

### Option B - Stronger hybrid grounding

Add persona-to-product family binding for both start and chat.

Scope:

- bind enriched persona to preferred categories/model families at session init
- persist those candidate families in session memory
- feed them into both opening selection and later prompt grounding

Pros:

- stronger continuity across turns

Risk:

- more session/state complexity

### Option C - Full resource-driven buyer simulator

Introduce structured resource layers for:

- product
- warranty
- delivery/SLA
- invoice/payment rules
- stock availability policies

Pros:

- most realistic buyer behavior

Risk:

- broad scope
- higher privacy and maintenance burden
- not the safest immediate next step

## 14. Safest minimal patch plan

Recommended minimal plan:

1. Keep current Phase 12 runtime contract unchanged.
2. Do NOT rewrite `/api/chat` product grounding path first.
3. Add a lightweight local product lookup step inside customer-start path.
4. Use only safe structured fields:
   - category
   - model/display name
   - brand
   - price availability flag
   - stock availability flag
5. Do NOT inject raw stock quantity into opening logic.
6. Do NOT inject warehouse/internal business rules yet.
7. Preserve current `PRODUCT_SCENARIOS` and `VOICE_OPENINGS_DEFAULT` as fallback-only path.
8. Add metadata-only audit fields for customer-start:
   - opening_source_type
   - product_grounding_used
   - candidate_count
   - selected_catalog_category
   - selected_catalog_model_present

This is the safest next patch because it improves realism without weakening existing safety hardening.

## 15. Is product-resource integration required before broader demo?

Recommendation:

- For a limited internal demo: NOT strictly required
- For a broader demo where stakeholders expect realistic product-specific buyer behavior from turn 1: YES, recommended before scale-up

Reason:

- current smoke tests prove the system works
- but they do not prove the first turn is grounded in real catalog/resource inventory
- broader demos will notice generic/static opening behavior faster than internal QA will

## 16. What should not be changed yet

Do not change yet:

- Phase 12H safety guards
- response bank fallback policy
- privacy hardening in Phase 8 / 8c / 10 / 10c / 10d / 11b
- raw product knowledge file structure
- playground server persistence format
- full-month generation flow
- runtime contract wording

Avoid until customer-start grounding is proven:

- broad refactor of `/api/chat`
- warehouse/business-rule injection
- full prompt redesign
- aggressive removal of deterministic fallbacks

## 17. Final recommendation

Short answer:

- Customer-start is currently persona/scenario-template driven
- Chat is hybrid and does use local product knowledge
- The playground is NOT yet fully product-resource-driven end-to-end
- The next safest improvement is to ground customer-start against local product knowledge while preserving current fallback behavior

Decision:

- Broader demo without this change: possible but weaker
- Broader demo with stronger realism expectation: implement customer-start catalog grounding first
