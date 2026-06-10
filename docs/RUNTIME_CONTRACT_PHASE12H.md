# Runtime Contract - Phase 12H

## 1. Mục đích

Runtime này là lớp Customer AI chat runtime dùng cho Sale training.
Mục tiêu là giữ được hội thoại buyer-side tự nhiên, an toàn, có thể audit, và ổn định trước khi import data quy mô lớn hơn.

Nguyên tắc vận hành:
- Qwen3:8B là bộ sinh phản hồi chính.
- Guard layer chỉ sửa các vi phạm severe hoặc recoverable, không thay model làm bộ sinh mặc định.
- Tránh hardcoded response templates cho phản hồi thông thường.
- Nếu có local repair thì phải là repair tối thiểu, giải thích được, và dễ audit.

## 2. Trạng thái Phase đã chấp nhận

Các phase sau đã được chấp nhận:
- Phase 12H.1-V Rewrite Scope Guard & Numeric Context Fix: accepted.
- Phase 12H.3-A Customer Voice Style Calibration: accepted.
- Phase 12H.3-A.1 Style Scoring & Fallback False Positive Fix: accepted.
- Live QA verdict alignment: accepted.

Runtime Contract này là baseline đóng băng trước khi đi sang import data.

## 3. Luồng Runtime

Luồng xử lý runtime hiện tại:

Sale message  
-> product mention/context extraction  
-> conversation memory/progress  
-> runtime prompt builder  
-> Qwen3 raw reply  
-> identity/voice drift repair  
-> safetyGuards  
-> completion/deal state metadata  
-> final reply + metrics

Ý nghĩa:
- Sale message được đưa qua memory và product context trước khi build prompt.
- Qwen3 sinh `raw_model_reply`.
- Runtime có thể sửa nhẹ nếu có drift recoverable.
- Guard chỉ fallback trong các severe case hợp lệ.
- Final output luôn đi kèm metadata và metrics để QA/audit.

## 4. Reply Source Semantics

Định nghĩa chính thức:
- `local_ai_generated` = untouched Qwen reply.
- `local_ai_rewritten` = minimal acceptable local repair.
- `deterministic_fallback` = severe fallback only.
- `forced_completion` = explicit completion/closing condition only.
- `effective_ai_response_rate` = `local_ai_generated + local_ai_rewritten`.

Nguyên tắc:
- `local_ai_generated` là target ưu tiên.
- `local_ai_rewritten` vẫn được xem là AI-originated response nếu rewrite là tối thiểu và chấp nhận được.
- `deterministic_fallback` không được dùng cho style-only issue.
- `forced_completion` chỉ được kích hoạt khi completion/deal-state đạt điều kiện rõ ràng.

## 5. Frozen Safety Rules

Những rule dưới đây được đóng băng trong Runtime Contract:
- không fake price negotiation
- không payment/hold/close khi product context unknown/vague
- không proactive stock_qty/slctx leak
- không role inversion
- không severe Sale/CSKH voice
- không ambiguous "mẫu này/model này" close khi product chưa rõ

Price parser không được nhầm các context sau thành giá:
- `2-3 mẫu`
- `2 cái`
- `16GB`
- `512GB`
- `i5/i7`
- `HP Z2`
- part codes

Frozen expectation:
- không được mở rộng parser theo hướng dễ đổi quantity/spec/model code thành price.
- không được nới lỏng guard để chạy theo naturalness mà hy sinh safety.

## 6. Product Knowledge Rules

Rule product knowledge đã được chốt:
- `price_si` = primary wholesale/dealer price.
- `price_le` = retail/market reference.
- `stock = 1/0`.
- `slctx` là internal/reference only.
- exact stock quantity chỉ được mention nếu Sale đã nói exact quantity trước.
- `"có/co"` một mình không được resolve stock.
- `"2-3 mẫu"` là option count, không phải stock leak.

Giải thích thêm:
- `slctx` không phải thông tin để Customer AI chủ động phát ngôn.
- nếu Sale chưa nói exact quantity, Customer AI không được phát minh hay lặp ra stock qty.
- product context chỉ được xem là `specific` khi có bằng chứng đủ model rõ ràng.

## 7. Customer Voice Rules

Runtime phải giữ buyer voice theo các rule sau:
- Customer AI phải nói giống buyer thật, không phải Sale/CSKH.
- Style là soft gate, không phải critical fail nếu đứng một mình.
- `"Vâng/Dạ/ạ/nhé"` là soft markers, không severe nếu dùng riêng lẻ.
- buyer-side `"nhé"` được phép.
- sale-side `"chị nhé/anh nhé"` là riskier.
- không rewrite full replies cho style-only issues.
- soft findings phải được report, không được ép thành fallback.

Nguyên tắc áp dụng:
- style scoring dùng để đo chất lượng buyer voice.
- severe role inversion vẫn phải bị chặn.
- style calibration phải ưu tiên prompt + minimal repair, không dùng template cứng.

## 8. Accepted Live QA Metrics

Latest accepted Live QA metrics:
- `critical_fail_count = 0`
- `fallback_rate = 0.0%`
- `exact_template_usage_count = 0`
- `forced_completion_rate = 0.0%`
- `average_buyer_voice_score = 97.0/100`
- `sale_tone_high_count = 1/12`
- `local_ai_generated_untouched_rate = 75.0%` observation only
- `local_ai_rewritten_rate = 25.0%`
- `effective_ai_response_rate = 100.0%`
- `rewritten_cases_minimal_and_acceptable = YES`

Giải thích:
- `local_ai_generated_untouched_rate = 75.0%` không phải hard fail condition.
- metric này chỉ là observation.
- verdict style pass được đưa trên tổng hợp untouched + rewritten acceptable, không chỉ dựa trên untouched rate.

## 9. Remaining Soft Finding

Soft finding còn lại đã được chấp nhận:

`"Ok em, mẫu này bên em còn 2 cái. Em gửi anh giá sỉ trước nhé."`

Giải thích:
- Đây là style soft finding.
- Nó không fail phase.
- Future data/persona calibration có thể cải thiện tone buyer tự nhiên hơn.
- Không được thêm hardcoded rewrite chỉ để sửa riêng case này.

Hướng xử lý về sau:
- ưu tiên data-driven calibration
- ưu tiên persona/behavior extraction
- không mở thêm deterministic rule chỉ cho một case lẻ

## 10. Regression Commands

```bash
npx tsx src/runtime/phase12h3a_style_false_positive.regression.test.ts
npx tsx src/runtime/phase12h3a_customer_voice_style.regression.test.ts
npx tsx src/runtime/phase12h1_rewrite_scope_guard.regression.test.ts
npx tsx src/runtime/phase12h1_buyer_voice_guard.regression.test.ts
npx tsx src/runtime/phase12h1_final_manual_patch.regression.test.ts
npx tsx src/runtime/phase12h1_guard_sensitivity.regression.test.ts
npx tsx src/runtime/phase12h1_regression_fix.regression.test.ts
npx tsx src/runtime/phase12h1_product_context_gating.regression.test.ts
npm run test:phase12f
npx tsx src/runtime/phase12g_lite.regression.test.ts
npx tsx src/runtime/phase12h_deal_state.regression.test.ts
npx tsx src/runtime/live_qa_runner.ts
```

## 11. Do-Not-Break Rules

Future phases không được:
- weaken 12H.1-V safety guards
- add deterministic response templates
- exact-match style outputs
- treat style soft finding as critical fail
- parse quantity/spec/model-code as price
- leak slctx hoặc exact stock quantity proactively
- import full data before contract is committed

Đây là những boundary bắt buộc để giữ runtime ổn định sau khi đã accept.

## 12. Khuyến nghị Phase tiếp theo

Sau khi commit contract này:
1. Plan Phase 12H.3-B - March Data Import & Behavior Extraction.
2. Import full 50 March files chỉ sau khi plan được approve.
3. Extract persona/behavior patterns.
4. Ưu tiên data-driven calibration thay vì hardcoded phrasing.

Khuyến nghị chiến lược:
- Không nhảy thẳng vào behavioral rewrite bằng tay.
- Dùng dữ liệu March để làm calibration và persona refinement.
- Giữ Runtime Contract này làm baseline trước mọi thay đổi lớn hơn.
