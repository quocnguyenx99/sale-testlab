# REPORT 48 - Turn 2 Prompt, Memory and Progress Root Cause

Thời điểm: 2026-07-17 (Asia/Bangkok)

## Commit và phạm vi

- Commit Patch 2 được inspect: `3f7c4de fix(runtime): reduce fallback-heavy buyer responses`.
- Context đầu vào Turn 2 được audit cho 7 slot persistent/recurring từ REPORT 47.
- Không sửa source, không đổi model parameter, guard, response bank hay full-38.
- Metadata runtime bổ sung tối thiểu: 7 customer-start và 7 Turn 1 để tái tạo state ngay trước model
  ở Turn 2. Không có Turn 2 model call trong phần state audit này.

## Files và functions inspect

| File | Functions / trách nhiệm |
| --- | --- |
| `src/playground/server.ts` | `handleChatEnriched`; session turn assembly; update memory/progress; prompt call |
| `src/runtime/runtimePromptBuilder.ts` | `buildEnrichedRuntimePrompt`; memory/progress/history/gating assembly |
| `src/runtime/conversationMemory.ts` | `updateMemorySlots`; product context và discussed flags |
| `src/runtime/conversationProgressTracker.ts` | sale/customer progress; unresolved-topic selection |
| `src/runtime/repetitionGuard.ts` | blocked topic và progression instruction |
| `src/runtime/runtimeSessionManager.ts` | legacy prompt/session wrapper; không phải enriched playground path |
| `src/runtime/localAIRuntimeAdapter.ts` | local model call boundary và generation metadata |

## Pre-model assembly flow

1. `server.ts` lấy session hiện có và lịch sử turn đã persist.
2. Sale message hiện tại cập nhật `memorySlots` rồi `conversationProgress` trước khi model được gọi.
3. State router nhận latest Sale message và tối đa ba Sale message gần nhất.
4. Prompt builder nhận persona, identity, memory, progress, product context, recent history và scenario.
5. Local adapter gọi Qwen với prompt đã dựng.
6. Guard/repetition/completion chỉ chạy sau candidate; không nằm trong nguyên nhân pre-model này.

Sale message hiện tại không có trong `turns` tại thời điểm lấy `recent`; server append nó đúng một lần khi
truyền `recentMessages` vào prompt builder.

## Instruction inventory

| Nhóm instruction | Nguồn đóng góp | Duplicate | Xung đột | Multi-topic risk | Fixed progression |
| --- | ---: | --- | --- | --- | --- |
| Buyer identity | role prompt, identity block, adapter system | Có | Không thấy | Thấp | Không |
| Salutation / buyer voice | identity block, buyer voice calibration | Có | Không thấy | Thấp | Không |
| Persona style | role prompt, tối đa 5 behavior rules | Có | Có thể cạnh tranh current turn | Trung bình | Không |
| Conversation objective | runtime state, scenario, persona closing | Có | Có thể | Trung bình | Có thể |
| Current turn objective | latest Sale history, state router | Có | Không thấy | Thấp | Không |
| Unresolved topics | 9 progress lines, next topic, progression block | Cao | Có overlap | Cao | Có |
| Product context | product categories, memory, candidates, gating | Cao | Có thể mơ hồ | Cao | Có |
| Prohibited / safety | do-not, gating instructions, adapter system | Cao | Không thấy | Trung bình | Không |
| Progression / completion | topic order, next unresolved, progression, gating | Cao | Có overlap | Cao | Có |
| Repetition avoidance | progression instruction, retry path | Trung bình | Không thấy | Thấp | Có |

Static inventory của enriched path có các phần có mật độ cao: 12 memory lines, 9 topic-progress lines,
1 explicit next topic, 1 progression block gồm 5 instruction và khoảng 28 gating instruction tùy trạng
thái product. Chúng được ghép cùng role/persona/style/scenario/history/product context trong một prompt.
Không in nội dung prompt.

## Memory/progress consistency trước Turn 2

| Chỉ số metadata | Kết quả |
| --- | ---: |
| Slot được kiểm tra | 7/7 |
| Customer-start PASS | 7/7 |
| Turn 1 PASS | 7/7 |
| Answered topic vẫn unresolved | 0/7 |
| More than one next topic selected | 0/7 |
| Next unresolved topic = stock | 7/7 |
| Product context = vague | 7/7 |
| Product knowledge used | 7/7 |
| Selected exact product model present | 0/7 |

Ở cả 7 slot, trước Turn 2:

- `product_model`, `configuration`, `price` đều đã answered.
- `stock` là next unresolved duy nhất.
- Không có evidence cho `TOPIC_STATE_STALE`.

Tuy nhiên, `memorySlots` vẫn mô tả nhiều topic đã discussed và product context vẫn vague. Các nhãn này,
product candidates và 9 dòng progress được inject song song với next-topic/progression instruction.

## History assembly

| Chỉ số | Kết quả |
| --- | ---: |
| History item count trước Turn 2 | 4/7 slot |
| Role sequence | customer_ai, sale, customer_ai, sale |
| Duplicate history item | 0/7 |
| Current Sale message bị append đôi | 0/7 |
| Prior turn là fallback/rewrite | 4/7 |

Không có evidence cho `HISTORY_DUPLICATION`. Fallback/rewrite trong lịch sử được giữ như customer turn
bình thường; đây là hành vi cần biết nhưng chưa đủ để kết luận root cause.

## Findings theo slot

| Slot | Next topic | Answered stale | History duplicate | Product status | Prior rewrite/fallback |
| --- | --- | --- | --- | --- | --- |
| recommended_5 | stock | No | No | vague | No |
| non_recommended_16 | stock | No | No | vague | No |
| non_recommended_3 | stock | No | No | vague | Yes |
| non_recommended_12 | stock | No | No | vague | Yes |
| recommended_3 | stock | No | No | vague | Yes |
| recommended_6 | stock | No | No | vague | Yes |
| non_recommended_18 | stock | No | No | vague | No |

## Root-cause classification

### PROMPT_OVERCONSTRAINT - CONFIRMED

Evidence:

- State metadata đã sạch và chỉ chọn một next topic, nhưng REPORT 47 vẫn thấy 22/27 candidate lặp
  price/configuration trước guard.
- Cùng information được đưa qua memory, progress, product context, next-topic, progression và gating.
- Product context vague ở 7/7 slot làm gating block bổ sung thêm chỉ dẫn làm rõ model/configuration.
- Persona rules/style/closing còn đồng thời tham gia, tăng cạnh tranh với next Turn 2 objective.

Likely source: `buildEnrichedRuntimePrompt` trong `runtimePromptBuilder.ts`.

### PROGRESSION_CHECKLIST - CONFIRMED, là thành phần của overconstraint

`TOPIC_ORDER` kết hợp `getFirstUnresolvedTopic` và `buildProgressionInstruction` tạo progression cố định.
Trong state hiện tại next topic là stock, nhưng prompt vẫn inject toàn bộ progress/topic context. Qwen nhận
nhiều cue về price/configuration/model đã xử lý lẫn cue stock cần hỏi tiếp, dẫn đến candidate multi-topic.

### TOPIC_STATE_STALE - NOT CONFIRMED

0/7 slot có answered topic vẫn unresolved; không nên patch progress tracker cho giả thuyết này.

### HISTORY_DUPLICATION - NOT CONFIRMED

0/7 slot có duplicate history; không nên patch assembly history chỉ để xử lý repetition.

### MULTI_INTENT_INJECTION - CONTRIBUTING

Không có nhiều `next topic` được chọn trong state. Rủi ro nằm ở nhiều instruction source đồng thời nhắc
topic/progression, không phải multiple next-topic selector.

### PERSONA_RULE_CONFLICT / MODEL_PARAMETER_SUSPECT - NOT PROVEN

Chưa có bằng chứng để đổi persona rule hoặc model parameter trước khi giảm prompt overlap.

## Narrow Patch 3 recommendation

Target duy nhất: `src/runtime/runtimePromptBuilder.ts`.

Ý tưởng tối thiểu:

1. Với enriched playground path, giữ một `next_turn_focus` duy nhất từ `getFirstUnresolvedTopic`.
2. Thay 9 detailed progress lines và progression checklist bằng summary ngắn gồm:
   completed topic labels, một blocked-topic summary và một next focus.
3. Giữ product-context gate nhưng không lặp lại các cue price/configuration đã answered trong cùng Turn 2
   khi `next_turn_focus` là stock.
4. Không thay đổi memory data, progress semantics, safety/repetition/completion guard hoặc response bank.

Điều này giảm competition trong prompt trước Qwen thay vì nới guard sau Qwen.

## Expected files changed

- `src/runtime/runtimePromptBuilder.ts`
- Một regression test mới hoặc mở rộng cho prompt metadata (nếu Patch 3 được duyệt).

Không thay đổi:

- `src/runtime/safetyGuards.ts`
- `src/runtime/repetitionGuard.ts`
- `src/runtime/conversationCompletion.ts`
- `src/runtime/responseBank.ts`
- buyer-role/salutation locks
- model parameters

## Patch 3 acceptance

Candidate A/B gate 27 pairs:

| Metric | Baseline | Target |
| --- | ---: | ---: |
| Candidate low-human | 22/27 | <= 12/27 |
| Candidate repeated-topic/free-form-loop | 22/27 | <= 10/27 |
| Safe candidate preservation | 100% | 100% |
| Runtime false positive | 0 | 0 |
| Buyer role / salutation / privacy / raw stock | 0 | 0 |

Targeted 12-slot gate:

- Chat PASS 48/48.
- Deterministic fallback <= 12/48.
- Aggregate low-human <= 20/48.
- Turn 2 low-human average <= 6/12.

## Full-38 decision

Không chạy full-38. Chỉ chạy lại A/B 27 pairs và targeted 12-slot gate sau Patch 3 được duyệt.

## Final verdict

`PROMPT_OVERCONSTRAINT_CONFIRMED`
