# REPORT 57B - Manual Long-Session Replay Audit

**Thời điểm:** 2026-07-24 (Asia/Bangkok)  
**Source commit:** `680c7915dd536d2436ea79f941c5df6f2920a0ae`  
**Verdict:** `COMBINED_NARROW_RUNTIME_DEFECT_PROVEN`

## 1. Phạm vi và giới hạn bằng chứng

Replay dùng đúng câu buyer bị báo cáo ở các lượt lỗi. Các lượt còn lại được dựng từ chuỗi sự kiện thiết yếu do transcript đầy đủ không có trong task context.

Vì vậy:

- current helper/runtime behavior được chứng minh;
- exact final-reply repetition của phiên gốc chỉ được xem là reproduced khi cùng final hash lặp;
- khác biệt do thiếu transcript đầy đủ được ghi là giới hạn, không suy diễn thành root cause.

## 2. Runtime cô lập

**Temp root:** `C:\Users\quocnh\AppData\Local\Temp\sale-testlab-runtime57-20260724_092002`

Isolation:

- physical source copy từ `git archive HEAD`: PASS;
- `.git` trong temp: NO;
- symlink/junction/reparse point: 0;
- production source reference có thể ghi: NO;
- production data reference có thể ghi: NO;
- dedicated fixture/session/cache/log/output paths: YES;
- dedicated port: `3019`;
- production port `3009` được dùng: NO;
- temp server đã dừng sau replay: YES.

Official artifact hash match:

- enriched personas JSONL: PASS;
- persona identity summary: PASS;
- runtime personas JSONL: PASS;
- `product_knowledge.compact.json`: PASS.

Metadata:

- enriched persona artifact: 132,183 bytes;
- runtime persona artifact: 20,993,408 bytes;
- product knowledge artifact: 3,859,949 bytes;
- persona count qua isolated `/api/version`: 38.

Không ghi prompt, reply, reasoning, persona body, product row hoặc raw stock vào report/trace.

## 3. Mode A - Deterministic state replay

**Status:** PASS  
**Qwen calls:** 0  
**External/cloud AI calls:** 0  
**Sale/buyer pairs:** 6

### Kết quả tổng hợp

- ordinal references detected bởi audit probe: 2;
- ordinal references resolved bởi runtime: 0;
- first modifying boundary trong emulation: turn 2, `response_bank`;
- same-final-hash repetition tối đa: 1;
- exact repeated final fallback: NO;
- buyer-role issue: 0;
- salutation issue: 0.

### Memory probe trên manual fixture

Từ turn 1 đến turn 6:

- `product_context_status = specific`;
- candidate count = 1;
- selected code hash giữ nguyên: `5e6f511953555acc`;
- selected code xuất hiện trong Sale message hiện tại: NO;
- selected display name khớp expected product family: NO;
- selected stock status: `out_of_stock`.

Đây là bằng chứng runtime **nhận nhầm một catalog candidate thành product cụ thể**. Nó không nhận ba cấu hình được mô tả thành một candidate set đúng.

### Controlled multi-model reachability probe

Probe dùng ba model codes từ bản sao product knowledge, không ghi code hoặc product row vào trace.

Kết quả:

- input model count: 3;
- extracted candidate count: 4;
- context: `vague`;
- selected product code: absent;
- completion block reason: `product_context_vague_not_specific`;
- completion output hash: `c6958ddb862c2d57`;
- completion hash trùng manual-defect hash: YES;
- response-bank variant: `product_context_gating_clarify`;
- response-bank output hash: `c6958ddb862c2d57`;
- response-bank hash trùng manual-defect hash: YES;
- safety guard triggered: YES;
- safety reason: `ambiguous_model_guard_triggered`;
- safety output là near match, không exact hash.

Kết luận: exact manual sentence hiện **có thể được tạo deterministically** từ completion và response bank khi context là `vague`.

## 4. Mode B - Một live local-Qwen conversation

**Status:** COMPLETED_ONCE  
**Conversations:** 1  
**Chat turns:** 6  
**Local Qwen calls:** 6  
**Regeneration calls:** 0  
**External/cloud AI calls:** 0

Qwen metadata:

- model path: approved local endpoint;
- generated source records: 6;
- error types: none;
- content length range: 42-50 characters;
- reasoning length max: 0;
- prompt/reply/reasoning persisted: NO.

### Turn-level evidence

#### Turn 1

- sale hash: `c33d0b99ad066c9a`;
- candidate/final hash: `6a7f31f2d7f92e49`;
- source: `local_ai_generated`;
- candidate = final: YES;
- context: `specific`;
- selected code hash: `5e6f511953555acc`;
- candidate count: 1;
- quoted numeric price: NO;
- next topic: `configuration`;
- completion block: `product_stock_out_of_stock`;
- modifying boundary: none.

**First state defect observable:** selected catalog candidate không được Sale nhắc và không khớp expected family, nhưng runtime đánh dấu `specific`.

#### Turn 2

- sale hash: `a8752e6207ab8c89`;
- candidate/final hash: `7fbdcdc0bf659476`;
- source: `local_ai_generated`;
- context: `specific`;
- next topic: `price`;
- soft repeated topic count: 1;
- modifying boundary: none.

#### Turn 3

- sale hash: `22d892dd1da7e695`;
- candidate/final hash: `cf33d99bb6a6d081`;
- source: `local_ai_generated`;
- concrete price count: 3;
- next topic: `stock`;
- context vẫn `specific` với cùng selected code không phù hợp;
- modifying boundary: none.

Buyer ordinal trong recorded fixture không được runtime memory giải. Live Qwen candidate không giữ ordinal signal ở output nên output-side ordinal count là 0; source/state audit vẫn xác nhận không có resolver.

#### Turn 4

- sale hash: `3625428ef0ce098a`;
- candidate/final hash: `0aeb966fc1c5ca11`;
- source: `local_ai_generated`;
- next topic: `stock`;
- modifying boundary: none.

#### Turn 5

- sale hash: `f46156dcc0250fc8`;
- raw/candidate hash: `cf33d99bb6a6d081`;
- final hash: `b0d316d6f76f1cad`;
- source: `deterministic_fallback`;
- raw candidate lặp lại hash turn 3: YES;
- repeated freeform loop: YES;
- first modifying boundary: `response_bank`;
- fallback variant: `stock_3`;
- same-final-hash repetition count: 1.

#### Turn 6

- sale hash: `e53dded5e71f9ed6`;
- raw/candidate hash: `cf33d99bb6a6d081`;
- final hash: `feb883ee19a78a2a`;
- source: `deterministic_fallback`;
- raw candidate lặp lại hash turn 3 và 5: YES;
- repeated freeform loop: YES;
- first modifying boundary: `response_bank`;
- fallback variant: `stock_2`;
- same-final-hash repetition count: 1.

## 5. First failure và first modifying boundary

Có ba mốc khác nhau:

1. **State defect đầu tiên:** turn 1, catalog candidate không khớp expected family nhưng bị đánh dấu `specific`.
2. **Ordinal defect:** turn 3 trong deterministic fixture, 2 ordinal references detected và 0 resolved.
3. **Loop/boundary đầu tiên trong live replay:** turn 5, raw Qwen candidate lặp hash turn 3; response bank là first modifying boundary.

Fixed clarification exact hash không xuất hiện trong live replay này.

## 6. Defect classification

### Confirmed

#### `PRODUCT_CONTEXT_NOT_RECOGNIZED`

- Expected family không khớp selected catalog candidate.
- Selected code không xuất hiện trong Sale message.
- Runtime vẫn gán `specific`.

#### `ORDINAL_SELECTION_NOT_DETECTED`

- Source không có ordinal detector trong memory/session path.
- Audit probe phát hiện 2 references nhưng runtime không ghi nhận.

#### `ORDINAL_SELECTION_NOT_RESOLVED`

- Runtime không có ordinal-to-candidate mapping.
- Resolved count = 0.

#### `PRICE_VALUE_NOT_GROUNDED`

- Numeric quoted-price evidence được phát hiện.
- Không có binding giữa ba Sale-quoted prices và selected product/candidate set đúng.
- Selected candidate vẫn là code không được Sale nhắc.

#### `QWEN_CANDIDATE_LOOP`

- Raw candidate hash `cf33d99bb6a6d081` xuất hiện ở turn 3, 5 và 6.
- Đây là model/prompt-context contribution đã chứng minh, không phải suy đoán.

#### `GUARD_JUSTIFIED_INTERVENTION`

- Response bank can thiệp ở turn 5 và 6 sau freeform loop.
- Hai final hashes khác nhau; guard đã phá exact repetition trong replay.

### Current active risk, chưa confirmed trên manual fixture

#### `PRODUCT_CONTEXT_LOST_AFTER_RECOGNITION`

Source có thể xóa selected model khi một message khớp nhiều products, nhưng fixture rút gọn không đi từ một valid selected model sang lost state.

#### `CANDIDATE_SET_NOT_PERSISTED`

Source thay candidate summary theo message mới. Replay chứng minh candidate set hiện tại sai/thiếu, nhưng chưa chứng minh một valid set đã từng được lưu rồi mất.

### Disproven trong current replay

#### `PRICE_PROMISE_FALSELY_RESOLVED`

Price promise không đánh dấu price answered; numeric prices mới làm progress chuyển trạng thái.

#### `TOPIC_PROGRESS_ORDER_DEFECT`

Current topic order không đẩy delivery trước model/config/price/stock.

#### `COMPLETION_FALLBACK_REPEATED`

- Completion không phải first modifying boundary live.
- completion forced count = 0.
- same final hash max = 1.

#### `RESPONSE_BANK_VARIANT_REPEATED`

- Turn 5 và 6 dùng variants khác nhau.
- final hashes khác nhau.

#### `IDENTITY_BLIND_HARDCODE`

- buyer-role/salutation issue = 0.
- fixed clarify templates hiện identity-aware.

### Inconclusive

#### Exact final repetition của phiên thủ công

- Không reproduced trong một live conversation.
- Transcript đầy đủ không có; không được rerun do nondeterminism policy.
- Controlled probe chứng minh exact literal reachable, nhưng không chứng minh đó là boundary của phiên gốc.

## 7. Overlap với deep audit cũ

Được current replay hỗ trợ một phần:

- candidate/context injection và product context có vấn đề;
- model có thể lặp candidate;
- guard/repetition path có thể thay output.

Không được current replay hỗ trợ:

- identity-blind completion;
- price promise resolving price;
- price negotiation không có actual quote;
- current topic order sai;
- completion là nguồn lặp chính;
- phần trăm root-cause cũ.

## 8. Contribution của regression test cũ

`phase12h1_product_context_gating.regression.test.ts`:

- xác nhận gate unknown/vague/specific vẫn hoạt động;
- khóa exact clarify prefix;
- không kiểm tra candidate relevance;
- không kiểm tra multi-model persistence;
- không kiểm tra ordinal resolution;
- không kiểm tra quoted price binding;
- không kiểm tra final hash repetition.

Test này không tạo defect, nhưng hiện có thể khiến một thay đổi wording đơn thuần bị coi nhầm là sửa root cause.

## 9. REPORT_56, Runtime Contract và DB/full-stack

- REPORT_56 addendum needed: **YES**. Final 12-slot gate không bao phủ long-session multi-model/ordinal flow.
- Runtime Contract remains frozen: **YES**. Safety/privacy/role contract không cần nới.
- Runtime implementation fully frozen: **NO**; cần narrow state fix.
- DB/full-stack remains unblocked: **YES cho schema/UI/infrastructure**, vì không có privacy/safety regression.
- Broader demo/runtime-quality sign-off: **BLOCKED** cho long-session product comparison cho tới khi patch hẹp pass replay.

## 10. Privacy và production integrity

- Production source changed: NO.
- Production data changed: NO.
- Temp fixture stored outside production: YES.
- Full prompt/reply/reasoning persisted: NO.
- Raw product rows/raw stock persisted in reports: NO.
- Local Qwen conversations: 1.
- Local Qwen calls: 6.
- External/cloud AI calls: 0.
- Temp runtime stopped: YES.
- Commit/push/stage: NO.

