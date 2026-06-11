# Phase 8 5-Archetype Sample Rerun Report

## 1. 5-Archetype Sample Status
- Status: PASS
- Command used:
  - `npx tsx src/run-phase8.ts --month=2026-03 --input-source=archetypes --limit-records=5 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only`
- Phase 8c: NOT RUN

## 2. Endpoint Gate Result
- Endpoint validation: PASS
- Endpoint host class: `rfc1918`
- Endpoint reason: `rfc1918_allowed`
- Redacted endpoint: `http://192.168.117.73`

## 3. Qwen / AI Status
- `ai_called`: true
- `selected_count`: 5
- `local_ai_generated_count`: 5
- `reply_source_counts`: `local_ai_generated=5`

## 4. Fallback / Timeout / Latency Metadata
- `fallback_count`: 0
- `fallback_rate`: 0.0%
- `timeout_count`: 0
- `timeout_rate`: 0.0%
- Latency from Phase 8 audit:
  - min: 135 ms
  - avg: 160 ms
  - max: 233 ms
- Latency from instrumentation last 5 calls:
  - min: 133 ms
  - avg: 151.4 ms
  - max: 199 ms

## 5. Content Compatibility Status
- `error_type set`: `none`
- `content_type set`: `string`
- `content_length min/max`: `32 / 32`
- `reasoning_type set`: `undefined`
- `reasoning_length min/max`: `0 / 0`
- `finish_reason set`: `stop`
- `stop_reason set`: `null`
- `parse_attempt_status_counts`: `string_content=5`
- `missing_required_fields`: none

## 6. Privacy Check Result
- `privacy_leak_detected`: false
- `blocked_fields_detected_count`: 0
- Prompt text written anywhere: NO
- Full reply text written anywhere: NO
- Reasoning text written anywhere: NO
- Persona/archetype content printed: NO

## 7. Output Artifacts
- `sale-testlab-data/08_runtime_simulator/2026-03/runtime_simulation_selection.json`
  - size: 438 bytes
- `sale-testlab-data/08_runtime_simulator/2026-03/runtime_simulation_audit.json`
  - size: 2194 bytes
- Backup path:
  - `sale-testlab-data/_backup/phase8_stale_before_privacy_hardening_2026-03_20260611_162224`

## 8. Readiness Decision
- Safe to proceed to Phase 8c dry-run/sample: YES, with separate explicit approval.
- Safe to commit Phase 8 hardening reports: YES from a technical validation standpoint.
- Phase 8c was not executed in this task.

## 9. Blockers / Warnings
- No active blocker on Phase 8 archetype path after compatibility fix.
- Warning: endpoint response still exposes top-level metadata keys such as `prompt_text`, but no prompt text was printed or copied into Phase 8 outputs.
- Warning: `sale-testlab-data` remains local-only and must not be staged.
