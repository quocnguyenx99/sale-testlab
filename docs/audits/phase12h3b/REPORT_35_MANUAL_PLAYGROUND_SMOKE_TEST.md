# REPORT 35 - Manual Playground Smoke Test

Timestamp: 2026-06-19

## 1. Git commit tested

- Tested commit: `a92ecd9 docs(playground): add persona inventory and phase status audit`

## 2. Server status

- Server command status: existing local playground server already alive; no duplicate server started in this step
- Playground URL: `http://localhost:3009/`
- Port: `3009`

API checks:
- `GET /api/version`: `200`
- `GET /api/personas`: `200`
- `playground_version = phase11-training-personas`
- `persona_count = 38`
- `recommended_count = 9`
- version latency observed: `2452 ms`
- personas latency observed: `14 ms`

## 3. UI metadata checks

Result:
- Page load: PASS
- Personas shown: PASS
- Persona count consistent with API: PASS
- Recommended personas appear first: PASS
- Runtime IDs hidden by default: PASS
- Persona labels usable for manual selection: PASS
- No raw/private data visibly exposed in tested UI path: PASS
- No prompt text visibly exposed in tested UI path: PASS
- No reasoning text visibly exposed in tested UI path: PASS
- Version string visibly shown in UI: NO

Notes:
- UI branch/version was confirmed through API, not by a visible page label.
- Browser console showed only one non-blocking error:
  - missing `favicon.ico` (`404`)

## 4. Manual smoke-test scope

- Personas manually tested: `3`
- Recommended personas tested: `2`
- Non-recommended personas tested: `1`
- Customer-start checks: `3`
- Chat checks: `3`

## 5. Customer-start metadata table

| Persona slot | Pass | Response present | Length bucket | Style basic match | Privacy visible issue | Note |
|---|---|---|---|---|---|---|
| `recommended_1` | `true` | `true` | `medium` | `true` | `false` | visible response, no quote stored |
| `recommended_2` | `true` | `true` | `medium` | `true` | `false` | visible response, no quote stored |
| `non_recommended_1` | `true` | `true` | `medium` | `true` | `false` | visible response, no quote stored |

## 6. Chat metadata table

| Persona slot | Scenario | Pass | Response present | Length bucket | Vietnamese-like | Persona consistency | Loop detected | Privacy visible issue |
|---|---|---|---|---|---|---|---|---|
| `recommended_1` | `pricing` | `true` | `true` | `medium` | `true` | `true` | `false` | `false` |
| `recommended_2` | `comparison` | `true` | `true` | `short` | `true` | `true` | `false` | `false` |
| `non_recommended_1` | `logistics` | `true` | `true` | `medium` | `true` | `true` | `false` | `false` |

## 7. Pass/fail summary

- Customer-start overall: `3/3 PASS`
- Chat overall: `3/3 PASS`
- UI smoke path overall: `PASS`
- Manual playground smoke test overall: `PASS`

## 8. Local AI / external AI status

Observed in tested path:
- Local AI/Qwen called directly by tester: `NO`
- Local AI/Qwen used indirectly through local playground/API path: `YES`
- External/cloud AI observed: `NO`

Observed reply-source metadata from local API path:
- customer-start replies in tested set: deterministic opening path observed
- chat replies in tested set: local AI generation path observed
- one tested chat reply came through a local rewrite path after generation

## 9. Terminal / log privacy check

Browser console:
- full prompt printed: `NO`
- full reply printed: `NO`
- full persona content printed: `NO`
- reasoning printed: `NO`
- raw/private data printed: `NO`

Server terminal log visibility in this step:
- direct server stdout capture: `UNAVAILABLE IN THIS THREAD`
- unsafe server-side text dump observed from available evidence: `UNKNOWN`

Practical interpretation:
- no unsafe text was observed in browser UI or browser console during this smoke test
- server stdout should still be spot-checked in a dedicated log-capture session if stricter operational sign-off is required

## 10. What is proven by this manual smoke test

Proven:
- enriched `2026-03` persona branch is selectable in the local playground UI
- recommended personas are surfaced first
- customer-start works on recommended and non-recommended samples
- chat works on pricing, comparison, and logistics sample scenarios
- responses appeared in UI and were consistent with basic buyer-style expectations in tested cases
- no visible prompt/reasoning/raw-data leak was observed in tested UI/browser-console path

Not fully proven:
- broader long-form conversational quality across the full 38-persona set
- stronger UX review for persona detail density and operator usability
- server stdout cleanliness under dedicated captured logging
- broader edge-case coverage beyond the 3 sampled manual cases

## 11. Ready-for-demo assessment

- Ready for practical local demo: `YES`
- Confidence level: `moderate`

Reason:
- automated gates had already passed
- this manual smoke test passed on recommended and non-recommended samples
- remaining uncertainty is coverage depth, not basic branch usability

## 12. Issues found

Metadata-only issues:
- UI does not visibly show the branch/version label, so verification depends on API/version endpoint
- browser requested `favicon.ico` and received `404`; non-blocking
- server stdout was not directly captured in this thread, so terminal-log privacy is not fully signed off here

## 13. Recommended next step

Recommended order:
1. Review `REPORT_35`.
2. If accepted, commit the report.
3. Optionally run a short dedicated server-log capture check in a separate step if terminal privacy sign-off is required.
4. Then proceed to controlled local demo / stakeholder review.
