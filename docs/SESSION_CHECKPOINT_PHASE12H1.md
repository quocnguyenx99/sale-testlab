# Sale TestLab - Session Checkpoint Phase 12H.1

## 1. Current Project Goal

Muc tieu MVP hien tai:
- Xay dung Customer AI simulation cho Sale training.
- Runtime chat la core MVP can on dinh truoc khi mo rong DB/FE.
- Qwen3:8B local la bo sinh phan hoi chinh.
- Guard chi nen sua nhe hoac chan vi pham nghiem trong, khong hardcode reply binh thuong.

## 2. Working Rules

Nguyen tac lam viec dang duoc ap dung:
- Plan first -> execute later -> validate always.
- Thay doi nho, dao nguoc duoc, theo phase.
- Tranh broad refactor khi dang hardening runtime.
- Tranh hardcoded case-specific replies.
- Qwen3 van phai la primary response generator.
- Guard phai toi thieu, giai thich duoc, va de audit.

## 3. Completed Phase Timeline

### Phase 12C-12D
- conversation progress tracker
- repetition guard
- identity lock

### Phase 12E / 12F
- response bank
- completion evaluator
- closing/session completion rules

### Phase 12H / 13A
- dealState
- deal outcome
- training success
- shouldEndSession
- next best action

### Phase 12H.1-A - Product Knowledge Foundation
Theo code va context hien co:
- normalize product JSON
- `product_knowledge.compact.json`
- `loadProductKnowledge`
- `searchProducts`
- `findProductByModelCode`
- `extractProductMentions`
- `buildProductPromptContext`
- `price_si` la gia uu tien
- `price_le` la gia tham chieu
- co rule lien quan stock/slctx

### Phase 12H.1-B - Product Context Memory
- `selected_product_model`
- `selected_product_model_code`
- `product_context_status`: `unknown` / `vague` / `specific`
- `product_candidates_summary`
- `product_knowledge_used`

### Phase 12H.1-C - Product Context Gating
- chan payment/hold/close khi product context `unknown` hoac `vague`
- chan kieu noi "mau nay/model nay" khi chua ro san pham
- an `stock_qty` / `slctx` neu Sale chua noi ro so luong cu the

### Phase 12H.1-R - Regression Fix
- identity-aware fallback
- `TOPIC_ORDER` chronology
- price context guard
- candidate softening
- direct question softening

### Phase 12H.1-S - Guard Sensitivity Softening
- sua false positive stock tu `co/co`
- sua false positive stock leak blocker
- tach confirmation intent voi reopen guard
- them Vietnamese compound pronoun sanitization

### Phase 12H.1-T - Natural Dialogue Transition & Guard Softening
- `repairPronounDrift`
- soft prompt guidelines
- `src/runtime/safetyGuards.ts`
- behavior-based tests
- huong di la khong hardcode case-specific

### Phase 12H.1-U - Buyer Voice Guard
Trang thai: partial / chua freeze-ready.
- Da co baseline buyer voice guard va regression tests lien quan.
- Tuy nhien live QA cho thay rewrite scope con qua rong.
- Van de chinh: A2/C2 raw tot nhung bi thay ca cau, C4 sinh sai `gia si 2`.

### Phase 12H.1-V - Rewrite Scope Guard & Numeric Context Fix
Trang thai: current active / pending, chua xac nhan implement trong workspace hien tai.
Muc tieu phase:
- giu raw Qwen khi raw khong co severe violation
- chi sua local va toi thieu
- siet trigger sale-echo
- sua numeric context parser
- dam bao server va runner dung chung guard path va reply_source semantics

Root cause dang can xu ly:
- A2/C2 raw good but whole-reply rewritten
- C4 tao sai cum `gia si 2`
- can giu B2 pass trong khi bo over-rewrite

## 4. Important Business Rules

- `price_si` = wholesale / dealer price va la gia uu tien.
- `price_le` = retail / market reference.
- `stock = 1` la con hang, `stock = 0` la het hang.
- `slctx` la so luong noi bo / reference quantity, khong phai thong tin de Customer AI tu mo.
- Customer AI khong duoc chu dong noi chinh xac `stock_qty` / `slctx` neu Sale chua noi exact quantity truoc.
- `co/co` mot minh khong du de resolve stock.
- `2-3 mau` la option count, khong phai stock leak.
- `2 cai` la quantity, khong phai price.
- `12 trieu` / `12tr` / `12m` chi duoc xem la price khi co valid money context.

## 5. Current Runtime Architecture

Luong xu ly hien tai:

Sale message
-> product mention extraction
-> product search
-> product context memory
-> runtime prompt builder
-> local Qwen3 call
-> identity repair
-> safetyGuards
-> completion / deal state metadata
-> final reply

Ghi chu quan trong:
- Can trace tach biet `raw_model_reply` va `final_reply`.
- `reply_source` can phan biet ro:
  - `local_ai_generated`
  - `local_ai_rewritten`
  - `deterministic_fallback`
  - `forced_completion`
- `src/runtime/live_qa_runner.ts` duoc ghi chu la can match `src/playground/server.ts` de tranh lech hanh vi giua QA va runtime that.

## 6. Key Files and Responsibilities

- `src/runtime/conversationIdentity.ts`
  - Xac dinh identity profile, detect drift, repair pronoun drift, customer voice guard.
- `src/runtime/conversationProgressTracker.ts`
  - Theo doi topic progress, unresolved topic, cap nhat theo sale/customer turns.
- `src/runtime/conversationCompletion.ts`
  - Danh gia completion readiness, completion reply, reopen detection.
- `src/runtime/responseBank.ts`
  - Deterministic fallback bank theo topic / persona / context.
- `src/runtime/dealState.ts`
  - Xu ly deal outcome, terminal reply, training outcome metadata.
- `src/runtime/runtimePromptBuilder.ts`
  - Build runtime prompt da enrich voi persona, memory, progress, identity.
- `src/runtime/productKnowledge/productKnowledge.ts`
  - Load/search/index product knowledge, extract product mentions.
- `src/runtime/safetyGuards.ts`
  - Guard layer sau khi model generate; hien la diem nong cua 12H.1-V.
- `src/playground/server.ts`
  - Playground HTTP server, session orchestration, runtime execution path that.
- `src/runtime/live_qa_runner.ts`
  - Chay live QA va ghi metrics / raw-vs-final / guard behavior.
- `src/runtime/phase12h1*.regression.test.ts`
  - Test theo tung nhom hardening cua 12H.1.

## 7. Latest QA Findings

Nguon xac nhan chinh:
- `logs/live_qa_summary.json`
- `logs/live_qa_report.md`

Nhung gi da duoc xac nhan:
- Qwen3 local da online trong dot Live QA gan nhat.
- Metrics trong `logs/live_qa_summary.json`:
  - `local_ai_generated_untouched_rate = 75`
  - `local_ai_rewritten_rate = 25`
  - `fallback_rate = 0`
  - `forced_completion_rate = 0`
  - `guard_rewrite_rate = 25`
  - `exact_template_usage_count = 0`
  - `critical_fail_count = 0`
  - `average_naturalness = 5`
- Bao cao `logs/live_qa_report.md` van ket luan:
  - Freeze Phase 12H.1 = NO
  - Ready for data import = NO
  - Ready for 12H.3 = NO

Independent Codex QA truoc do tung tim thay issue nghiem trong o B2:
- Sale: `mau nay gia si 12 trieu chi nhe`
- Raw xau tung duoc ghi nhan: `Vang em, mau nay gia si 12 trieu chi nhe. Em hoi them duoc khong...`

Root causes da duoc tong hop:
- sale-echo chua detect dung
- `Em hoi them` drift chua bi bat
- delivery bi day len main topic qua som
- metric `local_ai_generated` tung bi overstate vi reply rewrite van bi tinh vao generated

Ket qua audit rewritten cases tu artifact hien co:
- A2: raw tot nhung bi whole-reply rewrite
  - raw: `Vang, anh dang can may render 3D tam trung, em gui anh 2-3 mau HP workstation phu hop kem gia si de anh so sanh nhe.`
  - final: `Vang em, gia si 2 dung khong? Em gui anh model va cau hinh cu the truoc nhe.`
- C2: raw tot nhung bi whole-reply rewrite
  - raw: `Anh dang dung cho render 3D, can may co cau hinh manh, em gui anh 2-3 mau HP workstation phu hop kem gia si de anh so sanh nhe.`
  - final: `Vang em, gia si 2 dung khong? Em gui anh model va cau hinh cu the truoc nhe.`
- C4: rewrite sinh sai cum `gia si 2 dung khong?`
  - raw: `Anh thay mau nay ben em con 2 cai a, vay thoi gian giao hang khoang bao lau a?`
  - final: `Vang em, gia si 2 dung khong? Em gui anh model va cau hinh cu the truoc nhe.`

Ket luan QA hien tai:
- Khong con `critical_fail_count` trong latest summary.
- Tuy nhien runtime van chua freeze-ready vi rewrite scope chua dat.
- Can patch 12H.1-V va audit lai rewritten cases truoc khi freeze.

## 8. Current Open Issues

1. Over-rewrite trong `src/runtime/safetyGuards.ts`.
2. Numeric parser dang co nguy co nham option count / quantity / spec / model code thanh price.
3. Can uu tien giu raw Qwen neu raw reply chap nhan duoc.
4. Can dam bao A2 untouched.
5. Can dam bao C2 untouched.
6. Can dam bao B2 van pass sau khi siet rewrite scope.
7. Can dam bao C4 khong con `gia si 2` va khong invent price.
8. Can audit lai toan bo rewritten cases truoc freeze.

## 9. Current Next Phase

Next phase nen lam:

Phase 12H.1-V - Rewrite Scope Guard & Numeric Context Fix

Muc tieu thuc thi:
- keep raw unless severe
- tighten sale-echo trigger
- numeric parser fix
- minimal repair only
- server/runner same path
- them regression test `src/runtime/phase12h1_rewrite_scope_guard.regression.test.ts`

## 10. Commands to Run After 12H.1-V

Chi la danh sach command de chay sau khi implement, chua duoc chay trong checkpoint task nay:

```bash
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

## 11. Freeze Criteria

Chi duoc freeze neu dong thoi dat:
- `critical_fail_count = 0`
- `exact_template_usage_count = 0`
- `fallback_rate = 0` hoac chi co severe case hop le
- A2 untouched
- C2 untouched
- B2 fixed
- C4 khong con `gia si 2`
- rewritten cases minimal va acceptable
- `local_ai_generated_untouched_rate >= 80%`, hoac neu thap hon thi moi rewritten case phai duoc audit va xac nhan minimal/acceptable

## 12. Do Not Do Yet

Chua nen lam cac viec sau truoc khi 12H.1-V pass va freeze duoc xac nhan:
- Khong import full 50 files.
- Khong tao Runtime Contract.
- Khong start Phase 12H.3.
- Khong build MVP UI.

## 13. Next Session Instructions

Huong dan cho session tiep theo:
1. Doc file checkpoint nay truoc.
2. Check `git status`.
3. Xac minh 12H.1-V da duoc implement hay chua.
4. Neu chua, implement 12H.1-V theo scope toi thieu.
5. Chay full test chain.
6. Audit tat ca rewritten cases.
7. Ra quyet dinh freeze.
8. Chi sau do moi sang Runtime Contract va data import.

## Workspace Status At Checkpoint

Trang thai workspace tai thoi diem tao checkpoint:
- Branch: `main`
- Last commit: `be0a35f runtime: baseline guard hardening before phase12h1-v`
- Working tree con thay doi ngoai scope checkpoint:
  - modified: `src/runtime/localAIRuntimeAdapter.ts`
  - untracked: `PHASE12H1_T_LIVE_QA_AUDIT_REPORT_2026-06-08.md`
  - untracked: `src/scratch_print_personas.ts`

Luu y:
- Cac thay doi tren chua duoc danh gia trong task checkpoint nay.
- File checkpoint chi tong hop context, khong xac nhan chat luong cua nhung thay doi dang mo.
