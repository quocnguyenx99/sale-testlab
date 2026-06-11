# Phase 8/8c Local Qwen Privacy and Execution Plan

## 1. Readiness Status
- Phase 8/8c readiness: NO.
- Hardening is required before any run.
- Qwen/local AI must not be called until privacy-safe input/output boundaries are enforced.
- Runtime Contract Phase 12H remains unchanged.

## 2. Current Script Audit
### src/run-phase8.ts
- Current input: `sale-testlab-data/07_runtime_personas/<month>/runtime_personas.jsonl`
- Current behavior: reads full JSONL, builds prompt bundle, calls local AI, writes preview/audit/prompt artifacts.
- Current risks:
  - stores prompt dumps and output previews
  - stores full reply artifacts
  - no strict endpoint gate
  - no input-source switch for archetypes
  - no dry-run path that avoids local AI

### src/run-phase8c.ts
- Current input: `sale-testlab-data/07_runtime_personas/<month>/runtime_personas.jsonl`
- Current behavior: evaluates multiple scenarios per persona and writes results, summary, audit.
- Current risks:
  - stores `model_reply`
  - stores best/worst reply text
  - no strict endpoint gate
  - no dry-run-only protection in current state
  - no metadata-only result contract

## 3. Allowed Inputs
- Only approved sanitized/anonymized runtime records or archetype surrogates.
- Preferred first-run source: `sale-testlab-data/07b_persona_archetypes/<month>/persona_archetypes.jsonl`
- Allowed prompt-safe fields:
  - hashed/anonymized id only
  - readiness tier
  - summarized behavior profile
  - summarized interaction pattern names
  - summarized constraints/risk tags
  - runtime state tag
  - synthetic seed message generated locally

## 4. Disallowed Inputs
- Raw Zalo `.txt`
- `messages.jsonl`
- `messages_classified.jsonl`
- `sessions.jsonl`
- behavior/context/evidence payloads with raw text
- `evidence_texts`
- `source_entity_id`
- file names, conversation ids, message ids
- full persona JSON with trace/source identifiers
- prompt dumps or full reply dumps

## 5. Recommended First-Run Input
- Use `persona_archetypes`, not `runtime_personas`.
- First sample strategy:
  - maximum 5 archetypes
  - metadata-only outputs
  - exclude weak archetypes
  - exclude outliers
  - exclude archive-only records
- Rationale:
  - smaller safer input set
  - easier privacy review
  - lower blast radius before any real AI call

## 6. Phase 8 Later Strategy
- First real sample after hardening:
  - input source: `archetypes`
  - limit: 5 records
  - batch size: 1
  - concurrency: 1
  - timeout: 30000 ms
  - retry count: 1
  - metadata-only outputs only

## 7. Phase 8c Later Strategy
- Do not run in the current hardening task.
- First planned later execution:
  - 5 archetypes
  - 3 core scenarios
  - pricing / research / logistics
  - metadata-only results
  - no prompt text
  - no full reply text
  - no best/worst reply text

## 8. Endpoint Gate
- Allow only:
  - `localhost`
  - `127.0.0.1`
  - `::1`
  - RFC1918 private IPv4
- Block:
  - public IPs
  - public domains
  - private DNS/domain names except localhost
  - invalid URLs
  - non-http/non-https protocols
- Endpoint must be validated before any possible AI call.

## 9. Backup and Rollback Rule
- Before writing into `sale-testlab-data/08_runtime_simulator/<month>/`, move stale files to:
  - `sale-testlab-data/_backup/phase8_stale_before_privacy_hardening_<month>_<timestamp>/08_runtime_simulator/<month>/`
- Create `BACKUP_NOTE.md` with metadata only.
- Never delete stale outputs permanently in this phase.

## 10. Validation Gates
- Dry-run must:
  - read selected records safely
  - sanitize records
  - validate endpoint config
  - detect blocked/disallowed fields
  - write metadata-only outputs
  - avoid all AI calls
- Pass conditions:
  - endpoint gate passes for local/private URL
  - no disallowed fields remain in sanitized payload
  - no prompt text written
  - no reply text written
  - `ai_called = false`

## 11. Stop Conditions
- Any blocked/disallowed field remains in sanitized payload
- Endpoint resolves to public IP/domain
- Any prompt dump or reply dump would be written
- Any runner would call local AI during dry-run
- Any output would contain source identifiers or raw-like free text

## 12. Warning
- `overweighted_patterns_detected = 8,429`
- This is a quality review warning and must remain visible before scaling persona usage.

## 13. Conclusion
- Do not run Phase 8 or Phase 8c before hardening.
- Implement privacy hardening first.
- Run dry-run validation only.
- Only after clean dry-run should a separate approved real Phase 8 sample be executed.
