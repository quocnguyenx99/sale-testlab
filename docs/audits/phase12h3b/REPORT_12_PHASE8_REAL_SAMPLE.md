# Phase 8 Real Sample Report

## 1. Real Sample Status
- Real sample status: FAIL
- Command used:
  - `npx tsx src/run-phase8.ts --month=2026-03 --input-source=archetypes --limit-records=5 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only`
- Phase 8c: NOT RUN

## 2. Endpoint Gate Result
- Endpoint validation: PASS
- Endpoint host class: `rfc1918`
- Endpoint reason: `rfc1918_allowed`
- Redacted endpoint: `http://192.168.117.73`

## 3. Input Selection
- Selected input source: `archetypes`
- Selected count: 5
- Total input records seen: 38
- Skipped archive-only count: 0
- Skipped weak count: 5
- Skipped outlier count: 0
- Skipped non-simulation-ready count: 0

## 4. Qwen / AI Call Status
- `ai_called`: true
- Real Phase 8 sample executed: YES
- Phase 8c executed: NO

## 5. Fallback / Timeout / Latency Metadata
- `local_ai_generated_count`: 0
- `fallback_count`: 5
- `fallback_rate`: 100.0%
- `timeout_count`: 0
- `timeout_rate`: 0.0%
- Latency min / avg / max:
  - min: 173 ms
  - avg: 239.6 ms
  - max: 485 ms
- Observed reply source set: `deterministic_fallback`
- Observed error type set: `invalid_response_format`

## 6. Privacy Check Result
- `privacy_leak_detected`: false
- `blocked_fields_detected_count`: 0
- Prompt text written anywhere: NO
- Full reply text written anywhere: NO
- Metadata-only artifacts: YES

## 7. Output Artifacts
- `sale-testlab-data/08_runtime_simulator/2026-03/runtime_simulation_selection.json`
  - size: 438 bytes
- `sale-testlab-data/08_runtime_simulator/2026-03/runtime_simulation_audit.json`
  - size: 966 bytes
- Backup path used:
  - `sale-testlab-data/_backup/phase8_stale_before_privacy_hardening_2026-03_20260611_152516`

## 8. Safe To Proceed?
- Safe to proceed to Phase 8c dry-run/sample later: NO
- Reason:
  - real Phase 8 sample did not pass cleanly
  - all 5 calls fell back due to `invalid_response_format`
  - local AI path needs response-format investigation before Phase 8c

## 9. Blockers / Warnings
- Blocker: fallback rate is 100%.
- Blocker: no untouched/generated local AI result was accepted.
- Warning: local instrumentation log was updated with model metadata only; no prompt/reply text was written into Phase 8 outputs.
