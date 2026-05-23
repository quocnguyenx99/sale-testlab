# Internal Audit Summary

Sale TestLab Data Pipeline / AI Customer TestLab

Ngày audit: `2026-05-22`

Mode: `READ-ONLY`

---

## 1. Kết luận nhanh

- Pipeline local-first đã chạy thật tới `11B`.
- Runtime Phase 12 đã có cấu trúc đủ tốt để hardening tiếp.
- Điểm nghẽn lớn nhất hiện tại không còn là parse/pipeline mà là runtime orchestration và
  session outcome semantics.
- Chưa nên build web app lớn ngay.
- Nên làm `12H/13A` trước, theo hướng `deal_state` schema-first.

| Hạng mục | Mức đánh giá | Ghi chú ngắn |
|---|---|---|
| Pipeline | Tốt | Có artifacts thật cho `2026-03` |
| Persona stack | Dùng được | Từ `2248` entities xuống `16` enriched personas |
| Runtime Phase 12 | Khá tốt | Có guard, fallback, completion |
| Outcome engine | Chưa đủ | Mới có `completion_ready`, chưa có `deal_outcome` |
| FE/DB readiness | Một phần | Chỉ nên làm thin MVP sau khi freeze contract |

---

## 2. Số liệu thực tế

Từ artifact `2026-03`:

- `10` raw files
- `206,101` messages
- `25,269` sessions
- `2,248` entities aggregated
- `192` runtime personas approved
- `25` training personas
- `16` clean/enriched training personas

---

## 3. Những gì đang ổn

- Phase 1 ingestion có manifest/hash/incremental flow.
- Mỗi stage lớn đều có `summary` và `audit`.
- Runtime có:
  - progress tracking
  - identity lock
  - repetition guard
  - response bank
  - completion engine
  - debug metadata trả về khá giàu
- Có regression test cho các phase 12C -> 12F2.
- Có offline QA và live QA runner riêng.

---

## 4. Những gì đang yếu

| Vấn đề | Mức độ | Tác động |
|---|---|---|
| `src/playground/server.ts` là God file | Cao | Khó test, khó mở rộng |
| Regex/topic rules hardcode nhiều | Cao | Dễ miss edge case |
| `completion_ready` chưa phải `deal_outcome` | Cao | Session end chưa đúng business |
| `sale-testlab-data/config/*.json` đang rỗng | Cao | Nhiều rule chưa data-driven |
| Scenario/opening/response bank hardcode | Trung bình-Cao | Scale kém, persona voice nông |
| Memory chỉ boolean | Trung bình | Chưa đủ sâu cho closing/outcome |
| QA history chưa thống nhất | Trung bình | Khó chốt baseline |

---

## 5. Technical Debt chính

1. Orchestration logic dồn vào `server.ts`.
2. Business rules runtime rải trong nhiều regex hardcoded.
3. Chưa có `deal_state` và `training_success` schema.
4. Chưa có persistent app-layer storage cho session/result.
5. `README.md` trống, config layer chưa hình thành.

---

## 6. Hardcode nào chấp nhận được, hardcode nào không

### Chấp nhận được ở MVP

- response bank
- completion bank
- opening templates
- state keyword router mức cơ bản

### Cần chuyển dần sang data/config

- topic aliases
- scenario catalog
- do-not-do / guard constraints
- persona-family openings

### Nguy hiểm nếu để lâu

- deal outcome logic
- session end rules
- training success criteria
- identity edge-case rules

---

## 7. Readiness cho Phase 12H/13A

Đánh giá: **nên làm ngay**.

Thiếu chính:

- `deal_state`
- `buying_signals`
- `closing_signals`
- `deal_outcome`
- `outcome_confidence`
- `should_end_session`
- `training_success`

Outcome đề xuất:

- `not_ready`
- `ready_to_close`
- `quote_requested`
- `payment_info_requested`
- `hold_requested`
- `customer_committed`
- `pending_approval`
- `pending_payment`
- `stalled`
- `closed_lost`
- `closed_won_simulated`

Kết luận:

- Runtime hiện biết "đủ thông tin".
- Runtime chưa biết "khách đã chốt theo kiểu nào".

---

## 8. Nên làm gì tiếp

### Recommended Order

1. Thiết kế `deal_state` schema.
2. Thêm detectors:
   - quote request
   - hold request
   - approval dependency
   - payment intent
   - commitment intent
   - stall intent
   - rejection intent
3. Thêm `training_success` + `should_end_session`.
4. Viết regression/offline QA cho outcome engine.
5. Freeze response contract của `/api/chat`.
6. Tách `server.ts` thành các lớp runtime nhỏ hơn.
7. Sau đó mới dựng DB/FE MVP mỏng.

---

## 9. Đề xuất DB/FE

Chưa nên build full app production.

Nếu làm MVP mỏng sau khi freeze contract:

- Backend: Laravel/MySQL
- Frontend: React
- Runtime: Node/TS service tách ra từ playground

Tables tối thiểu:

- `users`
- `personas`
- `training_sessions`
- `chat_messages`
- `session_runtime_logs`
- `session_scores`

Pages tối thiểu:

- login
- persona selection
- training chat
- session result
- history
- admin persona viewer

---

## 10. Final Internal Recommendation

- Tiếp tục runtime trước.
- Làm `12H/13A` trước FE/DB lớn.
- Giữ Gemma để hardening ngắn hạn nếu endpoint ổn.
- Có thể benchmark Qwen local sau, không đổi model chính ngay.
- Chưa nên làm semantic memory/vector search.
- Chưa nên làm voice.

Next exact step:

1. Chốt `deal_state` schema
2. Implement detectors
3. Add QA
4. Freeze API contract
5. Build thin DB/FE wrapper
