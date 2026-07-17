# REPORT 46 - Turn 2 Residual Stability Audit

Thời điểm: 2026-07-17 (Asia/Bangkok)

## Phạm vi

- Kiểm tra lại Turn 2 trên 12 slot đã được phê duyệt, lặp 3 lần độc lập.
- Mỗi lượt: customer-start, Turn 1 về giá/ngữ cảnh, Turn 2 về cấu hình/so sánh.
- Chỉ thu thập metadata. Không lưu hay in prompt, trả lời đầy đủ, reasoning, persona,
  catalog, dữ liệu thô hoặc số lượng tồn kho.
- Không sửa mã nguồn, không triển khai Patch 2.1, không chạy audit đủ 38 persona.

## Điều kiện trước khi chạy

- Patch 2 được kiểm tra: `3f7c4de fix(runtime): reduce fallback-heavy buyer responses`.
- Bốn regression xác định đều PASS:
  - `phase12h3b_salutation_buyer_role_lock.regression.test.ts`
  - `phase12h1_buyer_voice_guard.regression.test.ts`
  - `phase12h3a_customer_voice_style.regression.test.ts`
  - `phase12h3b_fallback_naturalness_fastfix.regression.test.ts`
- External/cloud AI: không gọi.

## Tính toàn vẹn dữ liệu audit

- Kế hoạch gốc: 36 customer-start, 72 chat call, 36 Turn 2 được phân tích.
- Lượt chạy gốc hoàn tất endpoint thành công cho 36 chuỗi, nhưng checker metadata bị lỗi sau
  khi nhận response ở 4 row: `recommended_8` (3 repetition) và
  `non_recommended_18` (repetition 3).
- Probe metadata-only xác nhận hai slot dùng schema runtime hợp lệ; không phải lỗi endpoint,
  Qwen hay timeout.
- Bốn row thiếu được replay riêng bằng extractor metadata chịu null-safe. Cả bốn PASS.
- Tập phân tích cuối: 36/36 Turn 2 đầy đủ (32 gốc + 4 replay thay thế).
- Tổng call thực tế gồm probe/replay: 40 customer-start và 80 chat call. Kết quả gate chỉ dùng
  36 row Turn 2 đã hoàn chỉnh; replay được gắn cờ thay thế, không trộn với nội dung.

## Kết quả tổng hợp

| Chỉ số | Giá trị |
| --- | ---: |
| Turn 2 phân tích | 36/36 |
| local_ai_generated | 17/36 (47.2%) |
| local_ai_rewritten | 3/36 (8.3%) |
| deterministic_fallback | 16/36 (44.4%) |
| low-human proxy | 19/36 (52.8%) |
| Turn 2 low-human trung bình | 6.33/12 mỗi repetition |
| Timeout runtime | 0 |
| Lỗi runtime/endpoints trong tập cuối | 0 |
| Buyer-role issue | 0 |
| Salutation issue | 0 |
| Seller/support tone issue | 0 |
| Privacy issue | 0 |
| Raw stock leak | 0 |
| Prompt/reasoning visibility | 0 |

## Kết quả theo repetition

| Repetition | Low-human | Fallback | Rewrite | Local generated |
| --- | ---: | ---: | ---: | ---: |
| 1 | 7/12 | 6 | 1 | 5 |
| 2 | 7/12 | 5 | 2 | 5 |
| 3 | 5/12 | 5 | 0 | 7 |

Ngưỡng để cân nhắc full-38 là trung bình Turn 2 low-human <= 6/12. Kết quả là 6.33/12,
nên chưa đạt.

## Phân loại theo slot

| Slot | Low-human | Phân loại | Fallback | Rewrite | Generated | Nguyên nhân metadata chính |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| recommended_3 | 2/3 | RECURRING | 2 | 0 | 1 | multi_topic_repetition |
| recommended_4 | 0/3 | STABLE_GOOD | 0 | 0 | 3 | none |
| recommended_5 | 3/3 | PERSISTENT | 2 | 1 | 0 | multi_topic_repetition |
| recommended_6 | 2/3 | RECURRING | 1 | 1 | 1 | multi_topic_repetition |
| recommended_8 | 0/3 | STABLE_GOOD | 0 | 0 | 3 | none |
| non_recommended_16 | 3/3 | PERSISTENT | 3 | 0 | 0 | multi_topic_repetition |
| non_recommended_18 | 2/3 | RECURRING | 1 | 1 | 1 | ambiguous_model_rewrite |
| non_recommended_7 | 1/3 | VARIABLE | 1 | 0 | 2 | final_guard |
| non_recommended_13 | 0/3 | STABLE_GOOD | 0 | 0 | 3 | none |
| non_recommended_24 | 0/3 | STABLE_GOOD | 0 | 0 | 3 | none |
| non_recommended_3 | 3/3 | PERSISTENT | 3 | 0 | 0 | final_guard |
| non_recommended_12 | 3/3 | PERSISTENT | 3 | 0 | 0 | multi_topic_repetition |

## Phân bố nguyên nhân low-human

| Nhóm metadata | Số call |
| --- | ---: |
| multi_topic_repetition | 10 |
| final_guard | 5 |
| ambiguous_model_rewrite | 3 |
| free_form_loop | 1 |

`multi_topic_repetition` xuất hiện ổn định ở ba slot PERSISTENT (`recommended_5`,
`non_recommended_16`, `non_recommended_12`), tổng ít nhất 9 Turn 2 low-human. Tuy nhiên,
metadata không chứng minh được rằng giữ nguyên raw candidate là an toàn: đây là nhánh guard chống
lặp/chệch chủ đề. Việc nới guard lúc này có thể làm yếu bảo vệ loop và completion, nên không thỏa
điều kiện Patch 2.1 an toàn.

`final_guard` lặp ở `non_recommended_3` (3/3). Đây cũng là nhánh recovery an toàn; không có bằng
chứng metadata-only để thay thế bằng candidate mà vẫn giữ nguyên hợp đồng an toàn.

## Đánh giá ổn định

- Patch 2 vẫn bảo toàn an toàn, buyer role, salutation, privacy và stock secrecy.
- Naturalness Turn 2 chưa ổn định đủ để mở rộng full-38: 4 slot PERSISTENT và 3 slot RECURRING.
- Không có cơ sở để auto-pass hoặc giảm độ nghiêm ngặt của evaluator/guard.
- Không triển khai Patch 2.1 trong báo cáo này.

## Verdict

`TURN2_UNSTABLE_REQUIRES_RETHINK`

Không chạy full 38 persona ở thời điểm này.

## Hướng tiếp theo an toàn

1. Thực hiện audit nguyên nhân theo metadata cho `multi_topic_repetition` và `final_guard`:
   phân tách trigger theo turn/progress/topic mà không lưu text.
2. Chỉ đề xuất Patch 2.1 nếu có thể chứng minh bằng metadata rằng một candidate được giữ lại không
   vi phạm role, stock, completion hay loop guard.
3. Nếu có Patch 2.1, xác thực theo thứ tự: regression, dry-run metadata, 1x3, 12-slot Turn 2
   repeated audit; không mở full-38 trước khi trung bình <= 6/12.

## Trạng thái riêng tư

- Local Qwen chỉ được gọi gián tiếp qua `/api/chat` trong các call đã phê duyệt.
- Không gọi external/cloud AI.
- Không ghi prompt, reply đầy đủ, reasoning, raw Zalo, persona đầy đủ hay catalog đầy đủ.
- `sale-testlab-data` vẫn local-only và không được stage/commit.
