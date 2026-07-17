# REPORT 49 - Prompt Focus Compaction Patch

Thời điểm: 2026-07-17 (Asia/Bangkok)

## Baseline

- Git baseline: `9c5da76 docs(playground): add Turn 2 model-context audits`.
- Root cause trước patch: `PROMPT_OVERCONSTRAINT_CONFIRMED` từ REPORT 48.
- Scope patch chỉ gồm `src/runtime/runtimePromptBuilder.ts` và một regression test mới.
- Không thay đổi memory/progress semantics, guards, completion, response bank, adapter/model parameter
  hay Runtime Contract.

## Files changed

| File | Thay đổi |
| --- | --- |
| `src/runtime/runtimePromptBuilder.ts` | Compact enriched prompt quanh một next-turn focus; summary memory/topic state; compact product gate; bỏ raw stock quantity khỏi product prompt context |
| `src/runtime/phase12h3b_prompt_focus_compaction.regression.test.ts` | Khóa metadata prompt, one-focus, safety/identity/product grounding và stock secrecy |

## Patch scope

1. Thay detailed memory flags bằng 3 dòng summary: product-context status, discussed topics và
   grounded candidate count.
2. Thay 9 detailed topic-progress lines, explicit old next-topic line và progression checklist bằng:
   `completed_topics`, `blocked_or_avoid_topics` và đúng một `NEXT_TURN_FOCUS`.
3. Compact product gate theo context status và focus; khi vague + stock focus, không đưa price/config
   trở lại thành positive next action.
4. Giữ buyer voice, identity/salutation, product grounding, privacy và raw-stock secrecy.
5. Product candidate block không còn chèn `stock_qty` nội bộ vào prompt; chỉ giữ stock status.

## Prompt metadata before and after

| Prompt component | Before | After |
| --- | ---: | ---: |
| Detailed memory lines | 12 | 3 |
| Detailed progress lines | 9 | 0 |
| Explicit next-topic lines | 1 | 1 |
| Progression checklist lines | 5 | 0 |
| Product gate lines, vague + stock focus | khoảng 28 | 9 |
| Topic-state summary lines | 0 | 3 |
| Raw stock quantity in prompt | Có | Không |

Phần memory/progress/progression/product-gate giảm từ khoảng 55 instruction fragments xuống 15.

## Deterministic regression

| Test | Result |
| --- | --- |
| `phase12h3b_salutation_buyer_role_lock` | PASS |
| `phase12h1_buyer_voice_guard` | PASS |
| `phase12h3a_customer_voice_style` | PASS |
| `phase12h3b_fallback_naturalness_fastfix` | PASS |
| `phase12h3b_prompt_focus_compaction` | PASS |

Regression mới xác nhận một `NEXT_TURN_FOCUS`, absence of detailed progression checklist, product
grounding preserved, buyer role/salutation/privacy/stock-secrecy markers preserved và không chèn
synthetic raw stock quantity.

## Candidate A/B - 9 slots x 3 repetitions

| Metric | REPORT 47 baseline | Patch 3 | Target |
| --- | ---: | ---: | ---: |
| Completed pairs | 27 | 27 | 27 |
| Candidate low-human | 22 | 22 | <= 12 |
| Candidate repeated-topic/free-form-loop | 22 | 17 | <= 10 |
| Candidate product-context issue | 5 | 5 | - |
| Safe candidate preserved | 4/4 | 5/5 | 100% |
| Runtime false positive | 0 | 0 | 0 |
| Buyer role / salutation / privacy / raw stock | 0 | 0 | 0 |
| Final local AI generated | 11 | 13 | - |
| Final local AI rewritten | 5 | 7 | - |
| Final deterministic fallback | 11 | 7 | - |

Candidate repetition giảm 5 call nhưng candidate low-human không giảm. Patch đáp ứng safety và
preservation invariants, nhưng không đạt candidate acceptance.

## Targeted runtime gate - 12 slots x 4 turns

| Metric | Patch 2 stability baseline | Patch 3 | Target |
| --- | ---: | ---: | ---: |
| Customer-start / chat pass | 12/12, 48/48 | 12/12, 48/48 | 12/12, 48/48 |
| Timeout / error | 0 / 0 | 0 / 0 | 0 / 0 |
| Local AI generated | 25 | 21 | - |
| Local AI rewritten | 11 | 4 | - |
| Deterministic fallback | 12 | 23 | <= 12 |
| Aggregate low-human | 23 | 27 | <= 20 |
| Turn 2 low-human | 7/12 | 9/12 | <= 6/12 |
| Buyer role / salutation / support | 0 | 0 | 0 |
| Privacy / raw stock leak | 0 | 0 | 0 |

Fallback tăng mạnh ở runtime gate. Metadata trigger chủ đạo vẫn là repeated-topic, free-form loop,
reopened topic và final guard; không có evidence để nới những guard này.

## Safety and privacy

- Local Qwen được gọi gián tiếp qua `/api/chat` cho A/B và targeted validation.
- External/cloud AI: không gọi.
- Không persist full prompt, full reply, reasoning, persona đầy đủ, raw product row hay raw stock quantity.
- Buyer role, salutation, support tone, privacy và raw-stock leak: tất cả bằng 0 trong validation.

## Verdict

`FAIL`

Prompt focus compaction giảm repetition signal ở candidate nhưng không giảm low-human và gây regression
fallback/low-human ở targeted runtime gate. Không chấp nhận Patch 3 ở trạng thái hiện tại.

## Full-38 decision

Không chạy full-38. Không commit patch hiện tại.

## Known limitations

- Local model vẫn có sampling variance; A/B và targeted gate có distribution khác nhau.
- Metadata-only audit không giữ text để phân tích semantic nuance.
- Sự tăng fallback sau compaction cho thấy context bị loại bỏ có thể mang giá trị định hướng tự nhiên,
  nên không nên tiếp tục giảm instruction bằng cách phỏng đoán.

## Recommended next action

1. Không nới safety/repetition/completion guards.
2. Audit prompt contribution theo section-level ablation trên một gate nhỏ, chỉ thay một section tại một
   thời điểm trong harness tạm; không sửa production trước khi xác định section gây regression.
3. Giữ raw-stock secrecy change để review riêng, nhưng không commit Patch 3 như một acceptance checkpoint
   khi runtime gate đang FAIL.
