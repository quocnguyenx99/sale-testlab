# Sale TestLab Codebase Logic & Structure Report

## 1. Executive summary

Báo cáo này cung cấp cái nhìn tổng quan về codebase dự án `sale-testlab-data-pipeline`.

Đây là một hệ thống xử lý dữ liệu nhiều bước, từ xử lý file Zalo thô, đến phân tích, lọc, và tạo chân dung khách hàng mô phỏng. Hiện tại dự án đã hoàn thiện đến **Phase 10** — tạo Enrich Training Personas — và **Phase 11** — Playground giả lập chat khách hàng - nhân viên sale bằng AI cục bộ.

Phiên bản hiện tại tập trung vào việc tạo ra AI đóng vai trò người mua (**Buyer Role**) với hành vi, bối cảnh, và quy tắc nghiêm ngặt dựa trên dữ liệu thực tế, tránh các lỗi nhận diện nhầm vai trợ lý (**assistant style**).

---

## 2. Project purpose

Dự án nhằm mục đích lấy dữ liệu thô (**raw Zalo**) chưa xử lý, làm sạch, phân tích hành vi để sinh ra các tệp **chân dung khách hàng** (**Personas**) chuẩn hóa.

Các Personas này sau đó được sử dụng trong một **Playground** — môi trường giả lập cục bộ — cho phép nhân viên bán hàng (**Sale**) trò chuyện thử nghiệm với AI đóng vai khách hàng.

Mục đích lớn nhất là tạo ra các bài test tình huống chân thực dựa trên lịch sử mua hàng, giúp huấn luyện nhân viên Sale cách tiếp cận, xử lý từ chối và chốt sale hiệu quả.

---

## 3. Root structure

| Thành phần | Mô tả |
|---|---|
| `package.json` | Cấu hình dự án Node.js, khai báo các thư viện phụ thuộc như `tsx`, `typescript`, `zod` và các npm scripts chạy từng phase của pipeline. |
| `src/` | Thư mục mã nguồn chính bằng TypeScript, chứa toàn bộ logic chạy các phase, parser, pipeline builder, writer, và runtime playground. |
| `sale-testlab-data/` | Thư mục lưu trữ dữ liệu cục bộ. Chứa dữ liệu đầu ra/vào theo từng bước xử lý, từ `00_raw` cho đến `10d_training_personas_enriched`. Không được thay đổi dữ liệu thô và được tách rời hoàn toàn khỏi codebase. |
| `plan_detail/` | Nơi lưu trữ các tài liệu thiết kế, tài liệu theo dõi kế hoạch chi tiết của từng phase, tuân thủ nguyên tắc lập plan trước khi sửa file. |
| `config/` | Có thể chứa các file thiết lập cấu hình tĩnh của pipeline. |
| `logs/` | Chứa các file ghi nhận log quá trình chạy pipeline để hỗ trợ debug. |
| `AGENTS.md` | Chứa bộ quy tắc cốt lõi hướng dẫn tác vụ cho AI Agent thao tác trong dự án: bảo mật, thứ tự pipeline, quy chuẩn xuất JSON. |
| `README.md` | Tổng quan dự án chung. |
| `_opencode_schema.json` / `opencode.json` | Các tệp lưu định dạng schema/cấu hình dùng cho chuẩn phát triển của công cụ/hệ thống nội bộ. |

---

## 4. NPM scripts map

| Script | File chạy | Phase | Mục đích | Trạng thái |
|---|---|---:|---|---|
| `phase1` | `src/run-phase1.ts` | 1 | Đọc và Parse raw Zalo files. | Active |
| `phase2b` | `src/run-phase2b.ts` | 2 | Lọc tin nhắn: bỏ trash, internal, candidate sales. | Active |
| `phase3` | `src/run-phase3.ts` | 3 | Phân chia thành các phiên hội thoại (**sessions**). | Active |
| `phase4` | `src/run-phase4.ts` | 4 | Chấm điểm chất lượng session, extract customer signals. | Active |
| `phase5` | `src/run-phase5.ts` | 5 | Tổng hợp dữ liệu behavior. | Active |
| `phase5b` | `src/run-phase5b.ts` | 5b | Phân tích context relationship. | Active |
| `phase5c` | `src/run-phase5c.ts` | 5c | Cắt tỉa relationship (**pruning**). | Active |
| `phase6` | `src/run-phase6.ts` | 6 | Tạo bản draft persona. | Active |
| `phase6c` | `src/run-phase6c.ts` | 6c | Tinh chỉnh lại draft persona (**Refine**). | Active |
| `phase7` | `src/run-phase7.ts` | 7 | Đóng gói Runtime Personas. | Fallback / Đang cũ |
| `phase7b` | `src/run-phase7b.ts` | 7b | Gom nhóm Archetypes từ Persona. | Legacy |
| `phase8` | `src/run-phase8.ts` | 8 | Tạo báo cáo/summary. | Legacy / Optional |
| `phase8c` | `src/run-phase8c.ts` | 8c | Bổ sung summary. | Legacy / Optional |
| `phase10` | `src/run-phase10.ts` | 10 | Tạo Training Personas cơ bản: gán danh tính, rule. | Active |
| `phase10c` | `src/run-phase10c.ts` | 10c | Làm sạch Training Personas. | Active |
| `phase10d` | `src/run-phase10d.ts` | 10d | Enrich Training Personas: bổ sung logic chi tiết, opening rules, risk flags. | Active (Main) |
| `phase11b` | `src/run-phase11b.ts` | 11b | Module test cho Pipeline / QA Simulator. | Active (Test) |
| `playground` | `src/playground/server.ts` | PL | Chạy server Node.js Web UI cục bộ giả lập chat với AI Personas. | Active |

---

## 5. Source code map

### Nhóm Phase Runners

**Đường dẫn:** `src/run-phase*.ts`

- **Dùng cho:** Khởi chạy lần lượt từng bước độc lập của pipeline.
- **Input/Output:** Đọc từ thư mục data bước trước, chạy logic, ghi JSONL ra thư mục chuẩn bị cho bước sau.
- **Trạng thái:** Active, tuân thủ nguyên tắc Pipeline Order.

### Nhóm Parser & Normalizer

**Đường dẫn:** `src/parser/`, `src/normalizer/`

- **Dùng cho:** Các phase sơ khởi, chủ yếu Phase 1 và Phase 2, bóc tách dữ liệu Zalo rác/raw.
- **Input:** Raw text/html/Zalo exports.
- **Output:** Dữ liệu tin nhắn JSON/JSONL đã chuẩn hoá.
- **Trạng thái:** Active.

### Nhóm Pipeline Core

**Đường dẫn:** `src/pipeline/`

Bao gồm các file builder logic như:

- `sessionBuilder.ts`
- `behaviorAggregator.ts`
- `personaDraftBuilder.ts`
- `trainingPersonaIdentityBuilder.ts`

**Dùng cho:** Thực thi logic cốt lõi như chấm điểm hành vi, lắp ghép chân dung mô phỏng cho các phase.

**Trạng thái:** Active.

### Nhóm Runtime

**Đường dẫn:** `src/runtime/`

Quản lý logic trong lúc **chat trực tiếp**. Gồm các file như:

- `localAIRuntimeAdapter.ts`
- `runtimeConstraints.ts`
- `runtimePromptBuilder.ts`
- `runtimeStateRouter.ts`

**Dùng cho:** Tính toán bối cảnh, xây dựng system prompt gọi Gemma E2B, kiểm duyệt câu phản hồi tránh lẫn vai.

**Trạng thái:** Active.

### Nhóm Playground

**Đường dẫn:** `src/playground/`

- **File chính:** `server.ts`
- **Dùng cho:** Cung cấp Web UI hiển thị giả lập Chat, là nơi tích hợp các module thuộc nhánh `src/runtime`.
- **Trạng thái:** Active.

### Nhóm Hỗ trợ

**Đường dẫn:** `src/utils/`, `src/types/`, `src/writer/`

- **Dùng cho:** Khai báo cấu trúc TypeScript chặt chẽ, tạo Hash file, Logger, ghi File JSONL hàng loạt.
- **Trạng thái:** Active.

---

## 6. Data pipeline flow

```txt
00_raw
  → Parse

01_normalized
  → Normalize

02_filtered
  → Filter

03_sessions
  → Split

04_behavior
  → Behavior

05_aggregated
  → 05b_context
  → 05c_pruned

06_persona_drafts
  → 06c_refined_personas

07_runtime_personas
  → 07b_persona_archetypes

10_training_personas
  → 10c_training_personas_clean
  → 10d_training_personas_enriched

Playground
  → Load Enriched Personas
  → Chat simulation for Sale
```

### Ý nghĩa từng bước

| Bước | Mục đích |
|---|---|
| `00_raw → Parse` | Đọc dữ liệu chat gốc. |
| `01_normalized → Normalize` | Định dạng lại đồng nhất. |
| `02_filtered → Filter` | Loại bỏ tin nhắn từ bot nội bộ, ứng viên rác. |
| `03_sessions → Split` | Cắt theo phiên trò chuyện. |
| `04_behavior → Behavior` | Phân tích thái độ, hành vi người mua. |
| `05_aggregated → 05b_context → 05c_pruned` | Gom nhóm, đánh giá tương quan bối cảnh mua hàng và tỉa bớt dữ liệu rác. |
| `06_persona_drafts → 06c_refined_personas` | Lên nháp và tinh chỉnh chân dung sơ bộ. |
| `07_runtime_personas → 07b_persona_archetypes` | Rút trích thành Runtime Personas mỏng. |
| `10_training_personas → 10c_training_personas_clean → 10d_training_personas_enriched` | Gán danh tính, bổ sung quy tắc hành vi cụ thể, câu mở đầu, xử lý từ chối chuyên sâu để tạo Enriched Personas cho huấn luyện Sale. |
| `Playground` | Tải dữ liệu Enriched Personas và hiển thị cho Sale. |

---

## 7. Current official data sources

| Nguồn | Mô tả |
|---|---|
| Tháng dữ liệu chính hiện tại | `2026-03`, đang có trong `00_raw/zalo/2026-03` và `10d/.../2026-03`. |
| Persona source chính thức của playground | Thư mục `10d_training_personas_enriched`. Các persona giàu tính năng nhất được lưu tại đây trong file `training_personas_enriched.jsonl`. |
| Fallback source | `07_runtime_personas/runtime_personas.jsonl` vẫn được load chìm trong Playground để cung cấp logic route state tĩnh. |
| QA report source | `11b_playground_qa/` |
| File không nên dùng nữa | Dữ liệu từ các folder Phase 7 trở đi không nên làm nguồn dữ liệu chính cho chat nữa, phải dùng `10d`. |

---

## 8. Playground runtime flow

Luồng hoạt động hiện tại trong file `server.ts`:

1. **Server Load Persona**
   - Đọc file JSONL từ `10d` thông qua `handleChatEnriched` thay vì bản cũ.
   - Render giao diện HTML Web.

2. **Chọn Persona**
   - User chọn từ menu thả xuống.
   - Giao diện load `EnrichedPersona` details.

3. **Customer Start**
   - Hàm `handleCustomerStartEnriched`.
   - Sử dụng `stableHash` lấy câu mở đầu có sẵn (**deterministic fallback**) từ data tĩnh của `10d`.

4. **Sale gửi message**
   - JavaScript gọi `POST /api/chat`.

5. **State Router**
   - Dùng hàm `routeRuntimeState` trong file `runtimeStateRouter.ts`.
   - Tính toán xem Sale đang chèo lái cuộc trò chuyện tới phase nào, ví dụ `pricing`, `logistics`, ...

6. **Prompt Builder**
   - Lắp ráp context gồm hành vi, mục tiêu, sản phẩm quan tâm, rules, forbidden styles.
   - Dùng `runtimePromptBuilder.ts`.

7. **Local AI**
   - Hàm `generateLocalAIReply` trong `localAIRuntimeAdapter.ts` gửi prompt tới AI cục bộ (**Gemma E2B**).

8. **Constraints / Fallback**
   - AI trả về sẽ bị quét bằng hàm `detectAssistantStyle` trong `runtimeConstraints.ts`.
   - Nếu AI bị lẫn vai trợ lý, hệ thống bắt generate lại kèm cờ phạt hoặc chặn bằng câu nói tĩnh dự phòng.

9. **UI / Debug**
   - Server trả dữ liệu kèm cờ an toàn.
   - UI update lịch sử chat và hiện thẻ rủi ro/kỹ thuật.

---

## 9. Runtime / Gemma responsibility split

### Gemma đang làm nhiệm vụ gì?

Gemma đóng vai khách hàng. Nhiệm vụ duy nhất là suy luận bối cảnh từ tin nhắn Sale, sau đó sinh ra đoạn text trả lời tự nhiên (**NLG**) theo giọng điệu người đi mua.

### Phần do Rule quyết định

Các phần deterministic gồm:

- Routing ngữ cảnh, ví dụ `pricing_phase`, `logistics_phase`, ...
- Quản lý quy tắc chống lẫn vai.
- Quản lý logic tung câu mở đầu (**Greeting only rule**), không cho lộ thông tin thanh toán nếu chưa tới lúc.

### Fallback hoạt động ra sao?

Nếu AI generate quá lỗi hoặc lặp lại câu hỏi trước đó thông qua `shouldForceRegenerate`, hệ thống bắt nó sửa bằng prompt `[ANTI_REPEAT]`.

Nếu mắc lỗi nặng về **giọng điệu trợ lý**, fallback sẽ đè câu trả lời cứng:

> Mình đang tham khảo thêm...

### Ràng buộc chống lẫn vai nằm ở đâu?

Thuật toán quét và phạt nằm ở:

- `src/runtime/runtimeConstraints.ts`
- `src/playground/server.ts`

Ràng buộc này được tích hợp trực tiếp trong luồng hậu xử lý của file `src/playground/server.ts`.

---

## 10. Active vs fallback vs legacy files

### Active

- Toàn bộ pipeline `run-phase*.ts` và các thư mục tương ứng của nó trong `sale-testlab-data`.
- Nhóm thư mục source trong:
  - `src/pipeline`
  - `src/runtime`
  - `src/playground`
- Output mới nhất thuộc nhánh `10d` là data chính thức.

### Fallback

- `07_runtime_personas/`
  - Bị rớt hạng thành fallback cho việc xác định rules/state.
  - Chưa được gỡ sạch.
  - Cần cẩn thận.

### Legacy / unused / scratch

- Scripts như `phase8` và `phase8c` khả năng cao mang tính tuỳ chọn báo cáo, có thể là legacy.
- Folder `08_runtime_simulator/` có vẻ là một module cũ đang bị thay thế bởi chính Playground hiện tại hoặc `11b`.

---

## 11. Current risks and confusion points

| Rủi ro / điểm dễ nhầm | Mô tả |
|---|---|
| Dễ nhầm lẫn nhánh Persona | Các folder `06`, `07`, `10` có vẻ chồng lấn chức năng: draft, runtime, training. Người mới dễ khó xác định source cuối cùng nếu không đọc `server.ts`. |
| Hardcoded mapping trong `server.ts` | Hiện file playground còn dính hardcode fallback rules ở ngay giữa file thay vì đẩy vào module Constraint. |
| Chưa có Product Scenario | AI dễ ảo giác (**hallucinate**) vì chưa có hệ thống Product Catalog rõ ràng để đối chiếu thực tế. |
| Conversation Memory tĩnh | Chỉ cắt 10 turn gần nhất: `recent_messages = turns.slice(-10)`. Nếu hội thoại dài, AI sẽ bị mất gốc. |
| Chưa có Closing Engine | Chưa tự động nhận diện **Chốt Deal Thành Công** hay **Bị Dropped** để tính KPI. |
| AI dễ lẫn vai | AI dễ bị trượt lại thành trợ lý bất chấp prompt vì model local Gemma khá nhạy. Hệ thống phải phụ thuộc nặng vào rule regex, làm giảm sự sáng tạo. |

---

## 12. Phase 12 impact map

### Có thể chạm

Phần được phép nâng cấp:

- `src/playground/server.ts`
- `src/runtime/runtimePromptBuilder.ts`
- `src/runtime/runtimeStateRouter.ts`
- `src/runtime/runtimeConstraints.ts`
- `src/runtime/localAIRuntimeAdapter.ts`
- `src/runtime/runtimeSessionManager.ts`

### Có thể thêm

New modules mở rộng:

- `src/runtime/productScenarioCatalog.ts`
- `src/runtime/customerOpeningBuilder.ts`
- `src/runtime/conversationMemory.ts`
- `src/runtime/repetitionGuard.ts`
- `src/runtime/conversationGoalTracker.ts`
- `src/runtime/customerNaturalnessRules.ts`
- `src/run-phase12qa.ts`

### Không nên chạm

- Dữ liệu gốc trong `sale-testlab-data/00_raw`.
- Quá trình pipeline Phase 1-10, trừ khi có bug hỏng cấu trúc JSON sinh ra từ các phase trước.
- Output Persona đã sinh chuẩn trong `10d`.
- Bất kỳ code liên quan DB / Auth System, vì đây là TestLab.

---

## 13. Recommended next steps

Dưới đây là thứ tự khuyến nghị triển khai an toàn theo từng nhánh để hoàn thiện tính năng mô phỏng.

### Baseline document

- **Mục tiêu:** Ghi nhận tình trạng hiện tại, nắm rõ luồng dữ liệu `10d`. Báo cáo này chính là bước baseline.
- **File chạm vào:** Không có, inspection only.
- **Tiêu chí pass:** Review và xác nhận baseline, đóng băng data `10d`.

### Phase 12A — Customer Opening Builder & Product Scenario

- **Mục tiêu:** Tách hardcode opening rules và tích hợp kịch bản sản phẩm (**Product Catalog**) thật sự để AI bớt ảo giác.
- **File chạm vào:** Tạo `productScenarioCatalog.ts`, `customerOpeningBuilder.ts`, gỡ logic cứng ra khỏi `server.ts`.
- **Tiêu chí pass:** Load động câu mở đầu chính xác dựa theo sản phẩm.

### Phase 12B — Conversation Memory

- **Mục tiêu:** Giữ mạch chat dài hạn thay vì chỉ lấy 10 turn cuối.
- **File chạm vào:** Thêm `conversationMemory.ts`, cập nhật `runtimeSessionManager.ts`.
- **Tiêu chí pass:** AI có thể nhớ bối cảnh hỏi giá từ rất sớm, tức turn 1-2, ngay cả khi đang ở turn số 12.

### Phase 12C — Repetition Guard & Naturalness

- **Mục tiêu:** Giảm thiểu tình trạng AI nói vòng vo hay lặp lại ý trước đó do prompt không mạnh.
- **File chạm vào:** Tạo `repetitionGuard.ts`, nâng cấp `localAIRuntimeAdapter.ts`.
- **Tiêu chí pass:** Loại bỏ gần như 100% tỷ lệ nói lặp.

### Phase 12D — Conversation Goal Tracker

- **Mục tiêu:** Engine chấm điểm, xác định khi nào Sale chốt thành công hoặc làm mất khách hàng.
- **File chạm vào:** Tạo `conversationGoalTracker.ts`.
- **Tiêu chí pass:** Đánh giá được cờ `DEAL_CLOSED` hay `DROPPED` ở cuối màn chơi.

### Phase 12E — Automated QA Simulator

- **Mục tiêu:** Chạy kiểm thử tự động nhiều Persona mà không cần con người nhúng tay, giảm tải QA.
- **File chạm vào:** Cấu hình `src/run-phase12qa.ts`.
- **Tiêu chí pass:** Xuất ra file log JSON tổng hợp độ khó của từng persona sau 100 turns tự động.

### Phase 12F — UI Polish

- **Mục tiêu:** Cải thiện hiển thị trực quan các thẻ ghi nhớ, trạng thái deal.
- **File chạm vào:** `src/playground/server.ts`, phần HTML nội tuyến.
- **Tiêu chí pass:** Web UI đẹp mắt, hiển thị Goal Tracker / Flags mượt mà, UX xịn.
