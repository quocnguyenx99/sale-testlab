# Report 01: Codebase and Phase Status

Báo cáo này kiểm tra cấu trúc mã nguồn, trạng thái Git, các script có sẵn và tiến độ hoàn thành các phase xử lý dữ liệu cho tháng 3/2026 (`2026-03`).

## 1. Trạng thái Git (Git Status & Commits)

- **Git Status**: Sạch (`clean`). Không có file nào chưa được track hoặc bị sửa đổi ngoài tầm kiểm soát.
- **Commit gần đây**:
  - `b64080b docs: add phase 12H session handoff` (Commit mới nhất)
  - `0d0a8f0 docs: add runtime contract for phase 12H` (Chốt hợp đồng runtime)
  - `b51767a chore: add local AI adapter error logging`
  - `757aa4b docs: add phase 12H audit and session checkpoint`
  
**Kết luận**: Toàn bộ các cải tiến và sửa lỗi của Phase 12H đã được tích hợp đầy đủ vào nhánh `main` và ở trạng thái sạch sẽ.

## 2. Cấu trúc dự án (Project Structure Summary)

Thư mục làm việc `d:\Workspace\sale-testlab-data-pipeline` tuân thủ mô hình pipeline cục bộ:
- `src/parser/`: Chứa file `zaloparser.ts` phân tích cú pháp hội thoại thô từ Zalo.
- `src/normalizer/`: Chứa `contentNormalizer.ts` chuẩn hóa dữ liệu tin nhắn.
- `src/pipeline/`: Chứa các module cốt lõi định hình hành vi, tách session và sinh persona.
- `src/runtime/`: Lớp logic phục vụ giả lập khách hàng (Customer AI), bảo vệ danh tính (identity lock) và kiểm soát an toàn (safety guards).
- `src/playground/`: Server UI cục bộ và runner chạy thử nghiệm Live QA.
- `sale-testlab-data/`: Thư mục lưu trữ dữ liệu qua từng giai đoạn của pipeline. Thư mục này được bỏ qua hoàn toàn bởi Git thông qua `.gitignore` để đảm bảo bảo mật.

## 3. Bản đồ Scripts (npm scripts map)

Được định nghĩa trong [package.json](file:///d:/Workspace/sale-testlab-data-pipeline/package.json):

| Lệnh npm | Lệnh thực thi | Mục tiêu |
|---|---|---|
| `npm run phase1` | `tsx src/run-phase1.ts` | Phân tích cú pháp Zalo thô và chuẩn hóa cấu trúc |
| `npm run phase2b` | `tsx src/run-phase2b.ts` | Phân loại tin nhắn và lọc rác/nội bộ |
| `npm run phase3` | `tsx src/run-phase3.ts` | Chia nhỏ tin nhắn thành các session hội thoại |
| `npm run phase4` | `tsx src/run-phase4.ts` | Trích xuất tín hiệu và chấm điểm hành vi |
| `npm run phase5` | `tsx src/run-phase5.ts` | Tổng hợp hành vi theo từng thực thể khách hàng |
| `npm run phase5b` | `tsx src/run-phase5b.ts` | Xây dựng mối quan hệ ngữ cảnh |
| `npm run phase5c` | `tsx src/run-phase5c.ts` | Tinh gọn (prune) các mối quan hệ ngữ cảnh |
| `npm run phase6` | `tsx src/run-phase6.ts` | Dự thảo (draft) cấu hình persona |
| `npm run phase6c` | `tsx src/run-phase6c.ts` | Tinh chỉnh refined persona |
| `npm run phase7` | `tsx src/run-phase7.ts` | Xây dựng runtime persona |
| `npm run phase7b` | `tsx src/run-phase7b.ts` | Phân cụm archetype hành vi |
| `npm run phase8` | `tsx src/run-phase8.ts` | Giả lập hội thoại để sinh prompt & preview |
| `npm run phase8c` | `tsx src/run-phase8c.ts` | Đánh giá chất lượng giả lập |
| `npm run phase10` | `tsx src/run-phase10.ts` | Biên tập training persona |
| `npm run phase10c` | `tsx src/run-phase10c.ts` | Làm sạch training persona |
| `npm run phase10d` | `tsx src/run-phase10d.ts` | Làm giàu danh tính training persona |
| `npm run phase11b` | `tsx src/run-phase11b.ts` | Kiểm tra tính sẵn sàng cho Playground |
| `npm run playground` | `tsx src/playground/server.ts` | Khởi chạy giao diện Playground |

## 4. Trạng thái các Phase dữ liệu hiện tại

- **Dữ liệu tháng 3/2026 (2026-03) hiện có**:
  - Hiện tại trong `sale-testlab-data/00_raw/zalo/2026-03/` đã có **10 file Zalo thô** (dung lượng tổng ~60.3MB).
  - Toàn bộ 10 file này đã được chạy qua đầy đủ từ **Phase 1 đến Phase 11b**. Các thư mục đầu ra tương ứng từ `01_normalized` đến `10d_training_personas_enriched` và `11b_playground_qa` đều đã chứa dữ liệu hoàn chỉnh cho tháng 3/2026.
- **Nguồn Persona chính thức**:
  - Playground hiện tại lấy dữ liệu cấu hình từ thư mục `10d_training_personas_enriched/2026-03/training_personas_enriched.jsonl` làm nguồn chính thức cho giả lập.
- **Hợp đồng Runtime (Runtime Contract)**:
  - Đã được tạo tại [docs/RUNTIME_CONTRACT_PHASE12H.md](file:///d:/Workspace/sale-testlab-data-pipeline/docs/RUNTIME_CONTRACT_PHASE12H.md) và được chấp nhận (accepted) chính thức làm baseline ổn định trước khi mở rộng quy mô import dữ liệu.
