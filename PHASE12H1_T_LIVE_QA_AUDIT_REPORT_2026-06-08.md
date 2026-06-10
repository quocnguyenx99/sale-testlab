# Bao cao Audit Chi tiet - Phase 12H.1-T Live QA voi local Qwen3

Pham vi bao cao nay chi dua tren lan chay Live QA gan nhat ma Codex da thuc hien, khong sua code, khong doi prompt, khong rerun implementation. Nguon bang chung chinh la artifact [live_qa_summary.json](D:\Workspace\sale-testlab-data-pipeline\logs\live_qa_summary.json), [live_qa_report.md](D:\Workspace\sale-testlab-data-pipeline\logs\live_qa_report.md), log instrumentation [qwen3_instrumentation_log.jsonl](D:\Workspace\sale-testlab-data-pipeline\logs\qwen3_instrumentation_log.jsonl), cung code runner [live_qa_runner.ts](D:\Workspace\sale-testlab-data-pipeline\src\runtime\live_qa_runner.ts), identity guard [conversationIdentity.ts](D:\Workspace\sale-testlab-data-pipeline\src\runtime\conversationIdentity.ts), va runtime guard [safetyGuards.ts](D:\Workspace\sale-testlab-data-pipeline\src\runtime\safetyGuards.ts).

Local Qwen3 da online that trong lan QA nay. Artifact cho thay tat ca 12 case deu co `raw_model_reply`, log instrumentation co `error_type=null`, `has_reasoning_field=yes`, `content_null=no`, va da so case tra `reply_source=local_ai_generated`. Tuy nhien `critical_fail_count = 1`, nen khong the ket luan freeze-ready.

---

## 1. FULL TEST CASE INVENTORY

| Case | Transcript | Expected | Raw reply | Final reply | Source | Guards | Product status | Price quoted | Result | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `T1 Sale: "em chao chi, chi can ho tro gi a"`<br>`T2 Sale: "chi quan tam dong san pham nao?"` | Giu `chi/em`, tra loi nhu cau tu nhien, khong nhay gia/giao hang lam chu de chinh | `Chi dang can may van phong lam excel muot, render 3D tam trung. Em co the goi y 2-3 mau phu hop va bao gia si duoc khong a?` | `Chi dang can may van phong lam excel muot, render 3D tam trung. Em co the goi y 2-3 mau phu hop va bao gia si duoc khong nhe?` | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=true`<br>`guard_trigger_reasons=voice_drift:awkward_a_ending`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=unknown`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=chi/em`<br>`naturalness=5/5`<br>Ly do PASS: noi dung dung huong, chi bi sua hau to `a -> nhe`, khong doi y |
| A2 | `T1 Sale: "ben em co vai mau workstation HP anh"`<br>`T2 Sale: "de em bao gia model HP Z2 Tower G9 cho anh"` | Khong chot model/stock khi boi canh con vague, phai keo khach ve so sanh model/cau hinh truoc | `Vang, em bao gia model HP Z2 Tower G9 di a. Mau nay ben em con san hang khong?` | `Anh chua chot model cu the dau em. Em gui anh vai mau phu hop de anh so sanh gia si voi cau hinh truoc nhe.` | `deterministic_fallback` | `was_ai_online=true`<br>`guard_triggered=true`<br>`guard_trigger_reasons=ambiguous_model_guard_triggered`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=yes` | `product_context_status=vague`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=configuration` | PASS | `identity_profile=anh/em`<br>`naturalness=3/5`<br>Ly do PASS: model raw bi guard chan dung, chuyen ve cau deterministic an toan |
| A3 | `T1 Sale: "em gui STK cho anh chot luon nhe"` | Khong duoc di vao thanh toan/chot khi chua ro model/cau hinh | `Vang, anh dang can so sanh vai model de chon cau hinh phu hop. Em co the goi y 2-3 model phu hop voi nhu cau anh khong a?` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=unknown`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=anh/em`<br>`naturalness=5/5`<br>Ly do PASS: tu choi close som va keo ve model/cau hinh |
| A4 | `T1 Sale: "mau nay hien het hang anh"` | Khong close, khong payment; nen hoi lai model/option khac | `Anh dang xem mau nao vay em? Anh can so sanh vai cai de chon duoc phu hop nhat.` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=vague`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=anh/em`<br>`naturalness=5/5`<br>Ly do PASS: phan hoi dung huong lam ro model |
| B1 | `T1 Sale: "chao chi, chi dang tim dong may nao vay a"` | Giu `chi/em`, buyer tone tu nhien, khong hon vai sale | `Chi dang xem nhieu model de so sanh cau hinh va gia, em bao gia si duoc khong a?` | `Chi dang xem nhieu model de so sanh cau hinh va gia, em bao gia si duoc khong nhe?` | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=true`<br>`guard_trigger_reasons=voice_drift:awkward_a_ending`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=vague`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=chi/em`<br>`naturalness=5/5`<br>Ly do PASS: chi sua duoi cau, khong lech vai |
| B2 | `T1 Sale: "mau nay gia si 12 trieu chi nhe"` | Acknowledge gia theo buyer voice, khong duoc echo cau sale, khong duoc tu xung `em`, khong nen hoi delivery lam cau chinh khi `product_model` con unresolved | `Vang em, mau nay gia si 12 trieu chi nhe. Em hoi them duoc khong, thoi gian giao hang khoang bao lau a?` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`guard_trigger_reasons=[]`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=specific`<br>`selected_product_model=HP Z2 Tower G9 Workstation`<br>`selected_product_model_code=HP-Z2-G9` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | FAIL | `identity_profile=chi/em`<br>`naturalness=3/5`<br>Ly do FAIL: sale-echo, drift `Em hoi them`, lan vai, nhay delivery som |
| B3 | `T1 Sale: "em check gia si roi bao lai anh"` | Cho gia tu nhien, khong gia vo co gia roi nga gia | `Vang em check di, anh doi nhe.` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=unknown`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=anh/em`<br>`naturalness=5/5`<br>Ly do PASS: cho bao gia tu nhien |
| B4 | `T1 Sale: "mau nay con hang anh"` | Khong invent so luong, co the hoi lai cau hinh/model | `Vang, mau nay con hang anh. Anh can cau hinh cu the nao a?` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=specific`<br>`selected_product_model=HP Z2 Tower G9 Workstation`<br>`selected_product_model_code=HP-Z2-G9` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=anh/em`<br>`naturalness=5/5`<br>Ly do PASS: khong leak stock qty, hoi tiep ve config |
| C1 | `T1 Sale: "e co laptop i5 ram16 ssd512 ko chi"` | Chiu typo, tra loi tu nhien, khong resolve stock tu chu `co` | `Chi dang can may van phong lam excel muot, render 3D tam trung. Em gui chi 2-3 mau Dell phu hop kem gia si duoc khong a?` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=vague`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=chi/em`<br>`naturalness=5/5`<br>Ly do PASS: robust voi typo, van buyer tone |
| C2 | `T1 Sale: "anh dung may cho nhu cau gi, render hay van phong?"` | Tra loi dung nhu cau truc tiep, khong vong vo | `Anh dang dung cho render 3D, em gui anh 2-3 mau HP workstation phu hop kem gia si de anh so sanh nhe.` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=vague`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=anh/em`<br>`naturalness=5/5`<br>Ly do PASS: tra loi dung cau hoi truc tiep |
| C3 | `T1 Sale: "ben em co nhieu ma HP Z2, ZBook, EliteBook"` | Khong dump candidates, nen yeu cau 2-3 option phu hop | `Anh dang xem cac dong HP Z2, ZBook, EliteBook de chon cau hinh phu hop. Em co the gui anh 2-3 mau phu hop voi nhu cau render 3D kem gia si de anh so sanh duoc khong?` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=vague`<br>`selected_product_model=none`<br>`selected_product_model_code=none` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=anh/em`<br>`naturalness=5/5`<br>Ly do PASS: khong candidate dump, van hoi 2-3 mau |
| C4 | `T1 Sale: "mau nay ben em con 2 cai"` | Co the acknowledge stock, roi hoi gia/model/config, khong leak ngoai thong tin sale da noi | `Vang, anh thay model nay cung on. Em bao gia si duoc khong?` | Trung raw | `local_ai_generated` | `was_ai_online=true`<br>`guard_triggered=false`<br>`fallback_reason=none`<br>`response_bank_variant_id=none`<br>`completion_forced_reply=false`<br>`exact_template_used=no` | `product_context_status=specific`<br>`selected_product_model=HP Z2 Tower G9 Workstation`<br>`selected_product_model_code=HP-Z2-G9` | `is_price_quoted=false`<br>`next_unresolved_topic=product_model` | PASS | `identity_profile=anh/em`<br>`naturalness=5/5`<br>Ly do PASS: khong leak them stock, chuyen sang hoi gia |

---

## 2. Deep Analysis of Case B2

### Tom tat

Case B2 la loi that cua Qwen raw output. Khong co guard nao chan, khong co repair nao chay, nen cau sai di thang thanh `final_reply`.

### Tra loi tung cau hoi

1. Cau xau co phai `raw_model_reply` tu Qwen3 khong?  
Co. Artifact cho thay `raw_model_reply` dung bang cau sai do.

2. `raw_model_reply` co giong het `final_reply` khong?  
Co. Hai truong giong het nhau, khong co bat ky rewrite hay fallback nao.

3. `repairPronounDrift` co chay khong?  
Khong. Trong flow cua [live_qa_runner.ts](D:\Workspace\sale-testlab-data-pipeline\src\runtime\live_qa_runner.ts), case live nay khong goi `detectIdentityDrift()` roi `repairPronounDrift()`. No chi goi `runCustomerVoiceGuard()` va `applySafetyGuards()`.

4. `detectIdentityDrift` co detect `"Em hoi them"` la drift khong?  
Khong trong lan chay nay, vi ham do khong duoc goi trong path cua `live_qa_runner.ts`.

5. Neu co goi, vi sao no van co the miss?  
Ngay ca neu duoc goi, regex hien tai trong [conversationIdentity.ts](D:\Workspace\sale-testlab-data-pipeline\src\runtime\conversationIdentity.ts) chi bat drift dang sai self pronoun khi theo sau boi `dang|can|muon`.  
`"Em hoi them"` khong match cum do. Vi vay pattern hien tai van co khoang trong.

6. Vi sao `"chi nhe"` duoc phep xuat hien trong reply cua Customer AI?  
Vi hien khong co guard chuyen chan sale-echo endings kieu:
- `chi nhe`
- `anh nhe`
- `ben em`
- `em bao gia`
- `em ho tro`

`runCustomerVoiceGuard()` chi chan support phrases ro va duoi `a` khi nghe nhu sale/support. No khong chan echo cau truc cau cua sale.

7. Consultant tone / role inversion guard co trigger khong?  
Khong. `guard_triggered=false`, `consultant_tone_blocked=false`.  
Ngoai ra `applySafetyGuards()` trong [safetyGuards.ts](D:\Workspace\sale-testlab-data-pipeline\src\runtime\safetyGuards.ts) chi chan consultant tone bang mot danh sach rat hep:
- `em ho tro giu mau nay`
- `minh ho tro`
- `ben minh ho tro`
- `ben em dang san hang`

B2 khong chua cac phrase nay nen lot.

8. Delivery gate co trigger khong?  
Khong. Khong co guard delivery rieng duoc kich hoat trong case nay.

9. Vi sao delivery duoc chap nhan la main question?  
Vi trong path live nay khong co rule chan viec khach hoi giao hang khi `next_unresolved_topic` van la `product_model`.  
Case chi bi fail o buoc cham diem hau kiem `noDeliveryJump=false`, chu runtime guard khong chan truoc.

10. `selected_product_model` trong case nay la `null` hay specific?  
Specific.  
Artifact ghi ro:
- `selected_product_model = HP Z2 Tower G9 Workstation`
- `selected_product_model_code = HP-Z2-G9`

11. `product_context_status=specific` la vi model that su specific, hay chi vi Sale noi `"mau nay gia si 12 trieu"`?  
La vi QA harness da preload san specific context, khong phai chi vi cau sale.  
Trong [live_qa_runner.ts](D:\Workspace\sale-testlab-data-pipeline\src\runtime\live_qa_runner.ts), B2 duoc setup truoc voi:
- `selected_product_model = "HP Z2 Tower G9 Workstation"`
- `selected_product_model_code = "HP-Z2-G9"`
- `product_context_status = "specific"`

Dieu nay lam loi B2 nghiem trong hon: ngay ca khi context da duoc dung la `specific`, model van noi sai buyer voice va nhay delivery qua som, trong khi `next_unresolved_topic` van la `product_model`.

### Nhan xet them ve `is_price_quoted`

Artifact cua B2 ghi `is_price_quoted=false` du sale message ro rang co gia `12 trieu`. Day la mot diem khong nhat quan trong telemetry. No khong tao ra loi chinh cua B2, nhung cho thay quote detector hoac du lieu test string dang co mismatch can audit rieng.

---

## 3. EXACT TEMPLATE USAGE COUNT = 1

Case duy nhat dung exact template la **A2**.

- `case_id`: `A2`
- `raw_model_reply`: `Vang, em bao gia model HP Z2 Tower G9 di a. Mau nay ben em con san hang khong?`
- `final_reply`: `Anh chua chot model cu the dau em. Em gui anh vai mau phu hop de anh so sanh gia si voi cau hinh truoc nhe.`
- `reply_source`: `deterministic_fallback`
- `response_bank_variant_id`: `none`
- `completion_forced_reply`: `false`

Nguon template:
- File: [safetyGuards.ts](D:\Workspace\sale-testlab-data-pipeline\src\runtime\safetyGuards.ts)
- Function: `applySafetyGuards()`
- Guard branch: `Ambiguous Model Guard`

Template thuc te duoc sinh tu doan nay:
- khi `!isSpecific && hasGatedTerms(reply)` thi reply bi thay bang cau deterministic:
  - `"{Self} chua chot model cu the dau {sale}. {Sale} gui {self} vai mau phu hop de {self} so sanh gia si voi cau hinh truoc nhe."`

Vi sao template nay duoc dung:
- `product_context_status = vague`
- raw reply dung `model HP Z2 Tower G9`
- raw reply con hoi stock cua `"mau nay"` truoc khi model duoc chot that su
- guard coi day la gated terms trong ambiguous context, nen overwrite

Template nay co chap nhan duoc khong:
- **Co, chap nhan duoc**
- Day la mot truong hop fallback hop le vi no chan model khoi di vao specific model/stock qua som
- Naturalness giam xuong `3/5`, nhung logic hoi thoai dung hon raw output

---

## 4. Metrics Consistency

### Vi sao `guard_rewrite_rate = 25%`

Co `3/12` case bi guard tac dong:

- `A1`: `voice_drift:awkward_a_ending`
- `A2`: `ambiguous_model_guard_triggered`
- `B1`: `voice_drift:awkward_a_ending`

`3 / 12 = 25%`

### Case nao bi rewrite/repaired

- `A1`: raw `...khong a?` -> final `...khong nhe?`
- `A2`: raw bi thay toan bo bang deterministic template
- `B1`: raw `...khong a?` -> final `...khong nhe?`

### Vi sao `local_ai_repaired_rate = 0`

Vi runner hien tai khong co source type `local_ai_repaired`.  
Trong `A1` va `B1`, reply da bi sua, nhung `reply_source` van giu la `local_ai_generated`.  
Noi cach khac, metric `local_ai_repaired_rate` hien bang `0` khong phai vi khong co repair, ma vi **repair khong duoc phan loai thanh source rieng**.

### `local_ai_generated_rate` co bao gom reply da sua khong?

Co.  
It nhat `A1` va `B1` co `raw_model_reply != final_reply`, nhung `reply_source` van la `local_ai_generated`.  
Vi vay `local_ai_generated_rate = 91.7%` khong dong nghia voi `91.7% raw Qwen untouched`.

### Co fallback/forced reply nao bi dem nham thanh `local_ai_generated` khong?

- `forced_completion`: khong, vi `forced_completion_rate = 0`
- `deterministic_fallback`: khong, `A2` da duoc dem dung la fallback
- Nhung co **rewrite noi bo** bi dem chung vao `local_ai_generated`:
  - `A1`
  - `B1`

Ket luan metric:

- `fallback_rate` dang tin
- `forced_completion_rate` dang tin
- `local_ai_generated_rate` hien dang **overstate do "untouched" cua Qwen raw output**
- Neu muon metric sach hon, can tach rieng:
  - untouched raw generated
  - locally rewritten but still model-originated
  - deterministic fallback
  - forced completion

---

## 5. Verdict

- **Freeze-ready:** **NO**
- **Runtime Contract safe to create:** **NO**
- **Data import safe now:** **NO**

Ly do:

1. `critical_fail_count = 1`, nen khong dat dieu kien freeze.
2. Case `B2` la loi dung trong tam buyer-voice/role integrity, khong phai cosmetic.
3. `local_ai_generated_rate` cao nhung dang gop ca reply da rewrite, nen chua du de ket luan runtime da on dinh hoan toan.
4. Tu audit doc lap truoc do, path playground HTTP that con co loi runtime `applySafetyGuards is not defined` o [server.ts](D:\Workspace\sale-testlab-data-pipeline\src\playground\server.ts:1059). Dieu nay cang lam cho ket luan freeze phai nghiem ngat hon.

### Required minimal fix before freeze

Fix toi thieu bat buoc truoc freeze la chan duoc dung kieu sai cua B2:

- chan sale-echo buyer reply
- chan self-pronoun drift kieu `Em hoi them`, `Em can`, `Em muon`, `Em dang`
- chan delivery jump khi `selected_product_model` chua that su du dieu kien hoac `next_unresolved_topic` con la `product_model/configuration`
- phan loai repair rieng khoi `local_ai_generated`

---

## 6. Proposed Minimal Fix Plan Only

Khong implement. Chi de xuat.

### 1. Customer voice role-inversion detection

Bo sung guard phat hien va chan cac cum sale-style tu phia Customer AI:

- `chi nhe`
- `anh nhe`
- `ben em`
- `em ho tro`
- `em bao gia`
- `em gui STK`
- `em check`
- `mau nay gia si ... chi nhe`

Hanh vi mong muon:
- neu chi la drift nhe: rewrite sang buyer voice
- neu vua drift vua gated context: fallback sang buyer-safe deterministic sentence

### 2. First-person pronoun repair

Mo rong detect drift cho identity `chi/em` va `anh/em`:

Neu customer dang la `chi/em` ma reply bat dau bang:
- `Em hoi them`
- `Em muon`
- `Em can`
- `Em dang`

thi:
- flag `self_pronoun_drift`
- rewrite sang `Chi hoi them`, `Chi muon`, `Chi can`, `Chi dang`

Tuong tu voi `anh/em`.

### 3. Delivery gate

Neu:
- `selected_product_model` chua that su specific hoac
- `next_unresolved_topic` van la `product_model` / `configuration`

thi khong cho delivery tro thanh cau hoi chinh.

Priority mong muon:
1. model
2. configuration
3. price
4. stock
5. delivery

### 4. Sale echo guard

Bo sung guard so khop sale sentence vua nhan voi customer candidate reply.

Neu customer reply lap lai gan nhu nguyen cau sale kieu:
- `mau nay gia si 12 trieu chi nhe`

thi convert sang customer voice, vi du:
- `Gia si 12 trieu dung khong em? Em gui chi model va cau hinh cu the nhe.`

Khong de raw echo cua sale di thang ra final reply.

### 5. Metrics labeling cleanup

Tach source/label thanh it nhat 4 nhom:

- `local_ai_generated_untouched`
- `local_ai_rewritten`
- `deterministic_fallback`
- `forced_completion`

Neu khong tach, `local_ai_generated_rate` se tiep tuc gay ao giac la model raw da tot hon thuc te.

---

## Ket luan ngan

Qwen3 local da online that va phan lon case noi tu nhien. Tuy nhien B2 la loi hoi thoai cot loi, va loi nay di thang tu `raw_model_reply` sang `final_reply` ma khong bi guard nao chan. Voi `critical_fail_count > 0`, ket luan dung la:

**Phase 12H.1 chua freeze-ready.**
