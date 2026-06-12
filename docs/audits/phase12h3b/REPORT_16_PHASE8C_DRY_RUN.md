# Phase 8c Dry-Run Report

## 1. Status
- Phase 8c dry-run status: PASS
- Command used:
  - `npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=5 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only --dry-run`
- Real Phase 8c sample: NOT RUN

## 2. Input Selection
- Input source: `archetypes`
- Selected record count: 5
- Selected scenario count: 3
- Planned call count: 15
- Scenarios selected:
  - `S1_pricing_question`
  - `S2_product_comparison`
  - `S3_logistics_question`

## 3. Endpoint Gate
- Endpoint validation: PASS
- Endpoint host class: `rfc1918`
- Endpoint reason: `rfc1918_allowed`
- Redacted endpoint: `http://192.168.117.73`

## 4. Privacy Check
- `ai_called`: false
- `privacy_leak_detected`: false
- `blocked_fields_detected_count`: 0
- Prompt text written anywhere: NO
- Reply text written anywhere: NO
- Reasoning text written anywhere: NO
- Metadata-only output only: YES

## 5. Skipped Counts
- skipped archive-only count: 0
- skipped weak count: 5
- skipped outlier count: 0
- skipped non-simulation-ready count: 0

## 6. Output Artifacts
- `sale-testlab-data/08_runtime_simulator/2026-03/gemma_eval_results.jsonl`
  - size: 4490 bytes
  - lines: 15
- `sale-testlab-data/08_runtime_simulator/2026-03/gemma_eval_summary.json`
  - size: 447 bytes
- `sale-testlab-data/08_runtime_simulator/2026-03/gemma_eval_audit.json`
  - size: 634 bytes
- Backup path:
  - `sale-testlab-data/_backup/phase8_stale_before_privacy_hardening_2026-03_20260611_171046`

## 7. Readiness Decision
- Safe to run real Phase 8c sample next: YES, with separate explicit approval.
- Current blockers: none on dry-run path.

## 8. Warnings
- `sale-testlab-data` remains local-only and must not be staged.
- This run validates selection, privacy boundary, endpoint gate, and metadata artifact flow only; it does not validate real model quality.
