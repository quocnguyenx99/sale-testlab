# REPORT 32 - Phase 11b Playground QA Audit Plan

Timestamp: 2026-06-19

## 1. Current confirmed state

- Phase 10d checkpoint committed and pushed.
- Latest pushed commit: `5a8fa2e fix(phase10d): harden enriched persona logging`
- Working tree was clean before this report.
- Phase 11b has not been run in this step.
- No Phase 11b source file was modified in this step.

## 2. Files inspected

- `src/run-phase11b.ts`
- `src/playground/server.ts`
- `src/runtime/runtimeSessionManager.ts`
- `package.json`

## 3. What Phase 11b currently does

Phase 11b is a local playground QA runner.

Primary inputs:
- `sale-testlab-data/10d_training_personas_enriched/<month>/training_personas_enriched.jsonl`
- `sale-testlab-data/10d_training_personas_enriched/<month>/training_persona_identity_summary.json`

Primary outputs:
- `sale-testlab-data/11b_playground_qa/<month>/playground_qa_report.json`
- `sale-testlab-data/11b_playground_qa/<month>/playground_qa_summary.json`

High-level flow:
1. Read enriched training personas.
2. Select candidate personas for QA.
3. Call local playground endpoints.
4. Score endpoint availability / version / persona coverage / chat behavior.
5. Persist QA report + summary.

## 4. Whether Phase 11b calls local AI

Phase 11b does not call Qwen/local AI directly in `src/run-phase11b.ts`.
It calls the local playground server over HTTP:
- `GET /api/personas`
- `GET /api/version`
- `POST /api/customer-start`
- `POST /api/chat`

The playground server then calls local AI indirectly inside `src/playground/server.ts` via
runtime generation paths such as `generateLocalAIReply(...)`.

Conclusion:
- Direct AI call in Phase 11b runner: NO
- Indirect local AI call through playground server: YES
- External/cloud AI call: not indicated by current runner, but runtime endpoint policy must remain local-only

## 5. Required preconditions before Phase 11b run

Required:
- `10d_training_personas_enriched/<month>` exists and is current.
- Local playground server is running.
- Local server endpoint is reachable on `http://localhost:3009` unless overridden.
- Local AI endpoint policy remains private/local only.

Operational dependency:
- `npm run playground`
- then `npm run phase11b -- --month=<month>` or direct `tsx src/run-phase11b.ts`

## 6. Phase 11b code and privacy audit findings

### 6.1 Runner IO pattern

`src/run-phase11b.ts` currently uses a `readJsonl()` helper based on:
- `fs.readFileSync(..., "utf8")`
- `.split(/\r?\n/)`

Risk:
- full-file read into memory
- acceptable for moderate files, but not hardened like Phases 3-7b

### 6.2 Saved artifact risk

`playground_qa_report.json` currently stores endpoint test records containing masked text fields:
- `sale_message: maskText(...)`
- `customer_reply: maskText(...)`

These are masked, not raw full text.
However, this still exceeds a strict metadata-only reporting policy.

Risk classification:
- raw data leak: not observed
- strict metadata-only compliance: not yet satisfied

### 6.3 Playground server response surface

`src/playground/server.ts` currently exposes rich persona fields in `/api/personas`, including:
- display name
- role / org context
- behavior rules
- opening messages
- likely questions
- objection patterns
- closing conditions
- training focus
- evidence summary

Risk:
- wide persona payload exposure in local UI/API
- not necessarily unsafe for local-only use, but broader than needed for QA gating

### 6.4 Prompt/reply plumbing risk in server

`src/playground/server.ts` contains runtime metadata paths including fields such as:
- `raw_model_reply`
- `final_reply`
- `completion_forced_reply`

This audit step did not find evidence of unsafe console dumping in the current run path.
But these fields confirm that the server has access to full generated content internally.

Risk:
- if Phase 11b is run without tightening artifacts/logging, QA outputs may retain more text than desired

### 6.5 Console logging

Current Phase 11b runner console output appears metadata-only.
Current playground startup logs also appear metadata-only.

Observed safe pattern:
- counts
- endpoint status
- output paths

Not observed in this audit:
- raw prompt dump to console
- full model reply dump to console

## 7. Recommendation: run as-is or patch first?

Recommendation: PATCH FIRST before running Phase 11b under the current privacy standard.

Reason:
- Phase 11b artifacts still store masked request/reply snippets.
- `/api/personas` returns a broader persona payload than Phase 11b QA strictly needs.
- Runner input loading is not memory-hardened.

This is not a blocker for a local developer-only smoke test.
It is a blocker for a privacy-tight audit-compliant Phase 11b execution.

## 8. Exact hardening needed before Phase 11b run

Recommended minimum hardening scope:

1. `src/run-phase11b.ts`
- replace saved masked text snippets with metadata-only fields
- keep counts, flags, status, latency, endpoint pass/fail
- avoid persisting `sale_message` and `customer_reply` even in masked form
- consider stream-safe JSONL input if enriched file size is large enough to matter

2. `src/playground/server.ts`
- verify endpoint responses used by QA do not require full persona detail surface
- if possible, narrow QA-facing persona payload to metadata-safe fields for the runner path
- verify no prompt/reply text is persisted into QA artifacts indirectly

3. Optional hardening
- add explicit metadata-only mode for Phase 11b
- add local endpoint validation similar to Phase 8 / 8c privacy gates

## 9. Exact safe command sequence for later Phase 11b work

Recommended later sequence after hardening review:

1. Audit current git status
- `git status --short`

2. Patch Phase 11b privacy/logging scope
- likely files:
  - `src/run-phase11b.ts`
  - `src/playground/server.ts`

3. Validate without broad run first
- a narrow local dry-run or metadata-only check if implemented

4. Start local playground server
- `npm run playground`

5. Run Phase 11b on approved month
- `npx tsx src/run-phase11b.ts --month=2026-03`

6. Review only metadata artifacts
- `playground_qa_report.json`
- `playground_qa_summary.json`

## 10. What must not be run yet

Do not run yet:
- real `phase11b` against current code if strict metadata-only policy must hold
- any wider/full-month QA expansion without first hardening artifacts
- unrelated downstream phase execution
- any cleanup of generated artifacts

## 11. Final audit decision

Current decision:
- Phase 11b code path exists and is operationally clear.
- Phase 11b is not yet in the same privacy-tight state as hardened Phase 8 / 8c / 10 / 10c / 10d checkpoints.
- Safe next move is Phase 11b hardening review and minimal patch plan, not immediate execution.

## 12. Safe proceed status

- Safe to proceed to Phase 11b hardening review: YES
- Safe to run Phase 11b immediately without patch: NO
- Source files changed in this audit step: NO
- Report created in this step: YES
