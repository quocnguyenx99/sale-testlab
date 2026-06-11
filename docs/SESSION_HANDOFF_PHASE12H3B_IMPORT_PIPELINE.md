# Session Handoff - Phase 12H.3-B Import Pipeline

## 1. Current Phase Goal
- Import and process full 50-file March Zalo dataset.
- Preserve local-only privacy across raw, session, behavior, and derived pipeline outputs.
- Regenerate pipeline outputs from Phase 1 onward for month `2026-03`.
- Do not change Runtime Contract or runtime chat behavior while hardening deterministic pipeline stages.
- Do not call Qwen until safe anonymized persona/runtime stages are reached.

## 2. Privacy Rules To Preserve
- Raw Zalo must stay local.
- Do not print raw message content.
- Do not open raw files with `cat`, `head`, `type`, or `Get-Content`.
- Do not send raw/session/evidence data to external or cloud AI.
- Qwen/local AI must not receive raw files.
- Console logs must be metadata/counts only.
- `sale-testlab-data` is gitignored and must remain uncommitted.

## 3. Audit Reports Created
- `docs/audits/phase12h3b/REPORT_01_CODEBASE_AND_PHASE_STATUS.md`
- `docs/audits/phase12h3b/REPORT_02_PRIVACY_AND_DATA_SECURITY.md`
- `docs/audits/phase12h3b/REPORT_03_DATA_PIPELINE_READINESS.md`
- `docs/audits/phase12h3b/REPORT_04_LOCAL_AI_QWEN_READINESS.md`
- `docs/audits/phase12h3b/REPORT_05_RUNTIME_HEALTH_AND_LIVE_QA.md`
- `docs/audits/phase12h3b/REPORT_06_50_FILE_IMPORT_RECOMMENDATION.md`
- `docs/audits/phase12h3b/PHASE12H3B_AUDIT_INDEX.md`
- `docs/audits/phase12h3b/PHASE12H3B_IMPORT_EXECUTION_PLAN.md` is not present.

## 4. Dataset State
- Correct active raw folder: `sale-testlab-data/00_raw/zalo/2026-03/`
- Full dataset copied: `50` `.txt` files
- Total raw size verified: `266,772,065 bytes`
- Unexpected extensions: `0`
- Direct dry-run command used:
  - `npx tsx src/run-phase1.ts --month=2026-03 --dry-run`
- Dry-run detected `50` files, `254.41 MB` script display, no raw content printed, no output written.
- `npm run` forwarding warning existed, so direct `npx tsx` is preferred for Phase 1 commands.

## 5. Backups / Snapshots
- Old 10 raw files were backed up/moved before replacing with full 50-file set.
- Pre-sample snapshot:
  - `sale-testlab-data/_backup/pre_phase12h3b_sample_2026-03_20260610_162435`
- Snapshot size:
  - `sale-testlab-data/` in snapshot: `664,485,086 bytes`
- Snapshot contains existing `2026-03` pipeline outputs before sample/full regeneration.
- Stale output backups created later:
  - Phase 3 stale output backup before stream fix:
    - `sale-testlab-data/_backup/phase3_stale_before_stream_fix_2026-03_20260610_103240`
  - Phase 4 stale output backup:
    - `sale-testlab-data/_backup/phase4_stale_before_stream_fix_2026-03_20260611_023241`
  - Phase 5 stale output backup:
    - `sale-testlab-data/_backup/phase5_stale_before_stream_fix_2026-03_20260611_024315`
  - Phase 5b stale output backup:
    - `sale-testlab-data/_backup/phase5b_stale_before_stream_fix_2026-03_20260611_024857`
- Phase 5c has not been handled yet.

## 6. Completed Pipeline Runs

### Phase 1 - PASS
Command:
- `npx tsx src/run-phase1.ts --month=2026-03 --force`

Results:
- files processed: `50`
- total messages appended: `1,094,518`
- errors safely logged: `0`
- `messages.jsonl` size: `773,667,669 bytes`
- `messages.jsonl` line count: `1,094,518`
- manifest records: `50`
- completed: `50`
- failed: `0`
- `parse_errors_2026-03.jsonl`: not created
- AI call: `no`
- raw content printed: `no`

### Phase 2b - PASS
Command:
- `npx tsx src/run-phase2b.ts --month=2026-03`

Results:
- input `messages.jsonl` lines: `1,094,518`
- output `messages_classified.jsonl` size: `1,087,206,278 bytes`
- output lines: `1,094,518`
- AI call: `no`
- raw content printed: `no`

### Phase 3 - Initially FAIL, then PASS after hardening
Original error:
- `Cannot create a string longer than 0x1fffffe8 characters`

Root cause:
- `fs.readFileSync(..., "utf8")`
- `split(/\r?\n/)` on full `messages_classified.jsonl`
- `sessions.map(...).join("\n")` to write output

Files changed:
- `src/run-phase3.ts`
- `src/pipeline/sessionBuilder.ts`

Patch:
- stream input using `fs.createReadStream + readline`
- group by `conversation_id` while streaming
- write `sessions.jsonl` with write stream
- export `buildSessionsFromConversationMap(...)`
- backup stale `03_sessions/2026-03` before rerun

Result:
- command: `npx tsx src/run-phase3.ts --month=2026-03`
- `sessions.jsonl` size: `1,199,941,890 bytes`
- `sessions.jsonl` line count: `194,780`
- `total_sessions`: `194,780`
- `total_messages`: `1,094,518`
- `sessions_with_1_message`: `39,085`
- `sessions_longer_than_2_hours`: `653`
- `sessions_with_mixed_categories`: `53,179`
- `sessions_with_low_avg_confidence`: `141,657`
- `possible_over_split_count`: `30`
- `possible_under_split_count`: `554`
- AI call: `no`
- raw content printed: `no`

### Phase 4 - PASS after hardening
Root risk:
- `readFileSync/split` on `1.2GB sessions.jsonl`
- full records accumulation
- `records.map(...).join("\n")`
- preview JSON could print `evidence_texts` or session data

Files changed:
- `src/run-phase4.ts`

Patch:
- stream input with `readline`
- stream write `behavior_signals.jsonl`
- aggregate counters only
- remove preview content logs

Result:
- command: `npx tsx src/run-phase4.ts --month=2026-03`
- input `sessions.jsonl` lines: `194,780`
- `behavior_signals.jsonl` size: `312,133,466 bytes`
- `behavior_signals.jsonl` line count: `194,780`
- total behavior signals: `416,459`
- avg signals per session: `2.1381`
- sessions with no signals: `40,627`
- weak signal count: `296,757`
- low evidence signal count: `233,736`
- high confidence low evidence count: `14,509`
- invalid json line count: `0`
- invalid date count: `0`
- sessions with missing messages: `0`
- top signals:
  - `low_context_reply`: `84,894`
  - `warehouse_coordination`: `43,133`
  - `asks_price`: `38,503`
  - `high_frequency_exchange`: `35,696`
- AI call: `no`
- raw/session content printed: `no`
- Note: `behavior_signals.jsonl` still contains `evidence_texts` by existing contract, but no preview is printed.

### Phase 5 - PASS after hardening
Root risk:
- `readFileSync/split` on `behavior_signals.jsonl`
- full `BehaviorSessionRecord[]` accumulation
- `records.map(...).join("\n")`
- preview JSON

Files changed:
- `src/run-phase5.ts`
- `src/pipeline/behaviorAggregator.ts`

Patch:
- stream input with `readline`
- stream write `aggregated_behavior.jsonl`
- add accumulator/finalize API:
  - `createBehaviorAggregationState()`
  - `addBehaviorSessionToAggregation(...)`
  - `finalizeBehaviorAggregation(...)`
- remove preview logs

Result:
- command: `npx tsx src/run-phase5.ts --month=2026-03`
- input records: `194,780`
- output `aggregated_behavior.jsonl` size: `35,732,816 bytes`
- output line count: `16,516`
- total entities: `16,516`
- total aggregated patterns: `45,246`
- high confidence patterns: `20,382`
- weak patterns: `0`
- entities with no patterns: `7,441`
- over aggregated pattern count: `685`
- contradictory pattern count: `2,460`
- AI call: `no`
- raw/session/evidence content printed: `no`

### Phase 5b - PASS after hardening
Root risk:
- `readFileSync/split` on `aggregated_behavior.jsonl`
- full records accumulation
- `records.map(...).join("\n")`
- preview JSON

Files changed:
- `src/run-phase5b.ts`

Patch:
- stream input with `readline`
- stream write `contextual_relationships.jsonl`
- process one entity at a time using existing builder
- remove preview logs

Result:
- command: `npx tsx src/run-phase5b.ts --month=2026-03`
- input `aggregated_behavior.jsonl` lines: `16,516`
- output `contextual_relationships.jsonl` size: `73,486,083 bytes`
- output line count: `16,516`
- total entities: `16,516`
- total relationships: `86,839`
- strong relationship count: `3,012`
- weak relationship count: `3,092`
- contradictory relationship count: `2,460`
- over connected entity count: `2,204`
- context conflict count: `1,094`
- AI call: `no`
- raw/session/evidence/behavior content printed: `no`

## 7. Current Pipeline State
State:
- Phase 1: `PASS`
- Phase 2b: `PASS`
- Phase 3: `PASS`
- Phase 4: `PASS`
- Phase 5: `PASS`
- Phase 5b: `PASS`
- Phase 5c: `NOT RUN YET`
- Phase 6/6c/7/7b: `NOT RUN YET`
- Phase 8/8c Qwen simulation: `NOT RUN YET`
- Phase 10/10c/10d: `NOT RUN YET`
- Phase 11b: `NOT RUN YET`

Important:
- Do not run Phase 5c directly without audit/hardening.
- Pattern repeated in Phase 3/4/5/5b:
  - `readFileSync(...).split(...)`
  - `records.map(...).join("\n")`
  - preview JSON logging
- Continue hardening Phase 5c first.

## 8. Modified Code Files Currently
Current git status expected modified source files:
- `src/run-phase3.ts`
- `src/pipeline/sessionBuilder.ts`
- `src/run-phase4.ts`
- `src/run-phase5.ts`
- `src/pipeline/behaviorAggregator.ts`
- `src/run-phase5b.ts`
- `docs/audits/` likely untracked

Notes:
- data outputs/backups under `sale-testlab-data` are ignored and should not be committed.
- do not use `git add .`
- later commit code hardening and docs separately after deterministic chain is stable.

## 9. Known Typecheck Issue
`npx tsc --noEmit` fails because of existing repo issue:
- `tsconfig.json` uses `moduleResolution=node10`, deprecated.

This is unrelated to Phase 3/4/5/5b patches.
No new patch-specific type errors were reported by Codex.

## 10. Next Recommended Step
Next task:
- Audit and harden Phase 5c before running it.

Expected prompt intent:
- inspect `src/run-phase5c.ts` and `src/pipeline/relationshipPruner.ts`
- fix `readFileSync/split/join/preview` if present
- backup stale `05c_pruned/2026-03`
- run only:
  - `npx tsx src/run-phase5c.ts --month=2026-03`
- validate metadata only
- do not run Phase 6+
- do not call AI
- do not print data contents

## 11. Next Session First Message
Use this exact first message in the next chat/session:

"Read docs/SESSION_HANDOFF_PHASE12H3B_IMPORT_PIPELINE.md and docs/RUNTIME_CONTRACT_PHASE12H.md first. Continue from Phase 5c audit/hardening only. Do not run Phase 6+ or call Qwen until Phase 5c passes."
