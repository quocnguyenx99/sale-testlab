# Session Handoff - After Phase 12H Runtime Contract

## 1. Trạng thái hiện tại

Tính đến thời điểm tạo handoff này:
- Phase 12H.1-V đã accepted.
- Phase 12H.3-A đã accepted.
- Phase 12H.3-A.1 đã accepted.
- Live QA verdict alignment đã accepted.
- Runtime Contract đã được tạo, review, commit và push.

Trạng thái workspace:
- Nhánh hiện tại: `main`
- Working tree: sạch
- Runtime Contract đã ở trong git history
- Các commit quan trọng của Phase 12H runtime đã được push lên remote

## 2. Các commit đã tạo trong session

Các commit quan trọng đã được tạo:
- `3ec0029 feat: add phase 12H.3-A customer voice calibration`
- `5c2f0b6 test: align live QA verdict with phase 12H.3-A acceptance`
- `757aa4b docs: add phase 12H audit and session checkpoint`
- `b51767a chore: add local AI adapter error logging`
- `0d0a8f0 docs: add runtime contract for phase 12H`

Ghi chú:
- Runtime Contract commit hash đã có và không còn ở trạng thái pending.

## 3. Tóm tắt Runtime Contract

Baseline runtime đã được chốt với các nguyên tắc sau:
- Qwen3:8B là bộ sinh phản hồi chính.
- Guard chỉ sửa các vi phạm severe hoặc recoverable.
- Không dùng hardcoded response templates cho phản hồi bình thường.
- `local_ai_generated` = untouched Qwen reply.
- `local_ai_rewritten` = minimal acceptable repair.
- `deterministic_fallback` = severe fallback only.
- `forced_completion` = explicit completion/closing only.

Ý nghĩa vận hành:
- Ưu tiên giữ raw Qwen reply nếu phản hồi chấp nhận được.
- Nếu có repair thì repair phải tối thiểu, giải thích được, và dễ audit.
- Fallback không được dùng để xử lý style-only issue.

## 4. Frozen Safety Rules

Các rule safety đã được đóng băng:
- không fake price negotiation
- không payment/hold/close khi product context unknown/vague
- không proactive stock_qty/slctx leak
- không role inversion
- không severe Sale/CSKH voice
- không ambiguous “mẫu này/model này” close khi product chưa rõ

Price parser không được nhầm các context sau thành giá:
- `2-3 mẫu`
- `2 cái`
- `16GB`
- `512GB`
- `i5/i7`
- `HP Z2`
- part codes

## 5. Product Knowledge Rules

Các rule product knowledge đã được chốt:
- `price_si` = primary wholesale/dealer price
- `price_le` = retail/market reference
- `stock = 1/0`
- `slctx` = internal/reference only
- exact stock quantity chỉ được nhắc lại nếu Sale đã nói exact quantity trước
- `"có/co"` một mình không được resolve stock
- `"2-3 mẫu"` là option count, không phải stock leak

Ý nghĩa thực thi:
- Customer AI không được chủ động lộ `slctx` hoặc exact stock quantity nếu Sale chưa nói.
- Product context chỉ được xem là `specific` khi có bằng chứng đủ rõ về model cụ thể.

## 6. Customer Voice Rules

Các rule buyer voice hiện tại:
- Customer AI phải nghe như buyer thật, không phải Sale/CSKH.
- Style là soft gate, không phải critical fail nếu đứng một mình.
- `"Vâng/Dạ/ạ/nhé"` là soft markers, không severe nếu dùng riêng lẻ.
- buyer-side `"nhé"` được phép.
- sale-side `"chị nhé/anh nhé"` rủi ro hơn.
- Không rewrite full replies cho style-only issues.
- Soft findings phải được report, không bị ép sang fallback.

Nguyên tắc:
- Style scoring chỉ là lớp đo chất lượng buyer voice.
- Severe role inversion vẫn phải bị chặn.
- Không thêm template cứng để “làm đẹp” phản hồi.

## 7. Latest Accepted QA Metrics

Latest accepted QA metrics:
- Safety Gate 12H.1: PASS
- Style Gate 12H.3-A: PASS
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

Ghi chú:
- `local_ai_generated_untouched_rate = 75.0%` không còn là hard fail condition.
- Verdict pass được tính theo safety + style acceptance mới, không theo gate cũ.

## 8. Remaining Soft Finding

Soft finding còn lại:

`"Ok em, mẫu này bên em còn 2 cái. Em gửi anh giá sỉ trước nhé."`

Giải thích:
- Đây là style soft finding duy nhất còn lại trong accepted Live QA.
- Nó không làm fail phase.
- Không nên sửa bằng hardcoded rewrite.
- Dữ liệu thật và persona/data-driven calibration về sau có thể cải thiện câu này.

## 9. File/khu vực đã thay đổi gần đây

Các file thay đổi chính và vai trò:

- `src/runtime/conversationIdentity.ts`
  - buyer voice scoring, identity drift handling, customer voice rules
- `src/runtime/safetyGuards.ts`
  - guard severe, ambiguous model handling, buyer voice repair scope
- `src/runtime/conversationCompletion.ts`
  - reopen detection và completion-related gating
- `src/runtime/conversationMemory.ts`
  - product context persistence và model specificity memory
- `src/runtime/repetitionGuard.ts`
  - giảm false positive của free-form loop
- `src/runtime/runtimePromptBuilder.ts`
  - buyer voice calibration instructions trong prompt
- `src/runtime/live_qa_runner.ts`
  - QA verdict/report alignment theo acceptance mới
- `src/runtime/localAIRuntimeAdapter.ts`
  - thêm error logging cho local AI adapter failure
- `src/runtime/phase12h3a_customer_voice_style.regression.test.ts`
  - regression test cho style calibration
- `src/runtime/phase12h3a_style_false_positive.regression.test.ts`
  - regression test cho false positive/fallback/style classification
- `docs/RUNTIME_CONTRACT_PHASE12H.md`
  - baseline contract cho runtime Phase 12H

## 10. Regression Commands cần rerun

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

## 11. Những việc không được làm tiếp theo

Không được:
- tiếp tục chỉnh guard/style tự phát khi chưa có approved plan mới
- import full data trước khi Runtime Contract đã được commit
- thêm deterministic response templates
- exact-match style outputs
- coi style soft finding là critical fail
- parse quantity/spec/model-code thành price
- leak `slctx` hoặc exact stock quantity proactively

## 12. Hướng dẫn cho session tiếp theo

Session tiếp theo nên làm theo thứ tự:
1. Đọc `docs/SESSION_HANDOFF_AFTER_PHASE12H_CONTRACT.md`.
2. Check `git status`.
3. Xác nhận Runtime Contract đã được commit.
4. Push current clean commits nếu chưa push.
5. Lập plan cho Phase 12H.3-B - March Data Import & Behavior Extraction.
6. Chờ approval trước khi import 50 file March.
7. Ưu tiên data-driven calibration, không dùng hardcoded phrasing.

Điểm mấu chốt:
- Không bắt đầu import data ngay trong session kế tiếp nếu chưa có plan được duyệt.
- Runtime baseline hiện tại đã được chốt; mọi thay đổi tiếp theo phải bám vào contract và approved plan mới.
