# Phase 1 Safe Ingestion Implementation Plan

This plan details the code changes required to support continuous, incremental, and memory-safe raw data ingestion for Phase 1.

## User Review Required

> [!IMPORTANT]
> The plan proposes reading files line-by-line using `readline`, but retaining the parsed JSON objects for a single file in memory before flushing to `messages.jsonl` and garbage collecting. This satisfies the "one file at a time" requirement and handles 32MB files safely without exploding memory. Please confirm if you want a pure generator/stream-to-disk approach instead, which is safer but slightly more complex.

## Proposed Changes

---

### `src/writer/jsonlWriter.ts`

- **[MODIFY]**: Add `appendJsonl` function to safely append lines to an existing file, creating the directory if necessary.

### `src/writer/manifestWriter.ts`

- **[MODIFY]**: Create `updateManifest` function to load the existing `manifest_YYYY-MM.json`, merge new file records (updating existing if `--force`), and rewrite it.

### `src/parser/zaloparser.ts`

- **[MODIFY]**: Update `parseZaloData` to accept a file path instead of raw string content.
- Use Node.js `readline` with `fs.createReadStream` to process the file line-by-line.
- Return a Promise resolving to `ParsedRow[]`. This prevents loading the 32MB string entirely into RAM.

### `src/run-phase1.ts`

- **[MODIFY] CLI Parsing**:
  - Add support for `--dry-run`, `--force`, `--limit-files=N`, and `--exclude-largest`.
  - Ensure `--month` expects just the `YYYY-MM` value (no `--file` required unless specified).
- **[MODIFY] Core Logic**:
  - Scan `sale-testlab-data/00_raw/zalo/{month}/` for all `.txt` files.
  - If `--exclude-largest` is set, find the file with the largest byte size and exclude it from the run.
  - Load existing `manifest_{month}.json`.
  - For each file:
    1. Calculate file hash (using streaming or buffer).
    2. Check manifest. If hash exists and status is `completed`, skip (unless `--force`).
    3. If `--dry-run`, just log intent to process and continue.
    4. Call updated `parseZaloData`.
    5. Process and validate rows via `MessagesSchema`.
    6. Scrub `text` and `raw_content` from validation errors before logging.
    7. Append valid messages to `01_normalized/{month}/messages.jsonl`.
    8. Append sanitized errors to `logs/parse_errors_{month}.jsonl`.
    9. Update and save `manifest_{month}.json`.

---

## Verification Plan

1. **Dry Run:** `npm run phase1 -- --month=2026-03 --dry-run`
   - Should list all 10 files and their action (Process) without writing anything.
2. **Partial Run:** `npm run phase1 -- --month=2026-03 --limit-files=9 --exclude-largest`
   - Should process 9 files, explicitly skipping the 32MB file.
   - Outputs should appear in `01_normalized/2026-03/messages.jsonl` and `logs/manifest_2026-03.json`.
3. **Incremental Test:** Re-running the partial run command should result in 9 skips (already processed) and 0 new messages.
4. **Log Sanitization Check:** Inspect `logs/parse_errors_2026-03.jsonl` to guarantee no raw text leaks.
