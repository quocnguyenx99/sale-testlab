# REPORT 19 - Phase 8c Tiny Real Rerun After State Fix

## 1. Trạng thái chung

- Status: PARTIAL PASS
- Hạ tầng local Qwen: PASS
- Privacy gate: PASS
- Content compatibility: PASS
- Evaluator state diagnostics: IMPROVED
- Behavioral evaluator overall: NOT PASS

Lệnh chạy:

```bash
npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=1 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only
```

## 2. Endpoint và phạm vi chạy

- Input source: `archetypes`
- Selected record count: `1`
- Selected scenario count: `3`
- Planned call count: `3`
- Actual call count: `3`
- Endpoint validation: `PASS`
- Endpoint host class: `rfc1918`
- Endpoint reason: `rfc1918_allowed`
- AI/Qwen called: `true`

## 3. Kết quả runtime/model

- `local_ai_generated_count = 3`
- `fallback_count = 0`
- `fallback_rate = 0.0%`
- `timeout_count = 0`
- `timeout_rate = 0.0%`
- Latency min/avg/max: `154 / 286.33 / 539 ms`

## 4. Content compatibility metadata

- `error_type set = { none }`
- `content_type set = { string }`
- `content_length min/max = 28 / 33`
- `reasoning_type set = { undefined }`
- `reasoning_length min/max = 0 / 0`
- `finish_reason set = { stop }`
- `stop_reason set = { null }`
- `parse_attempt_status_counts = { string_content: 3 }`

Kết luận:

- Không còn lỗi format/content adapter
- Không có fallback
- Không có timeout
- Không có reasoning text

## 5. Evaluator sau state diagnostics fix

- `evaluator_passed_count = 1`
- `evaluator_failed_count = 2`
- `evaluator_violation_counts = { state_mismatch: 2 }`
- `state_signal_missing_count = 0`
- `state_mismatch_count = 2`
- `mismatch_reason_counts = { detected_other_state: 2 }`

Ý nghĩa:

- Patch đã phát huy tác dụng:
  - không còn dồn tất cả vào `state_mismatch` do thiếu state keyword
  - tiny rerun này không có `state_signal_missing`
- 2/3 fail hiện tại là mismatch thực theo evaluator mới:
  - reply bị detect sang state khác với expected state

## 6. Aggregate metadata

- `violation_counts_by_scenario`
  - `S1_pricing_question = 1`
  - `S2_product_comparison = 0`
  - `S3_logistics_question = 1`

- `violation_counts_by_expected_state`
  - `pricing_phase = 1`
  - `logistics_phase = 1`

- `violation_counts_by_actual_state`
  - `uncertain_interest = 1`
  - `pricing_phase = 1`

- `expected_state_value set`
  - `pricing_phase`
  - `research_phase`
  - `logistics_phase`

- `actual_state_value set`
  - `pricing_phase`
  - `research_phase`
  - `uncertain_interest`

- `detected_buyer_move set`
  - `price_probe`
  - `comparison_probe`
  - `clarify_interest`

## 7. Privacy status

- `privacy_leak_detected = false`
- `blocked_fields_detected_count = 0`
- Prompt text written anywhere: `NO`
- Full reply text written anywhere: `NO`
- Reasoning text written anywhere: `NO`
- Persona/archetype content printed: `NO`

## 8. Output artifacts

Output folder:

- `sale-testlab-data/08_runtime_simulator/2026-03`

Artifacts:

- `gemma_eval_results.jsonl`
  - line count: `3`
  - size: `2,843 bytes`
- `gemma_eval_summary.json`
  - size: `835 bytes`
- `gemma_eval_audit.json`
  - size: `2,193 bytes`

Backup path:

- `sale-testlab-data/_backup/phase8_stale_before_privacy_hardening_2026-03_20260612_084803`

## 9. Đánh giá tiếp theo

- Safe to rerun `5 archetypes x 3 scenarios`: `NO`
- Safe to commit Phase 8c audit/fix reports: `YES`, nếu commit như checkpoint kỹ thuật
- Phase 8c remains blocked: `YES`

Lý do vẫn block:

- Evaluator nay đã chính xác hơn, nhưng tiny real rerun vẫn fail `2/3`
- Mismatch giờ là mismatch có phân loại, không còn là nhãn giả do thiếu metadata
- Cần audit tiếp:
  - tại sao `S1_pricing_question` detect sang `uncertain_interest`
  - tại sao `S3_logistics_question` detect sang `pricing_phase`

## 10. Kết luận ngắn

- Patch evaluator là đúng hướng
- Root cause cũ đã được xác nhận và sửa ở lớp chẩn đoán
- Tiny rerun đã chứng minh vấn đề còn lại không còn là “missing metadata only”
- Chưa nên scale lên 5x3 cho tới khi xử lý tiếp mismatch thật ở 2 scenario
