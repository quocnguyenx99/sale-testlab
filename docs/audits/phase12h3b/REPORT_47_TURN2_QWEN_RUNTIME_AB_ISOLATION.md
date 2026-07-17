# REPORT 47 - Turn 2 Qwen/Runtime A-B Isolation

Thời điểm: 2026-07-17 (Asia/Bangkok)

## Commit và phạm vi

- Commit Patch 2 được kiểm tra: `3f7c4de fix(runtime): reduce fallback-heavy buyer responses`.
- Audit chỉ dùng 9 slot: 4 persistent, 3 recurring và 2 stable control.
- Mỗi slot chạy 3 repetition, tổng 27 cặp Turn 2.
- Không sửa source, không triển khai Patch 2.1, không chạy full-38, không commit/push.

## Phương pháp A/B cùng invocation

Path A không tạo một model call thứ hai. Thay vào đó, harness bắt
`candidate_reply_before_guards` ngay tại biên local-Qwen trong cùng invocation của `/api/chat`:

1. Runtime dựng persona, identity, history, product context, memory/progress và prompt bình thường.
2. Local Qwen sinh candidate; retry chống lặp (nếu có) đã hoàn tất.
3. Harness chỉ phân loại candidate trong bộ nhớ, trước safety/repetition/completion/response-bank.
4. Cùng invocation tiếp tục qua runtime để lấy Path B final outcome.

Cách này tạo đối chứng chính xác cùng prompt/context/candidate, tránh nhiễu sampling nếu gọi Qwen lần
hai. Candidate và final reply đầy đủ không được ghi ra file audit.

## Local model metadata

| Trường | Giá trị |
| --- | --- |
| Endpoint host | `192.168.117.73` |
| Endpoint class | RFC1918 private |
| Model | `qwen3-8b` |
| Temperature | 0.35 |
| Top-p | 0.9 |
| Timeout | 30000 ms |
| Thinking | disabled |

Không gọi external/cloud AI.

## Runtime calls

| Hạng mục | Số lượng |
| --- | ---: |
| Customer-start | 27 |
| Turn 1 runtime chat | 27 |
| Turn 2 runtime chat / Path B outcomes | 27 |
| Path A candidate capture trước guard | 27 |
| Error/timeout trong A/B | 0 / 0 |

## Privacy

- Không persist full prompt, candidate, final reply, reasoning, persona đầy đủ, product row hay raw stock.
- Chỉ metadata boolean, source, trigger, slot và classification được tổng hợp.
- Candidate/final đều không có buyer-role, salutation, privacy hay raw-stock issue theo metadata cuối.

## Path A candidate distribution

| Chỉ số | Số lượng |
| --- | ---: |
| Candidate generated, non-empty | 27/27 |
| Candidate có buyer-role issue | 0 |
| Candidate có salutation issue | 0 |
| Candidate có seller/support issue | 0 |
| Candidate có privacy issue | 0 |
| Candidate có raw stock leak | 0 |
| Candidate đã low-human trước guard | 22/27 |
| Candidate có repeated-topic signal | 21/27 |
| Candidate có free-form-loop signal | 1/27 |
| Candidate có product-context gating issue | 5/27 |

## Path B final runtime distribution

| Reply source | Số lượng |
| --- | ---: |
| local_ai_generated | 11/27 |
| local_ai_rewritten | 5/27 |
| deterministic_fallback | 11/27 |

Các trigger chính chỉ theo metadata:

| Trigger family | Số lượng |
| --- | ---: |
| repeated-topic, có hoặc không có final guard | 18 |
| free-form loop | 1 |
| ambiguous product context | 5 |
| Không trigger | 11 |

## Candidate so với final

| Classification | Số lượng | Ý nghĩa |
| --- | ---: | --- |
| MODEL_CAUSED | 7 | Candidate có vấn đề trước guard nhưng final vẫn được preserve |
| RUNTIME_JUSTIFIED_REPAIR | 5 | Candidate có product-context/repetition issue, rewrite có căn cứ |
| RUNTIME_JUSTIFIED_FALLBACK | 11 | Candidate lặp hoặc loop rõ, fallback có căn cứ |
| SAFE_PRESERVED | 4 | Candidate sạch và runtime giữ nguyên |
| RUNTIME_FALSE_POSITIVE | 0 | Không có candidate sạch bị rewrite/fallback sai |
| MIXED | 0 | Không có |

Chỉ số tổng hợp:

| Chỉ số | Số lượng |
| --- | ---: |
| Safe direct candidate được preserve | 4 |
| Safe direct candidate bị rewrite | 0 |
| Safe direct candidate bị fallback | 0 |
| Justified fallback | 11 |
| Model-caused issue (lặp/loop/product-context trước guard) | 23 |
| Runtime-caused false positive | 0 |

## Kết quả theo slot

| Slot | Candidate low-human | Fallback | Rewrite | False positive | Justified fallback |
| --- | ---: | ---: | ---: | ---: | ---: |
| recommended_5 | 3/3 | 0 | 1 | 0 | 0 |
| non_recommended_16 | 3/3 | 0 | 3 | 0 | 0 |
| non_recommended_3 | 3/3 | 2 | 0 | 0 | 2 |
| non_recommended_12 | 3/3 | 3 | 0 | 0 | 3 |
| recommended_3 | 3/3 | 2 | 0 | 0 | 2 |
| recommended_6 | 2/3 | 2 | 0 | 0 | 2 |
| non_recommended_18 | 2/3 | 1 | 0 | 0 | 1 |
| recommended_4 | 3/3 | 1 | 0 | 0 | 1 |
| recommended_8 | 0/3 | 0 | 1 | 0 | 0 |

## Phân tích trigger

### multi_topic_repetition và final_guard

- Candidate đã có repeated-topic/free-form-loop signal trước khi runtime chọn fallback.
- 11 fallback đều nằm trong `RUNTIME_JUSTIFIED_FALLBACK`; không có safe candidate bị fallback.
- `final_guard` đi cùng repeated-topic ở ba row; không có bằng chứng false positive để nới final guard.

### Product-context và rewrite

- Năm rewrite có product-context gate hoặc soft repeated-topic đi kèm.
- Không có rewrite nào thỏa điều kiện candidate sạch để được xem là false positive.
- Không nên đổi `safetyGuards`, repetition detector hay final guard ở Patch 2.1.

### Candidate được preserve dù đã có lặp

- Bảy candidate có lặp vẫn được `local_ai_generated` preserve theo chính sách mềm Patch 2.
- Đây là bằng chứng vấn đề nằm trước guard: prompt/context/memory chưa buộc Turn 2 chuyển chủ đề đủ
  rõ, không phải bằng chứng guard fallback quá mức.

## Quyết định Patch 2.1

Không đủ điều kiện cho Patch 2.1 theo nhánh repetition/final-guard:

- Điều kiện cần là ít nhất 4 safe non-repetitive candidate bị fallback/rewrite sai ở ít nhất 2 slot.
- Kết quả: `0` safe candidate bị fallback/rewrite.
- Nới guard lúc này sẽ làm yếu loop/completion safety mà không có bằng chứng lợi ích.

## Khuyến nghị target tiếp theo

Ưu tiên audit/patch nhỏ theo deterministic-first ở các điểm sau, không thay guard policy trước:

1. `src/runtime/runtimePromptBuilder.ts` - nhấn chuyển chủ đề Turn 2 theo unresolved topic.
2. `src/runtime/conversationMemory.ts` - kiểm tra state/progress đưa vào prompt có chồng các topic đã
   được Sale trả lời hay không.
3. `src/playground/server.ts` - kiểm tra assembly recent history/progress trước model call, không đổi
   safety stack.
4. Chỉ xem `src/runtime/localAIRuntimeAdapter.ts` sau khi prompt/context audit chứng minh model params
   là nguyên nhân; chưa có bằng chứng cho thay đổi parameter.

Không khuyến nghị target hiện tại:

- `safetyGuards.ts`, `repetitionGuard.ts`, `conversationCompletion.ts`.
- `responseBank.ts` chỉ cần xem sau khi chứng minh fallback vẫn justified nhưng wording là nguồn low-human.

## Full-38 decision

Không chạy full-38. A/B xác nhận phần lớn residual Turn 2 có nguồn từ candidate/prompt-context,
không phải false-positive runtime guard. Cần audit prompt-memory-progress riêng trước gate lớn hơn.

## Hạn chế

- Audit metadata-only không lưu nội dung để đánh giá sắc thái ngữ nghĩa sâu.
- Số liệu là 27 cặp trên 9 slot, không đại diện full-38.
- Kết quả không đủ để điều chỉnh guard policy hoặc response bank.

## Final verdict

`MODEL_CONTEXT_FIX_REQUIRED`
