# PLAN 57C - Evidence-Based Runtime Fix

**Nguồn bằng chứng:** `REPORT_57A` và `REPORT_57B`  
**Trạng thái:** PLAN ONLY - NOT IMPLEMENTED  
**Runtime Contract:** giữ nguyên

## 1. Mục tiêu

Sửa hẹp state continuity cho phiên nhiều model:

- không gán `specific` cho một catalog candidate không được Sale nhắc;
- duy trì candidate set đúng qua nhiều lượt;
- phát hiện và giải tham chiếu `model/mẫu 1, 2, 3`;
- gắn numeric Sale quote với candidate phù hợp ở mức session memory;
- tránh kích hoạt fixed product-context clarification khi model shortlist/quote đã đủ rõ.

Không sửa bằng cách xóa guard hoặc thay câu fallback.

## 2. Confirmed defects

### `PRODUCT_CONTEXT_NOT_RECOGNIZED`

Runtime chọn một candidate không khớp expected family, code không xuất hiện trong Sale message nhưng đặt trạng thái `specific`.

### `ORDINAL_SELECTION_NOT_DETECTED`

Không có detector trên buyer reply/session memory path.

### `ORDINAL_SELECTION_NOT_RESOLVED`

Không có mapping từ ordinal sang candidate order.

### `PRICE_VALUE_NOT_GROUNDED`

Numeric price được ghi nhận ở progress nhưng không bind vào model/candidate đúng.

### `QWEN_CANDIDATE_LOOP`

Một raw candidate hash lặp ở 3 live turns. Đây có thể là hậu quả của product context sai/thiếu; chưa đủ bằng chứng để đổi model hoặc broad prompt.

## 3. Rejected proposals

### `NO_ACTION`

- Không đổi `TOPIC_ORDER`.
- Không nới `isStrongSaleAnswerForTopic(price)`.
- Không bỏ numeric quote requirement.
- Không đổi model parameters.
- Không tắt repetition/reopen guard.
- Không xóa `product_context_gating_clarify`.
- Không auto-pass vague context.
- Không broad prompt compaction; experiment trước đó đã FAIL.
- Không thay Runtime Contract.
- Không dùng phần trăm nguyên nhân trong deep audit cũ.

## 4. `PATCH_REQUIRED_NOW`

### Stage A - Memory correctness trước

#### Permitted file: `src/runtime/conversationMemory.ts`

Cho phép:

1. Phân biệt exact evidence và fuzzy search evidence.
2. Chỉ đặt `specific` khi:
   - Sale nhắc exact model code; hoặc
   - Sale nhắc tên/model đủ mạnh và unambiguous; hoặc
   - buyer ordinal đã resolve vào persisted candidate set.
3. Không đặt `specific` từ một low-confidence fuzzy result không xuất hiện trong Sale text.
4. Duy trì conversation-scoped ordered candidate set thay vì thay toàn bộ bằng mỗi search result mới.
5. Thêm metadata hẹp:
   - candidate order;
   - shortlisted candidate codes;
   - selected candidate evidence source;
   - Sale-quoted price evidence theo candidate;
   - không lưu raw message.
6. Thêm function buyer-side memory update, ví dụ `updateMemoryFromCustomerReply`, để:
   - detect ordinal;
   - resolve ordinal bằng ordered candidate set;
   - một ordinal → selected candidate;
   - nhiều ordinal → shortlist, không ép thành một selected model.

Không cho phép:

- thay product knowledge file;
- lưu full Sale/buyer message trong memory;
- đưa raw stock quantity ra prompt/output.

#### Permitted file: `src/playground/server.ts`

Chỉ cho phép:

- gọi buyer-side memory update sau final buyer reply và trước `sessions.set`;
- truyền state đã cập nhật sang turn sau;
- thêm metadata-only diagnostics cho evidence source/ordinal resolution trong response.

Không đổi:

- route names;
- local Qwen config;
- safety/identity/deal-state ordering;
- response payload text fields ngoài diagnostics cần thiết.

### Stage B - Product context prompt block, chỉ khi Stage A chưa đủ

#### Conditionally permitted file: `src/runtime/runtimePromptBuilder.ts`

Chỉ thực hiện nếu deterministic + live replay sau Stage A vẫn có Qwen candidate loop.

Cho phép:

- thay product-selection block bằng concise structured state:
  - selected candidate hash/code;
  - shortlist order;
  - grounded quote availability;
  - next unresolved topic.
- không chạm phần identity, safety, privacy, progression hoặc model instructions khác.

Không cho phép:

- broad prompt deletion/compaction;
- thay progression policy;
- thêm hard reply template;
- dump full candidate rows.

## 5. Do-not-touch files/functions

Trong patch đầu:

- `src/runtime/safetyGuards.ts`;
- `src/runtime/responseBank.ts`;
- `src/runtime/conversationCompletion.ts`;
- `src/runtime/conversationIdentity.ts`;
- `src/runtime/repetitionGuard.ts`;
- `src/runtime/localAIRuntimeAdapter.ts`;
- `src/runtime/dealState.ts`;
- `src/runtime/productKnowledge/product_knowledge.compact.json`;
- persona artifacts;
- model endpoint/temperature/top-p/timeout/thinking settings;
- `docs/RUNTIME_CONTRACT_PHASE12H.md`.

Lý do: current replay cho thấy response bank đang phá raw candidate loop và không lặp final hash. Sửa guard/fallback trước memory sẽ che root cause.

## 6. Regression tests

### Required new test

Tạo:

`src/runtime/phase12h3b_long_session_product_selection.regression.test.ts`

Synthetic-only cases:

1. Một fuzzy unrelated result không được gán `specific`.
2. Ba exact synthetic model codes tạo ordered candidate set đúng, không có extra candidate.
3. Buyer nói ordinal 1 → selected candidate 1.
4. Buyer nói ordinal 1 và 2 → shortlist hai candidates, không xóa candidate set.
5. Sale gửi lại ba model/prices → selected/shortlist không mất.
6. Delivery answer sau shortlist → next topic không quay lại product model sai.
7. Numeric quotes bind đúng candidate order.
8. Genuine unknown context vẫn bị product-context gate chặn.
9. Genuine vague context vẫn không được payment/hold/close.
10. Repeated raw candidate phải được bank diversify; final hash không lặp.

Không dùng real persona, real product row hoặc raw Zalo data.

### Required updates

#### `phase12h1_product_context_gating.regression.test.ts`

- giữ safety semantics;
- bỏ phụ thuộc vào full fixed wording khi không cần;
- assert variant/reason/context thay vì chỉ exact prefix;
- thêm case persisted shortlist không bị coi là unknown/vague.

#### `phase12h1_product_context_memory.regression.test.ts`

- thêm exact-vs-fuzzy confidence;
- thêm multi-model persistence;
- thêm ordinal resolution.

### Existing regression suites bắt buộc

```powershell
npx tsx src/runtime/phase12h3b_long_session_product_selection.regression.test.ts
npx tsx src/runtime/phase12h1_product_context_memory.regression.test.ts
npx tsx src/runtime/phase12h1_product_context_gating.regression.test.ts
npx tsx src/runtime/phase12h3b_salutation_buyer_role_lock.regression.test.ts
npx tsx src/runtime/phase12h1_buyer_voice_guard.regression.test.ts
npx tsx src/runtime/phase12h3a_customer_voice_style.regression.test.ts
npx tsx src/runtime/phase12h3b_fallback_naturalness_fastfix.regression.test.ts
```

## 7. Targeted replay acceptance

Chỉ dùng fresh isolated runtime và một live conversation sau deterministic pass.

### Deterministic acceptance

- expected-family candidate relevance: PASS;
- selected code must be Sale-mentioned or ordinal-resolved;
- three provided models → exactly three ordered candidates;
- ordinal detected > 0;
- ordinal resolved = detected;
- selected/shortlist preserved after resend;
- quoted prices grounded to correct candidates;
- no false `out_of_stock` from unrelated candidate;
- no false `product_context_vague_not_specific`;
- fixed clarification exact hash không được phát ra khi shortlist/quote đã grounded;
- genuine unknown/vague safety cases vẫn pass.

### Live acceptance

- one conversation only;
- local Qwen errors/timeouts: 0;
- external/cloud AI: 0;
- privacy/raw-stock leak: 0;
- buyer role/salutation issue: 0;
- exact repeated final hash: 0;
- ordinal context preserved after price and delivery turns;
- final source may be generated, rewritten hoặc justified bank fallback;
- if raw candidate loop còn xuất hiện, final must remain diversified and state-correct.

Không chạy canonical 12/full-38 trước khi targeted replay pass.

## 8. Safety và privacy invariants

- Unknown/vague product không được payment/hold/close.
- Raw stock quantity không được lộ.
- Buyer role và identity lock giữ nguyên.
- Price promise không được tính là numeric quote.
- Không gửi dữ liệu ra cloud.
- Không persist full prompt/reply/reasoning.
- Không persist raw message trong new memory diagnostics.
- Product/session data vẫn local-only.

## 9. Rollback criteria

Rollback toàn patch nếu xảy ra một trong các điều kiện:

- unrelated fuzzy candidate vẫn được gán `specific`;
- genuine unknown/vague safety test fail;
- raw stock/privacy/identity regression;
- candidate set tăng ngoài exact supplied models;
- ordinal resolve sai index;
- quote bind sai model;
- deterministic fallback hoặc final repetition tăng;
- local Qwen parameters hoặc Runtime Contract bị thay;
- broad prompt behavior thay ngoài product-state block.

## 10. `CLEANUP_LATER`

Tách thành task riêng sau khi patch pass:

- legacy `handleChat`, `handleCustomerStart`, `buildCustomerOpening` trong `server.ts`;
- scratch model/drift helpers;
- old instrumentation/QA runners không còn owner;
- npm test manifest cho critical Phase 12H tests;
- exact-wording assertions dư thừa.

Không cleanup cùng runtime fix.

## 11. `QUALITY_BACKLOG`

- Nếu Qwen candidate loop còn sau memory fix, audit product-state prompt block riêng.
- Đánh giá confidence threshold của product search trên catalog đầy đủ.
- Thêm long-session sampled gate sau targeted replay, không chạy full-38 tự động.
- Theo dõi bank/fixed-gate diversity bằng hash/reason metadata.

## 12. REPORT_56, freeze và DB/full-stack

- REPORT_56 addendum: **REQUIRED** sau khi patch/replay có verdict.
- Runtime Contract frozen: **YES**.
- Runtime source implementation frozen: **NO**, cho phép patch hẹp nêu trên.
- DB/full-stack work: **UNBLOCKED** cho schema/UI/infrastructure.
- Public demo long-session sign-off: **BLOCKED** đến khi targeted replay pass.
- Legacy cleanup: **SEPARATE TASK**.

## 13. Recommended execution order

1. Implement Stage A memory/server changes only.
2. Run synthetic deterministic regressions.
3. Run deterministic manual replay in fresh isolation.
4. Run one live isolated conversation.
5. Nếu state đúng nhưng raw candidate vẫn loop, audit Stage B.
6. Chỉ sau targeted PASS mới cân nhắc 12-slot sampled gate.
7. Tạo REPORT_56 addendum; không sửa Runtime Contract.

