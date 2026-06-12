# REPORT 17 - Phase 8c Real Sample

## 1. Trạng thái chung

- Thời điểm chạy: 2026-06-11
- Lệnh chạy:

```bash
npx tsx src/run-phase8c.ts --month=2026-03 --input-source=archetypes --limit-records=5 --limit-scenarios=3 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=1 --metadata-only
```

- Kết quả tổng thể: FAIL
- Ghi chú phân loại:
  - Hạ tầng local Qwen: PASS
  - Privacy gate: PASS
  - Metadata-only output: PASS
  - Rule-based evaluator: FAIL

Nguyên nhân chính của FAIL tổng thể:

- `evaluator_failed_count = 15/15`
- `evaluator_violation_counts.state_mismatch = 15`

Mẫu 8c đã chạy thật thành công ở lớp thực thi, nhưng chưa đạt ở lớp alignment theo state/rule.

## 2. Input và phạm vi chạy

- Input source: `archetypes`
- Runtime personas: không dùng
- Selected record count: `5`
- Selected scenario count: `3`
- Scenario set:
  - `S1_pricing_question`
  - `S2_product_comparison`
  - `S3_logistics_question`
- Planned call count: `15`
- Actual call count: `15`

## 3. Endpoint gate và AI status

- Endpoint validation: `PASS`
- Endpoint host class: `rfc1918`
- Endpoint reason: `rfc1918_allowed`
- AI/Qwen called: `true`
- Phase 8c dry-run only rule đã được thay bằng real sample cho đúng scope hiện tại

## 4. Kết quả gọi model

- `local_ai_generated_count = 15`
- `fallback_count = 0`
- `fallback_rate = 0.0%`
- `timeout_count = 0`
- `timeout_rate = 0.0%`
- Latency min/avg/max: `114 / 146.87 / 250 ms`

## 5. Content compatibility metadata

- `error_type_counts = { none: 15 }`
- `content_types = [string]`
- `content_length_range = { min: 21, max: 32 }`
- `reasoning_types = [undefined]`
- `reasoning_length_range = { min: 0, max: 0 }`
- `finish_reason_set = [stop]`
- `stop_reason_set = [null]`
- `parse_attempt_status_counts = { string_content: 15 }`

Kết luận:

- Qwen local đã trả về `content` dạng string hợp lệ cho cả 15 call
- Không còn lỗi `invalid_response_format`
- Không có reasoning text phát sinh trong artifact

## 6. Rule-based evaluator metadata

- `assistant_style_detected_count = 0`
- `evaluator_passed_count = 0`
- `evaluator_failed_count = 15`
- `evaluator_violation_counts = { state_mismatch: 15 }`

Đọc theo đúng metadata hiện có:

- Không có dấu hiệu fallback/template
- Không có dấu hiệu assistant-style
- Toàn bộ fail đến từ logic match state/scenario, không phải từ transport hay adapter

## 7. Privacy check

- `privacy_leak_detected = false`
- `blocked_fields_detected_count = 0`
- `blocked_fields_detected = []`
- Prompt text written anywhere: `NO`
- Full reply text written anywhere: `NO`
- Reasoning text written anywhere: `NO`
- Persona/archetype content preview printed: `NO`

## 8. Output artifacts

Thư mục output:

- `sale-testlab-data/08_runtime_simulator/2026-03`

Artifacts:

- `gemma_eval_results.jsonl`
  - line count: `15`
  - size: `7,565 bytes`
- `gemma_eval_summary.json`
  - size: `840 bytes`
- `gemma_eval_audit.json`
  - size: `1,692 bytes`

Backup stale output:

- `sale-testlab-data/_backup/phase8_stale_before_privacy_hardening_2026-03_20260611_173128`

## 9. Đánh giá sẵn sàng bước tiếp theo

- Safe to commit Phase 8c reports: `YES`, nếu commit với vai trò audit/checkpoint
- Safe to treat Phase 8c as pass checkpoint: `NO`
- Safe to scale beyond 15-call sample ngay lúc này: `NO`

Lý do chưa scale tiếp:

- Rule-based evaluator đang fail `15/15`
- Cần audit lại mapping giữa:
  - scenario state
  - expected buyer move
  - evaluator state rules
- Chưa nên coi đây là behavioral pass chỉ vì Qwen trả lời hợp lệ về định dạng

## 10. Blocker / warning

- Blocker hiện tại không nằm ở local endpoint, timeout, fallback hay privacy
- Blocker nằm ở `state_mismatch` trên toàn bộ 15 sample
- Cần tách rõ:
  - model response quality
  - evaluator expectation quality
- Trước khi chạy sample lớn hơn hoặc bước scale tiếp theo, cần audit logic evaluator/state alignment

