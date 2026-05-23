# Báo cáo Kiểm tra Cấu trúc Dự án (Audit Report)

> **Ngày thực hiện**: 18/05/2026 | **Phương thức**: Chỉ đọc (Inspection Only) — Không sửa đổi file hệ thống

---

## 1. Tóm tắt dự án (Executive Summary)

| Hạng mục                                | Trạng thái / Chi tiết                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Pipeline đã chạy hoàn thành đến         | **Phase 11B** (Playground QA)                                                                                                |
| Phase hoạt động hiện tại                | **Playground server (Chuẩn bị cho Phase 12)**                                                                                |
| Dữ liệu tháng hiện có                   | **Chỉ có tháng 2026-03**                                                                                                     |
| Tổng dung lượng dữ liệu                 | ~500 MB+ trên toàn bộ các phase                                                                                              |
| Nguồn Persona chính thức cho Playground | `10d_training_personas_enriched/2026-03/training_personas_enriched.jsonl`                                                    |
| Cổng chạy Playground server             | `src/playground/server.ts` → Cổng (Port) 3009                                                                                |
| Adapter AI cục bộ (Local AI)            | `src/runtime/localAIRuntimeAdapter.ts` (API tương thích OpenAI)                                                              |
| Các file nháp/rác cần dọn dẹp           | `scratch/inspect.js`, `src/playground/x.txt`, các thư mục rỗng                                                               |
| Rủi ro & Nhầm lẫn                       | Nhiều thư mục "ma" (rỗng), một số thư mục cũ (`07_clusters`, `08_persona_drafts`, `09_approved_personas`) không được sử dụng |

---

## 2. Tổng quan cấu trúc thư mục gốc

```
D:\Workspace\sale-testlab-data-pipeline\
├── .env                         (110 B) — Cấu hình LOCAL_AI_URL, MODEL, API_KEY
├── AGENTS.md                    (1 KB) — Quy định về an toàn và bảo mật pipeline (Rules)
├── README.md                    — Giới thiệu tổng quan dự án
├── package.json                 (1.2 KB) — Khai báo các NPM scripts chạy dự án
├── package-lock.json            (17 KB)
├── tsconfig.json                (348 B)
├── opencode.json                (881 B) — File cấu hình phiên làm việc AI
├── _opencode_schema.json        (35 KB) — Schema của opencode
├── plan_detail/                 — Chứa 2 tài liệu kế hoạch (plan_001.md, plan_002.md)
├── scratch/                     — Chứa 1 file: inspect.js (6.6 KB, script quét hệ thống tự chế)
├── sale-testlab-data/           — Thư mục chứa toàn bộ dữ liệu đầu ra (26 thư mục con)
├── src/                         — Thư mục chứa mã nguồn (Source Code)
└── node_modules/                (Bỏ qua)
```

**Các file đáng chú ý ở thư mục gốc:**

- `_opencode_schema.json` — File schema lớn (35 KB) được sinh ra bởi công cụ opencode, không thuộc code dự án.
- `opencode.json` — File cấu hình của trợ lý AI, không thuộc code dự án.
- `plan_detail/plan_001.md`, `plan_002.md` — Tài liệu kế hoạch triển khai trước đó (an toàn, có thể giữ làm tài liệu tham khảo).
- `scratch/inspect.js` — Script Node.js quét dung lượng và thư mục từ đợt audit trước (file nháp).
- `src/playground/x.txt` — File rác chỉ chứa chữ "test" (6 bytes).

---

## 3. Sơ đồ mã nguồn (Source Code Map)

### 3.1 Các file thực thi Pipeline (`src/run-phase*.ts`)

| File              | Dung lượng | Phase tương ứng | Vai trò trong Pipeline                                                           |
| ----------------- | ---------- | --------------- | -------------------------------------------------------------------------------- |
| `run-phase1.ts`   | 12 KB      | Phase 1         | Parse file Zalo thô (.txt) → `01_normalized/messages.jsonl`                      |
| `run-phase2b.ts`  | 22 KB      | Phase 2B        | Phân loại tin nhắn → `02_filtered/messages_classified.jsonl`                     |
| `run-phase3.ts`   | 4 KB       | Phase 3         | Gom nhóm hội thoại thành các phiên (Sessions) → `03_sessions/sessions.jsonl`     |
| `run-phase4.ts`   | 30 KB      | Phase 4         | Trích xuất tín hiệu hành vi → `04_behavior/behavior_signals.jsonl`               |
| `run-phase5.ts`   | 3 KB       | Phase 5         | Tổng hợp hành vi theo cuộc hội thoại → `05_aggregated/aggregated_behavior.jsonl` |
| `run-phase5b.ts`  | 3 KB       | Phase 5B        | Xây dựng mối quan hệ ngữ cảnh → `05b_context/contextual_relationships.jsonl`     |
| `run-phase5c.ts`  | 4 KB       | Phase 5C        | Lọc bỏ (Prune) các mối quan hệ yếu → `05c_pruned/pruned_relationships.jsonl`     |
| `run-phase6.ts`   | 4 KB       | Phase 6         | Tạo bản thảo Persona nháp → `06_persona_drafts/persona_drafts.jsonl`             |
| `run-phase6c.ts`  | 4 KB       | Phase 6C        | Tinh chỉnh và chấm điểm Persona → `06c_refined_personas/refined_personas.jsonl`  |
| `run-phase7.ts`   | 4 KB       | Phase 7         | Tạo Runtime Persona → `07_runtime_personas/runtime_personas.jsonl`               |
| `run-phase7b.ts`  | 3.5 KB     | Phase 7B        | Gom nhóm Persona thành các hình mẫu (Archetypes) → `07b_persona_archetypes/`     |
| `run-phase8.ts`   | 10 KB      | Phase 8         | Chạy thử nghiệm giả lập (chỉ chạy mẫu với 5 Persona đầu tiên)                    |
| `run-phase8c.ts`  | 14 KB      | Phase 8C        | Đánh giá toàn diện với 10 kịch bản giả lập trên toàn bộ Persona                  |
| `run-phase10.ts`  | 4 KB       | Phase 10        | Tạo Persona đào tạo từ các Archetype → `10_training_personas/`                   |
| `run-phase10c.ts` | 16 KB      | Phase 10C       | Làm sạch và loại bỏ trùng lặp Persona → `10c_training_personas_clean/`           |
| `run-phase10d.ts` | 7.8 KB     | Phase 10D       | Làm phong phú thông tin Persona (Enrich) → `10d_training_personas_enriched/`     |
| `run-phase11b.ts` | 14 KB      | Phase 11B       | Script chạy QA: kiểm tra độ tương thích với Playground và tạo báo cáo            |

### 3.2 Thư viện xử lý logic Pipeline (`src/pipeline/`)

| File                                | Dung lượng | Vai trò / Chức năng                                                     |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------- |
| `sessionBuilder.ts`                 | 11 KB      | Thuộc Phase 3 — Chứa logic chia phiên hội thoại (session)               |
| `behaviorAggregator.ts`             | 18 KB      | Thuộc Phase 5 — Gom nhóm tín hiệu hành vi của từng tài khoản            |
| `contextRelationshipBuilder.ts`     | 14 KB      | Thuộc Phase 5B — Phân tích ngữ cảnh hội thoại                           |
| `relationshipPruner.ts`             | 9.5 KB     | Thuộc Phase 5C — Thuật toán loại bỏ dữ liệu nhiễu/yếu                   |
| `personaDraftBuilder.ts`            | 15 KB      | Thuộc Phase 6 — Tạo cấu trúc Persona nháp từ dữ liệu đã lọc             |
| `personaRefiner.ts`                 | 13 KB      | Thuộc Phase 6C — Chấm điểm và lọc các hành vi Persona không hợp lệ      |
| `runtimePersonaBuilder.ts`          | 10 KB      | Thuộc Phase 7 — Xây dựng định dạng chuẩn để đưa vào runtime             |
| `personaArchetypeBuilder.ts`        | 12 KB      | Thuộc Phase 7B — Gom cụm các Persona có hành vi tương tự nhau           |
| `trainingPersonaBuilder.ts`         | 10 KB      | Thuộc Phase 10 — Tạo các rule ứng xử, thông tin kịch bản đào tạo        |
| `trainingPersonaIdentityBuilder.ts` | 9.2 KB     | Thuộc Phase 10D — Tạo thông tin giả lập (Tên, vai trò, sản phẩm mua)    |
| `trainingPersonaMappings.ts`        | 5.5 KB     | Thuộc Phase 10D — Chứa danh sách tên tiếng Việt và các vai trò mua hàng |

### 3.3 Động cơ chạy giả lập (`src/runtime/`)

| File                       | Dung lượng | Vai trò                                                                | Tầm quan trọng trong Phase 12 |
| -------------------------- | ---------- | ---------------------------------------------------------------------- | ----------------------------- |
| `localAIRuntimeAdapter.ts` | 8.8 KB     | Gửi yêu cầu đến LLM nội bộ (Gemma), tự động fallback nếu lỗi           | **CỰC KỲ QUAN TRỌNG**         |
| `runtimePromptBuilder.ts`  | 4.2 KB     | Kết hợp dữ liệu Persona tạo thành System Prompt gửi cho LLM            | **CỰC KỲ QUAN TRỌNG**         |
| `runtimeStateRouter.ts`    | 4.4 KB     | Nhận diện trạng thái khách hàng (hỏi giá, hỏi kho, thanh toán, v.v.)   | **CỰC KỲ QUAN TRỌNG**         |
| `runtimeConstraints.ts`    | 5.4 KB     | Bộ lọc chặn từ ngữ kiểu "Assistant/Hỗ trợ", ép LLM giữ vai "Khách mua" | **CỰC KỲ QUAN TRỌNG**         |
| `runtimeSessionManager.ts` | 1.4 KB     | Quản lý trạng thái phiên chat giả lập thời gian thực                   | **CỰC KỲ QUAN TRỌNG**         |

### 3.4 Ứng dụng Playground (`src/playground/`)

| File        | Dung lượng | Vai trò                                                                            |
| ----------- | ---------- | ---------------------------------------------------------------------------------- |
| `server.ts` | 34 KB      | HTTP Server chạy cổng 3009. Cung cấp API danh sách persona, chat, và giao diện web |
| `x.txt`     | 6 B        | **File nháp** — Chỉ chứa chữ "test", không có tác dụng                             |

---

## 4. Danh sách các câu lệnh NPM Scripts

| Lệnh chạy            | File thực thi tương ứng    | Chức năng chính                    | Trạng thái       |
| -------------------- | -------------------------- | ---------------------------------- | ---------------- |
| `npm run phase1`     | `src/run-phase1.ts`        | Phase 1 — Đọc file Zalo thô        | ✅ Hoạt động tốt |
| `npm run phase2b`    | `src/run-phase2b.ts`       | Phase 2B — Phân loại tin nhắn      | ✅ Hoạt động tốt |
| `npm run phase3`     | `src/run-phase3.ts`        | Phase 3 — Tạo phiên hội thoại      | ✅ Hoạt động tốt |
| `npm run phase4`     | `src/run-phase4.ts`        | Phase 4 — Phân tích tín hiệu       | ✅ Hoạt động tốt |
| `npm run phase5`     | `src/run-phase5.ts`        | Phase 5 — Tổng hợp hành vi         | ✅ Hoạt động tốt |
| `npm run phase5b`    | `src/run-phase5b.ts`       | Phase 5B — Phân tích ngữ cảnh      | ✅ Hoạt động tốt |
| `npm run phase5c`    | `src/run-phase5c.ts`       | Phase 5C — Tối giản mối quan hệ    | ✅ Hoạt động tốt |
| `npm run phase6`     | `src/run-phase6.ts`        | Phase 6 — Tạo bản nháp Persona     | ✅ Hoạt động tốt |
| `npm run phase6c`    | `src/run-phase6c.ts`       | Phase 6C — Tinh chỉnh Persona      | ✅ Hoạt động tốt |
| `npm run phase7`     | `src/run-phase7.ts`        | Phase 7 — Tạo Runtime Persona      | ✅ Hoạt động tốt |
| `npm run phase7b`    | `src/run-phase7b.ts`       | Phase 7B — Tạo Archetypes          | ✅ Hoạt động tốt |
| `npm run phase8`     | `src/run-phase8.ts`        | Phase 8 — Thử nghiệm giả lập thử   | ✅ Hoạt động tốt |
| `npm run phase8c`    | `src/run-phase8c.ts`       | Phase 8C — Chạy đánh giá giả lập   | ✅ Hoạt động tốt |
| `npm run phase10`    | `src/run-phase10.ts`       | Phase 10 — Tạo Training Persona    | ✅ Hoạt động tốt |
| `npm run phase10c`   | `src/run-phase10c.ts`      | Phase 10C — Làm sạch Persona       | ✅ Hoạt động tốt |
| `npm run phase10d`   | `src/run-phase10d.ts`      | Phase 10D — Enrich tên và vai trò  | ✅ Hoạt động tốt |
| `npm run phase11b`   | `src/run-phase11b.ts`      | Phase 11B — Kiểm tra Playground QA | ✅ Hoạt động tốt |
| `npm run playground` | `src/playground/server.ts` | Khởi chạy server chat Playground   | ✅ Hoạt động tốt |

---

## 5. Bản đồ thư mục dữ liệu theo Phase

| Đường dẫn thư mục                 | Vai trò dữ liệu                       | Sinh ra bởi | Tháng dữ liệu | Dung lượng ước tính | Đề xuất                       |
| --------------------------------- | ------------------------------------- | ----------- | ------------- | ------------------- | ----------------------------- |
| `00_raw/zalo/2026-03/`            | File Zalo thô (.txt)                  | Thủ công    | 2026-03       | ~57 MB              | 🔒 **CẤM XÓA/SỬA**            |
| `01_normalized/2026-03/`          | Tin nhắn đã chuẩn hóa cấu trúc        | Phase 1     | 2026-03       | **~145 MB**         | ✅ Giữ lại                    |
| `02_filtered/2026-03/`            | Tin nhắn phân loại + Nhãn lọc         | Phase 2B    | 2026-03       | **~204 MB**         | ✅ Giữ lại                    |
| `03_sessions/2026-03/`            | Danh sách các session gom nhóm        | Phase 3     | 2026-03       | **~218 MB**         | ✅ Giữ lại                    |
| `04_behavior/2026-03/`            | Các tín hiệu hành vi trích xuất       | Phase 4     | 2026-03       | ~37 MB              | ✅ Giữ lại                    |
| `05_aggregated/2026-03/`          | Dữ liệu tổng hợp theo từng người      | Phase 5     | 2026-03       | ~4.2 MB             | ✅ Giữ lại                    |
| `05_ai_extractions/`              | **Thư mục rỗng**                      | —           | —             | 0                   | ⚠️ Thư mục ma, có thể xóa     |
| `05b_context/2026-03/`            | Mối quan hệ ngữ cảnh thô              | Phase 5B    | 2026-03       | ~8.6 MB             | ✅ Giữ lại                    |
| `05c_pruned/2026-03/`             | Mối quan hệ sau khi tối giản          | Phase 5C    | 2026-03       | ~8.2 MB             | ✅ Giữ lại                    |
| `06_monthly_summary/`             | **Thư mục rỗng**                      | —           | —             | 0                   | ⚠️ Thư mục ma, có thể xóa     |
| `06_persona_drafts/2026-03/`      | Bản thảo Persona ban đầu              | Phase 6     | 2026-03       | ~2.6 MB             | ✅ Giữ lại                    |
| `06c_refined_personas/2026-03/`   | Persona sau khi tinh chỉnh sâu        | Phase 6C    | 2026-03       | ~2.4 MB             | ✅ Giữ lại                    |
| `07_clusters/`                    | **Thư mục rỗng**                      | —           | —             | 0                   | ⚠️ Thư mục ma, có thể xóa     |
| `07_runtime_personas/2026-03/`    | Persona runtime thô (dùng dự phòng)   | Phase 7     | 2026-03       | ~2.5 MB             | ✅ Giữ lại (dùng dự phòng)    |
| `07b_persona_archetypes/2026-03/` | Gom nhóm Archetypes + Outliers        | Phase 7B    | 2026-03       | ~1.2 MB             | ✅ Giữ lại                    |
| `08_persona_drafts/`              | **Thư mục rỗng**                      | —           | —             | 0                   | ⚠️ Thư mục ma, có thể xóa     |
| `08_runtime_simulator/`           | Dữ liệu chạy simulator thử nghiệm     | Phase 8     | 2026-03       | 0                   | ⚠️ Chưa chạy simulator thực   |
| `09_approved_personas/`           | **Thư mục rỗng**                      | —           | —             | 0                   | ⚠️ Thư mục ma, có thể xóa     |
| `10_runtime_personas/`            | **Thư mục rỗng**                      | —           | —             | 0                   | ⚠️ Thư mục ma, dễ nhầm với 07 |
| `10_training_personas/2026-03/`   | Training Persona gốc từ Archetype     | Phase 10    | 2026-03       | ~72 KB              | ✅ Giữ lại                    |
| `10c_training_personas_clean/`    | Training Persona đã lọc sạch          | Phase 10C   | 2026-03       | ~49 KB              | ✅ Giữ lại                    |
| `10d_training_personas_enriched/` | **NGUỒN PERSONA CHÍNH THỨC**          | Phase 10D   | 2026-03       | ~56 KB              | 🔒 **CỰC KỲ QUAN TRỌNG**      |
| `11b_playground_qa/2026-03/`      | Kết quả chạy thử nghiệm QA Playground | Phase 11B   | 2026-03       | ~5 KB               | ✅ Giữ lại                    |
| `_backup/cleanup_...`             | Thư mục backup của đợt dọn dẹp trước  | Thủ công    | —             | Tùy file            | 📦 Lưu trữ hoặc xóa           |
| `config/`                         | Chứa file cấu hình AI và Batch        | Thủ công    | —             | Rất nhỏ             | ✅ Giữ lại                    |
| `logs/`                           | Chứa các file manifest ghi nhận chạy  | Pipeline    | —             | Rất nhỏ             | ✅ Giữ lại                    |

---

## 6. Trạng thái Pipeline theo tháng dữ liệu

| Tháng       | Raw Zalo | Chuẩn hóa | Phân loại | Chia phiên | Phân tích hành vi | Phân tích ngữ cảnh | Tinh chỉnh | Runtime | Archetypes | Tạo Training Persona    | Đạt QA Playground?   |
| ----------- | -------- | --------- | --------- | ---------- | ----------------- | ------------------ | ---------- | ------- | ---------- | ----------------------- | -------------------- |
| **2026-03** | ✅ OK    | ✅ OK     | ✅ OK     | ✅ OK      | ✅ OK             | ✅ OK              | ✅ OK      | ✅ OK   | ✅ OK      | ✅ Hoàn thành Phase 10D | **✅ SẴN SÀNG CHẠY** |

> **Hiện tại chỉ có dữ liệu của tháng 2026-03 là chạy đầy đủ toàn bộ pipeline.** Thư mục `_backup` cho thấy tháng 2026-05 đã từng tồn tại nhưng đã được dọn sạch hoàn toàn vào ngày 15/05/2026 để tránh làm đầy ổ cứng.

---

## 7. Nguồn dữ liệu Persona đang hoạt động trong Playground

### Nguồn chính thức (Primary Source)

```
sale-testlab-data/10d_training_personas_enriched/2026-03/training_personas_enriched.jsonl
  ├── training_persona_identity_summary.json  (Chứa danh sách đề xuất hiển thị trên UI)
  └── training_persona_identity_audit.json    (Chứa kết quả audit rò rỉ dữ liệu)
```

### Nguồn dự phòng (Fallback Source)

```
sale-testlab-data/07_runtime_personas/2026-03/runtime_personas.jsonl
```

### Logic tải dữ liệu của Playground (`server.ts` dòng 734-751)

1. Server cố gắng đọc file đã làm giàu danh tính ở thư mục **10D** trước.
2. File **07** chỉ được dùng làm nguồn fallback để cấu hình router chuyển trạng thái (`runtimeStateRouter.ts`).
3. Danh sách hiển thị trên UI web được ưu tiên sắp xếp theo đề xuất của file `summary.json` của thư mục 10D.
4. Gọi API `/api/version` trả về `"playground_version": "phase11-training-personas"`.

**Kết luận:** Playground đang hoạt động đồng bộ hoàn hảo với dữ liệu tối tân nhất từ **Phase 10D (Enriched Personas)**. ✅

---

## 8. Các file nháp / tạm / dư thừa có thể dọn dẹp

| File / Thư mục          | Phân loại        | Đường dẫn              | Lý do có thể dọn                                                         |
| ----------------------- | ---------------- | ---------------------- | ------------------------------------------------------------------------ |
| `scratch/inspect.js`    | File nháp        | `scratch/inspect.js`   | Script viết nhanh để quét dung lượng từ đợt audit trước, không còn dùng. |
| `src/playground/x.txt`  | File nháp        | `src/playground/x.txt` | File rác chỉ chứa chữ "test", dung lượng 6 bytes.                        |
| `_opencode_schema.json` | File hệ thống AI | root                   | Được sinh ra bởi AI tool, không liên quan đến code dự án.                |
| `opencode.json`         | Cấu hình AI      | root                   | Được sinh ra bởi AI tool, không liên quan đến code dự án.                |
| `05_ai_extractions/`    | Thư mục rỗng     | data                   | Không có script nào ghi dữ liệu vào đây.                                 |
| `06_monthly_summary/`   | Thư mục rỗng     | data                   | Không có script nào ghi dữ liệu vào đây.                                 |
| `07_clusters/`          | Thư mục rỗng     | data                   | Không có script nào ghi dữ liệu vào đây.                                 |
| `08_persona_drafts/`    | Thư mục rỗng     | data                   | Trùng tên với 06, không có dữ liệu.                                      |
| `08_runtime_simulator/` | Thư mục rỗng     | data                   | Phase 8 chưa được lưu đầu ra thực tế cho tháng 2026-03.                  |
| `09_approved_personas/` | Thư mục rỗng     | data                   | Chưa được phát triển logic ghi dữ liệu.                                  |
| `10_runtime_personas/`  | Thư mục rỗng     | data                   | Trùng tên gây nhầm lẫn với `07_runtime_personas`.                        |
| `_backup/cleanup_...`   | Thư mục backup   | data                   | Thư mục nén dữ liệu cũ, nên tải về máy cá nhân lưu trữ hoặc xóa.         |

---

## 9. Đề xuất dọn dẹp cụ thể (Cleanup Plan)

> ⚠️ **Chú ý**: Đây là đề xuất an toàn, chỉ thực hiện khi có xác nhận từ bạn.

### Thư mục CẤM SỬA/XÓA:

1. `00_raw/zalo/2026-03/` — Dữ liệu gốc Zalo. Mất là không thể khôi phục.
2. `10d_training_personas_enriched/2026-03/` — Dữ liệu dùng trực tiếp cho Playground chat.
3. `07_runtime_personas/2026-03/` — Dữ liệu dùng dự phòng cho Router.
4. Toàn bộ thư mục `src/` (Trừ file `src/playground/x.txt`).

### Các file an toàn có thể giữ lại làm tài liệu tham khảo:

- `plan_detail/plan_001.md`, `plan_002.md` (Kế hoạch cũ).
- Các thư mục từ `01_` đến `07b_` (Chuỗi dữ liệu trung gian, cần để chạy lại pipeline khi cần thiết).

### Các file/thư mục đề xuất xóa để sạch dự án:

- File rác `src/playground/x.txt`.
- Script nháp `scratch/inspect.js`.
- Xóa các thư mục rỗng ("thư mục ma") sau để tránh gây loạn cấu trúc:
  - `sale-testlab-data/05_ai_extractions`
  - `sale-testlab-data/06_monthly_summary`
  - `sale-testlab-data/07_clusters`
  - `sale-testlab-data/08_persona_drafts`
  - `sale-testlab-data/09_approved_personas`
  - `sale-testlab-data/10_runtime_personas`

---

## 10. Các file cần chuẩn bị cho Phase 12

Phase 12 sắp tới sẽ tập trung vào phát triển và nâng cấp tính năng chat giả lập Playground, tối ưu hóa các quy tắc ràng buộc AI cục bộ.

### Các file code cốt lõi cần làm việc:

1. **`src/playground/server.ts`** — Nơi xử lý API chat, quản lý danh sách persona và giao diện chat của người dùng.
2. **`src/runtime/localAIRuntimeAdapter.ts`** — Quản lý gọi API LLM nội bộ (chạy mô hình Gemma).
3. **`src/runtime/runtimePromptBuilder.ts`** — Quản lý cấu trúc prompt, ráp danh tính enriched persona vào prompt.
4. **`src/runtime/runtimeStateRouter.ts`** — Quản lý logic tự chuyển trạng thái của khách hàng.
5. **`src/runtime/runtimeConstraints.ts`** — Bộ luật chặn từ ngữ sai ngữ cảnh hoặc bị cấm.
6. **`src/run-phase11b.ts`** — Dùng để kiểm tra và chấm điểm QA sau mỗi thay đổi lớn.

---

## 11. Các điểm gây loạn/nhầm lẫn trong cấu trúc dự án cần lưu ý

1. **Trùng lặp tên thư mục**:
   - `06_persona_drafts` (Thư mục chuẩn của Phase 6, có dữ liệu) dễ bị nhầm với `08_persona_drafts` (Thư mục ma, rỗng).
   - `07_runtime_personas` (Thư mục chuẩn của Phase 7, có dữ liệu) dễ bị nhầm với `10_runtime_personas` (Thư mục ma, rỗng).
2. **Thiếu dữ liệu Phase 8**:
   - Thư mục `08_runtime_simulator` trống trơn vì Phase 8 & 8C chỉ chạy giả lập mẫu trên console chứ chưa lưu file đầu ra cố định cho tháng 2026-03. Dự án đã nhảy thẳng lên xây dựng Training Persona từ Phase 10.
3. **Dung lượng file trung gian cực lớn**:
   - File `sessions.jsonl` (218 MB), `messages_classified.jsonl` (204 MB) rất nặng. Nếu chạy lại pipeline từ Phase 1-3 sẽ mất nhiều thời gian đọc ghi ổ cứng.
4. **Thư mục backup chiếm không gian**:
   - Thư mục `_backup/` chứa bản lưu của đợt dọn dẹp trước, cần được cân nhắc giải phóng nếu ổ đĩa bị đầy.

---

## 12. Đề xuất hành động tiếp theo (Next Steps)

1. **Kiểm tra trạng thái Playground hiện tại**:
   Khởi chạy thử Playground server với dữ liệu 2026-03 để đảm bảo hệ thống trước Phase 12 hoạt động bình thường:

   ```powershell
   npm run playground -- --month=2026-03
   ```

   Sau đó mở trình duyệt kiểm tra cổng `http://localhost:3009`.

2. **Khởi chạy script QA để lấy benchmark**:

   ```powershell
   npm run phase11b -- --month=2026-03
   ```

3. **Thực hiện dọn dẹp an toàn các thư mục ma và file nháp** (sau khi bạn đồng ý).

4. **Tuyệt đối không chạy thêm tháng mới (ví dụ 2026-04 hay 2026-05)** để tránh xung đột dữ liệu cho đến khi Phase 12 được hoàn thành và kiểm thử thành công trên dữ liệu chuẩn 2026-03.
