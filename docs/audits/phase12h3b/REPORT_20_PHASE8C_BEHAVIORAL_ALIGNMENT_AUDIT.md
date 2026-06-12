# REPORT 20 - Phase 8c Behavioral Alignment Audit

## 1. Audit status

- Status: PASS
- Scope: audit 2 mismatch còn lại của Phase 8c
- AI/Qwen called in this audit: NO
- Real Phase 8c rerun in this audit: NO
- Privacy mode preserved: YES

## 2. Root cause category

Selected categories:

- A. evaluator classifier keyword bug: YES
- F. metadata-only limitation: YES

Not selected:

- B. buyer_move mapping bug: NO direct evidence
- C. scenario expected_state too narrow: NO direct evidence
- D. scenario should allow adjacent states: NOT YET JUSTIFIED
- E. prompt/model behavior issue not provable without reply text: UNPROVEN

Exact conclusion:

- Có bug/risk rõ ở evaluator classifier:
  - `uncertain_interest` dùng keyword khá rộng/generic
  - state classifier chọn `bestState` theo số keyword hit cao nhất
  - khi tie score, state xuất hiện trước trong `STATE_RULES` sẽ thắng vì code chỉ thay khi
    `matchedKeywords.length > bestScore`, không thay khi `=`  
- Metadata hiện tại chưa lưu score theo từng state hay matched-keyword counts, nên chưa thể
  chứng minh chính xác từng mismatch row bị lệch vì:
  - true semantic mismatch
  - hay tie/near-tie bias của classifier

## 3. Mismatch rows (metadata only)

### S1_pricing_question

- `scenario_id = S1_pricing_question`
- `expected_state_value = pricing_phase`
- `actual_state_value = uncertain_interest`
- `expected_buyer_move = price_probe`
- `detected_buyer_move = clarify_interest`
- `mismatch_reason = detected_other_state`
- `evaluator_rule_id = state_uncertain_keywords_v2`
- `evaluator_rule_name = uncertain-interest keyword detector`
- `content_length = 32`
- `finish_reason = stop`
- `error_type = none`

### S3_logistics_question

- `scenario_id = S3_logistics_question`
- `expected_state_value = logistics_phase`
- `actual_state_value = pricing_phase`
- `expected_buyer_move = delivery_probe`
- `detected_buyer_move = price_probe`
- `mismatch_reason = detected_other_state`
- `evaluator_rule_id = state_pricing_keywords_v2`
- `evaluator_rule_name = pricing keyword detector`
- `content_length = 33`
- `finish_reason = stop`
- `error_type = none`

## 4. S1 analysis

### Expected vs actual

- Expected state: `pricing_phase`
- Actual detected state: `uncertain_interest`
- Expected buyer move: `price_probe`
- Detected buyer move: `clarify_interest`

### Interpretation

- Với metadata hiện tại, S1 không fail vì thiếu signal.
- Nó fail vì classifier detect một intent kiểu clarification / hesitation thay vì pricing.

### Should detected move be acceptable for pricing scenario?

- Không đủ cơ sở để auto-accept.
- Lý do:
  - detected move hiện tại là `clarify_interest`, không phải `price_probe`
  - metadata không cho thấy reply có đồng thời price-signal hay không

### Is uncertain_interest an adjacent/allowed pre-pricing state?

- Về mặt hội thoại, `uncertain_interest` có thể là trạng thái liền kề trước pricing.
- Nhưng với evaluator hiện tại, chưa đủ cơ sở để cho pass chỉ vì adjacency.
- Nếu nới ở đây quá sớm, evaluator sẽ mất khả năng phân biệt pricing intent thật với reply
  né tránh hoặc generic clarification.

### Should evaluator allow price_probe even when classifier says uncertain_interest?

- Câu trả lời cho row hiện tại: NO
- Vì row hiện tại không detect `price_probe`; nó detect `clarify_interest`.
- Điều nên làm trước không phải auto-pass, mà là lưu thêm state scores / matched-state counts
  để biết reply có đồng thời chứa price signal hay không.

## 5. S3 analysis

### Expected vs actual

- Expected state: `logistics_phase`
- Actual detected state: `pricing_phase`
- Expected buyer move: `delivery_probe`
- Detected buyer move: `price_probe`

### Interpretation

- Với metadata hiện tại, S3 bị classifier kéo sang pricing.
- Đây là mismatch đáng chú ý hơn S1 vì scenario logistics yêu cầu logistics-specific signal.

### Can pricing_phase be a valid adjacent state before logistics?

- Có thể tồn tại trong hội thoại thật.
- Nhưng với scenario explicit logistics question, adjacency pricing không đủ lý do để pass.

### Should logistics question require logistics-specific signal?

- YES
- Logistics scenario nên tiếp tục yêu cầu ít nhất một logistics-specific signal rõ ràng.

### Is evaluator confusing price terms with logistics terms?

- Có rủi ro rõ ràng ở classifier.
- Điều đã được chứng minh trong code:
  - pricing đứng trước logistics trong `STATE_RULES`
  - tie score sẽ nghiêng về pricing do điều kiện `>` thay vì `>=`
- Điều chưa được chứng minh từ artifact hiện tại:
  - row S3 cụ thể có phải tie hay không
- Kết luận:
  - nguy cơ confusion là REAL ở cấp code path
  - nguyên nhân chính xác của row S3 vẫn cần score-level metadata để xác nhận

## 6. Code-path findings

Relevant file:

- `src/run-phase8c.ts`

Relevant lines:

- `STATE_RULES`: [src/run-phase8c.ts](D:\Workspace\sale-testlab-data-pipeline\src\run-phase8c.ts:140)
- `detectReplyState(...)`: [src/run-phase8c.ts](D:\Workspace\sale-testlab-data-pipeline\src\run-phase8c.ts:659)
- `evaluateReply(...)`: [src/run-phase8c.ts](D:\Workspace\sale-testlab-data-pipeline\src\run-phase8c.ts:695)

Observed classifier behavior:

- `uncertain_interest` has generic keywords such as:
  - `xac nhan`
  - `chi tiet`
  - `tham khao`
- selection logic:
  - choose state with highest matched keyword count
  - no score export
  - no tie export
  - no adjacent-state handling
  - no scenario-aware allowance

## 7. Minimal fix proposal

Source patch in this audit: NO

Reason for not patching now:

- Metadata hiện tại chưa có:
  - per-state score
  - matched keyword counts by state
  - tie flag
- Vì vậy chưa an toàn để:
  - auto-pass `uncertain_interest` for S1
  - auto-pass `pricing_phase` for S3
  - hay nới adjacent states một cách đúng đắn

Recommended minimal next fix:

1. Patch `src/run-phase8c.ts` only
2. Add metadata-only diagnostics:
   - `candidate_state_scores`
   - `top_score`
   - `tied_top_states`
   - `tie_detected`
3. Keep current violations visible
4. Do not auto-pass all adjacent states
5. Only consider future relaxed pass if:
   - expected state has non-zero score
   - competing state is tie-level, not stronger
   - and scenario-specific allowance is explicitly justified

Recommended regression additions later:

- S1 case:
  - pricing + clarification mixed signal should remain visible, not silently auto-pass
- S3 case:
  - logistics + pricing tie should expose tie metadata instead of silently preferring pricing

## 8. Validation without AI

Validation run:

- `npx tsx src/runtime/phase8c_state_mismatch.regression.test.ts`
  - result: PASS

- `git status --short`
  - clean before creating this report

## 9. Files changed

- Source files changed: NONE
- Test files changed: NONE
- Audit file added:
  - `docs/audits/phase12h3b/REPORT_20_PHASE8C_BEHAVIORAL_ALIGNMENT_AUDIT.md`

## 10. Safe next step

- Safe to run tiny real Phase 8c rerun later: YES
- Only after adding score-level metadata
- Suggested scope later:
  - `--limit-records=1`
  - `--limit-scenarios=3`
  - metadata-only

## 11. Current block status

- Phase 8c remains blocked: YES
- Safe to rerun `5 archetypes x 3 scenarios` now: NO

Reason:

- 2 mismatch rows remain unexplained at score/tie level
- current artifacts prove improved evaluator labeling, but not enough to justify relaxing it

## 12. Privacy status

- Raw/session/persona content inspected: NO
- Prompt text printed: NO
- Reply text printed: NO
- Reasoning text printed: NO
- sale-testlab-data staged/tracked: NO

## 13. Blockers / warnings

- Biggest blocker is not transport/privacy anymore.
- Biggest blocker is classifier observability:
  - no state score distribution
  - no tie metadata
- Without that, any behavioral relaxation would be speculative.
