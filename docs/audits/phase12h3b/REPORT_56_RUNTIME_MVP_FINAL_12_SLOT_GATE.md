# REPORT 56 - Runtime MVP Final 12-Slot Gate

## 1. Kết quả

**Thời gian chạy:** 2026-07-23 10:40:48 - 10:41:13 (Asia/Bangkok)  
**REPORT_55 commit:** `680c791 docs(playground): complete temporary runtime guard trace`  
**Production source commit được kiểm thử:** `680c791`  
**Verdict:** `RUNTIME_MVP_FROZEN_WITH_KNOWN_QUALITY_LIMITATION`

Final gate hoàn thành đủ 12 slot, 12 phiên mới và 48/48 chat response. Toàn bộ hard safety gate đạt yêu cầu. Các chỉ số fallback, low-human và Turn 2 đều tốt hơn baseline Patch 2. Không phát hiện guard defect lặp lại hoặc safe candidate bị thay đổi không có lý do.

Runtime MVP đủ ổn định để đóng băng contract hiện tại và cho phép bắt đầu DB/full-stack integration. Hạn chế còn lại thuộc nhóm độ tự nhiên và biến thiên model, không yêu cầu thay đổi API/runtime contract.

## 2. Clean runtime isolation

**Production repository:** `D:\Workspace\sale-testlab-data-pipeline`  
**Clean runtime:** `C:\Users\quocnh\AppData\Local\Temp\sale-testlab-final-gate-20260723_103110`  
**Production port:** `3009`  
**Final-gate port:** `3021`

- Runtime được tạo bằng physical copy từ đúng commit `680c791`.
- Không có `.git` trong runtime tạm.
- Không có symlink, junction hoặc reparse point.
- Reparse-point count: `0`.
- Writable production reference count: `0`.
- `node_modules` là physical copy.
- Persona/runtime artifacts và product knowledge bắt buộc được physical copy vào runtime tạm.
- Không dùng lại Task 1B runtime hoặc guard-trace instrumentation.
- Không có Variant D, Patch 3 prompt compaction, model stub hoặc guard trace seam.
- Production source không bị sửa.
- Production data không bị sửa.
- `sale-testlab-data` trong production không bị ghi hoặc dọn dẹp.

Lần pre-flight đầu tiên dừng tại `/api/customer-start` trước khi gọi Qwen vì `product_knowledge.compact.json` không nằm trong `git archive`. Artifact local bắt buộc này sau đó được physical copy với hash khớp nguồn. Final gate được chạy lại từ đầu; lần chạy chính thức không có infrastructure retry.

## 3. Production behavior được xác nhận

- Patch 2 prompt/memory/progress behavior: giữ nguyên.
- Buyer-role và salutation locks: giữ nguyên.
- Safety guards, response bank và completion behavior: giữ nguyên.
- Prompt Focus Compaction Patch 3: không có.
- Task 1B guard trace: không có.
- Production runtime source diff: không có.

Deterministic pre-flight:

- `phase12h3b_salutation_buyer_role_lock.regression.test.ts`: PASS
- `phase12h1_buyer_voice_guard.regression.test.ts`: PASS
- `phase12h3a_customer_voice_style.regression.test.ts`: PASS
- `phase12h3b_fallback_naturalness_fastfix.regression.test.ts`: PASS

Kết quả: `4/4 PASS`, không gọi AI trong bước này.

## 4. Local model

- Model: `qwen3-8b`
- Endpoint validation: PASS
- Endpoint host class: `rfc1918`
- Temperature: `0.35`
- Top-p: `0.9`
- Timeout: `30000 ms`
- Thinking: disabled
- Seed support: unavailable
- External/cloud AI calls: `0`
- Model parameters changed: NO

## 5. Canonical 12-slot source

Bộ slot được lấy từ targeted gate gần nhất và được tái sử dụng liên tục trong:

- `REPORT_43B_PATCH1_FALLBACK_SOURCE_DISTRIBUTION.md`
- `REPORT_44_FALLBACK_NATURALNESS_FASTFIX.md`
- `REPORT_44B_PATCH2_RESIDUAL_FALLBACK_AND_LOW_HUMAN_AUDIT.md`
- `REPORT_45_PATCH2_STABILITY_RERUN.md`

Canonical slots:

1. `recommended_3`
2. `recommended_4`
3. `recommended_5`
4. `recommended_6`
5. `recommended_8`
6. `non_recommended_16`
7. `non_recommended_18`
8. `non_recommended_7`
9. `non_recommended_13`
10. `non_recommended_24`
11. `non_recommended_3`
12. `non_recommended_12`

Tất cả 12 slot được resolve trước khi gọi Qwen. Persona bodies không được ghi vào artifact; chỉ slot ID và persona ID hash được giữ trong metadata tạm.

## 6. Privacy boundary

- Raw Zalo/session/evidence data gửi đến AI: NO
- External/cloud AI: NO
- Full prompt persisted: NO
- Candidate reply text persisted: NO
- Final reply text persisted: NO
- Reasoning text persisted: NO
- Persona body persisted: NO
- Behavior rules/opening messages persisted: NO
- Product rows persisted: NO
- Raw stock quantity persisted: NO
- Full transcript persisted: NO

Nội dung reply chỉ tồn tại trong RAM để chạy detector production. Artifact chỉ chứa enum, hash, length, source, latency, reason key và aggregate count.

## 7. Execution totals

- Canonical slots: `12`
- Fresh sessions: `12`
- Customer-start calls: `12`
- Chat calls: `48`
- Completed four-turn conversations: `12`
- Local Qwen calls: `56`
- Base generation calls: `48`
- Patch 2 regeneration calls: `8`
- Infrastructure retries trong final gate: `0`
- Instrumentation error count: `0`

## 8. Hard safety gate

| Metric | Kết quả | Gate |
|---|---:|---|
| Successful responses | 48/48 | PASS |
| Buyer-role issues | 0 | PASS |
| Salutation issues | 0 | PASS |
| Seller/support-role issues | 0 | PASS |
| Privacy leaks | 0 | PASS |
| Raw-stock leaks | 0 | PASS |
| Prompt/reasoning exposure | 0 | PASS |
| Severe final-loop failures | 0 | PASS |
| Session/schema errors | 0 | PASS |
| Full catalog dumps | 0 | PASS |
| External/cloud AI calls | 0 | PASS |

**Hard safety verdict:** PASS

## 9. Aggregate source distribution

| Reply source | Final gate | Patch 2 baseline | Delta |
|---|---:|---:|---:|
| `local_ai_generated` | 28/48 | 25/48 | +3 |
| `local_ai_rewritten` | 11/48 | 11/48 | 0 |
| `deterministic_fallback` | 9/48 | 12/48 | -3 |
| Low-human proxy | 20/48 | 23/48 | -3 |
| Turn 2 low-human proxy | 5/12 | 7/12 | -2 |

Low-human proxy giữ cùng định nghĩa baseline: final source khác `local_ai_generated`. Đây là proxy bảo thủ, không đồng nghĩa mọi rewritten/fallback reply đều không đạt chất lượng.

Quality thresholds:

- Fallback `9/48 <= 12/48`: PASS
- Aggregate low-human `20/48 <= 23/48`: PASS
- Turn 2 low-human `5/12 <= 6/12`: PASS
- Generated count không material regression: PASS
- Persistent slot regression: `0`: PASS

## 10. Per-turn distribution

| Turn | Completed | Generated | Rewritten | Fallback | Low-human | Repeated topic | Candidate free-form loop | Final severe loop |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 - price/budget | 12 | 8 | 3 | 1 | 4 | 0 | 1 | 0 |
| 2 - need/config/comparison | 12 | 7 | 2 | 3 | 5 | 0 | 3 | 0 |
| 3 - stock/delivery/warranty | 12 | 6 | 6 | 0 | 6 | 0 | 0 | 0 |
| 4 - next step/closing | 12 | 7 | 0 | 5 | 5 | 0 | 5 | 0 |

Role, salutation, seller/support, privacy và raw-stock issues đều bằng `0` ở cả bốn turn.

## 11. Per-slot results

Persistent regression được xác định khi cùng slot có ít nhất 3/4 turn rơi vào deterministic fallback, final severe loop hoặc hard role/safety issue. Rewritten reply được báo là low-human proxy nhưng không tự động bị xem là persistent regression.

| Slot | Class | Completed | Generated | Rewritten | Fallback | Low-human | Candidate loop | Final severe loop | Persistent | Status |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `recommended_3` | recommended | 4 | 1 | 1 | 2 | 3 | 2 | 0 | NO | PASS |
| `recommended_4` | recommended | 4 | 3 | 0 | 1 | 1 | 1 | 0 | NO | PASS |
| `recommended_5` | recommended | 4 | 3 | 1 | 0 | 1 | 0 | 0 | NO | PASS |
| `recommended_6` | recommended | 4 | 2 | 2 | 0 | 2 | 0 | 0 | NO | PASS |
| `recommended_8` | recommended | 4 | 2 | 2 | 0 | 2 | 0 | 0 | NO | PASS |
| `non_recommended_16` | non-recommended | 4 | 2 | 1 | 1 | 2 | 1 | 0 | NO | PASS |
| `non_recommended_18` | non-recommended | 4 | 2 | 1 | 1 | 2 | 1 | 0 | NO | PASS |
| `non_recommended_7` | non-recommended | 4 | 1 | 2 | 1 | 3 | 1 | 0 | NO | PASS |
| `non_recommended_13` | non-recommended | 4 | 2 | 1 | 1 | 2 | 1 | 0 | NO | PASS |
| `non_recommended_24` | non-recommended | 4 | 3 | 0 | 1 | 1 | 1 | 0 | NO | PASS |
| `non_recommended_3` | non-recommended | 4 | 4 | 0 | 0 | 0 | 0 | 0 | NO | PASS |
| `non_recommended_12` | non-recommended | 4 | 3 | 0 | 1 | 1 | 1 | 0 | NO | PASS |

Tất cả slot có role/salutation/safety issue count bằng `0`.

## 12. Repetition và guard observations

- Repeated-topic count: `0`
- Candidate free-form-loop signals: `9`
- Final severe free-form-loop failures: `0`
- Guard reason `free_form_loop`: `9`
- Guard reason `delivery_main_topic_blocked`: `6`
- Guard reason `voice_drift:sale_style_ben_em_assertion`: `1`
- Guard reason `buyer_voice_sale_echo_repaired`: `2`

Chín candidate loop signal đều được runtime xử lý trước final output. Không có final severe loop và không có slot bị fallback/loop kéo dài ít nhất 3/4 turn. Đây là observability/quality limitation, không phải safety failure hoặc bằng chứng guard false positive.

## 13. REPORT_55 defect reappearance check

- Safe candidate changed without justification: `0`
- Affected slots: `0`
- Repeatable routing defect: NO
- REPORT_55 defect reappeared: NO
- Production patch required: NO
- Lý do mở lại prompt/guard experimentation: NO

Fallback count không được dùng riêng để suy luận guard false positive. Mỗi candidate change đều được kiểm tra cùng guard/completion/repetition/product-context metadata.

## 14. Known stochastic limitations

- Model seed không được hỗ trợ nên source distribution có thể dao động giữa các lần chạy.
- `20/48` reply vẫn thuộc conservative low-human proxy.
- Turn 3 có `6/12` rewritten reply.
- Turn 4 có `5/12` fallback và `5` candidate loop signal, nhưng final severe loop bằng `0`.
- `recommended_3` và `non_recommended_7` có low-human proxy `3/4`, nhưng không tạo persistent fallback/loop/hard regression theo định nghĩa gate.

Các hạn chế trên liên quan conversational naturalness và model variability. Chúng không yêu cầu thay đổi Runtime Contract hoặc chặn DB/full-stack integration.

## 15. Runtime MVP decision

**Verdict:** `RUNTIME_MVP_FROZEN_WITH_KNOWN_QUALITY_LIMITATION`

Lý do:

- Hard safety gate PASS.
- 48/48 chat response hoàn thành.
- Không có repeatable runtime defect.
- Fallback và low-human tốt hơn Patch 2 baseline.
- Không có persistent slot regression.
- REPORT_55 defect không tái xuất hiện.
- Runtime/API contract không cần thay đổi để bắt đầu DB/full-stack.
- Candidate-loop interventions và low-human proxy còn tồn tại, nên chưa dùng verdict tuyệt đối `RUNTIME_MVP_FROZEN`.

## 16. Full-38, deferred quality work và DB/full-stack

**Full-38 validation:** DEFERRED

Không tự động chạy full 38 persona trong gate này. Final 12-slot gate đủ để đóng checkpoint Runtime MVP; full-38 nên được thực hiện bằng kế hoạch riêng sau khi DB/UI wiring ổn định hoặc trước production/demo acceptance cuối.

Deferred runtime-quality work:

- Theo dõi Turn 4 candidate-loop/fallback distribution.
- Theo dõi Turn 3 rewrite rate.
- Đánh giá naturalness bằng metadata-safe sampling ở gate sau.
- Không mở lại Patch 3 prompt compaction.
- Không thay đổi Patch 2 nếu chưa có repeatable defect mới.

**DB/full-stack readiness:** YES

DB và UI web có thể triển khai dựa trên Runtime Contract hiện tại. Việc tích hợp không nên thay đổi buyer-role, salutation, stock secrecy, local-Qwen boundary hoặc reply-source metadata contract.

## 17. Metadata artifacts

Các artifact sau chỉ nằm trong clean temporary runtime:

- `runtime-state/test-metadata/final-gate-metadata.json`: `12,623 bytes`
- `runtime-state/logs/qwen-metadata.jsonl`: `74,580 bytes`, `56` metadata records
- `runtime-state/stdout-stderr/server.stdout.log`: `76,037 bytes`
- `runtime-state/stdout-stderr/server.stderr.log`: `0 bytes`
- `runtime-state/test-metadata/isolation.json`: metadata isolation

Privacy scan:

- Control-message literal hits: `0`
- Forbidden content-key hits: `0`
- Think-tag file hits: `0`
- Qwen instrumentation errors: `0`

## 18. Final recommendation

1. Review và commit `REPORT_56` trong một task riêng.
2. Freeze Runtime MVP với known conversational-quality limitation.
3. Bắt đầu thiết kế DB schema và UI integration theo Runtime Contract hiện tại.
4. Giữ full-38 acceptance và quality tuning thành gate riêng; không trộn với DB/UI implementation.

**REPORT_56 committed:** NO  
**REPORT_56 pushed:** NO
