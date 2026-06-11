# Report 03: Data Pipeline Readiness

Báo cáo này đánh giá khả năng xử lý của pipeline hiện tại đối với kế hoạch nhập dữ liệu Zalo thô tháng 3/2026 (`2026-03`).

## 1. Bản kiểm kê thư mục dữ liệu (Folder Inventory)

Thư mục `sale-testlab-data` chứa cấu trúc phân lớp hoàn chỉnh để lưu trữ dữ liệu đầu ra cho từng pha:
- `00_raw/zalo/`: Chứa file nguồn Zalo thô (.txt).
- `01_normalized/`: File tin nhắn đã chuẩn hóa (.jsonl).
- `02_filtered/`: Tin nhắn đã phân loại & loại rác (.jsonl).
- `03_sessions/`: Các tin nhắn được gom cụm theo session (.jsonl).
- `04_behavior/`: Tín hiệu hành vi khách hàng (.jsonl).
- `05_aggregated/`: Dữ liệu tổng hợp theo khách hàng (.jsonl).
- `05b_context/` & `05c_pruned/`: Phân tích ngữ cảnh và cắt tỉa liên kết.
- `06_persona_drafts/` & `06c_refined_personas/`: Dự thảo & tinh chỉnh persona.
- `07_runtime_personas/` & `07b_persona_archetypes/`: Persona dùng cho runtime và phân cụm.
- `10_training_personas/`, `10c_clean/`, `10d_enriched/`: Persona phục vụ huấn luyện đã chuẩn hóa và làm sạch.

## 2. Kiểm kê file dữ liệu thô tháng 3/2026

- **Số lượng file hiện có**: Hiện tại chỉ có **10 file** tin nhắn Zalo thô định dạng `.txt` nằm trong thư mục `sale-testlab-data/00_raw/zalo/2026-03/` (Dung lượng: ~60.3 MB, chứa khoảng 200,000 tin nhắn).
- **Mục tiêu import**: Theo kế hoạch, người dùng muốn import tổng cộng **50 file** Zalo thô.
- **Sự thiếu hụt**: Hiện tại thiếu **40 file** thô chưa được thêm vào thư mục làm việc.

## 3. Khuyến nghị và cảnh báo về đường dẫn lưu trữ

> [!WARNING]
> **CẢNH BÁO ĐƯỜNG DẪN SAI QUY ƯỚC**:
> Nếu người dùng đặt dữ liệu tại `sale-testlab-data/00_raw_zalo/2026-03` như đề xuất trong một số trao đổi cũ, toàn bộ hệ thống script sẽ bị lỗi do mã nguồn `src/run-phase1.ts` cứng quy ước tìm kiếm tại đường dẫn:
> `sale-testlab-data/00_raw/zalo/2026-03/`
>
> **Khuyến nghị**: Tuyệt đối đặt toàn bộ 50 file Zalo thô vào đúng thư mục `sale-testlab-data/00_raw/zalo/2026-03/`.

## 4. Khả năng xử lý tăng trưởng và Incremental Processing

- **Cơ chế Manifest & File Hashing**: Hệ thống đã tích hợp sẵn cơ chế kiểm tra sự thay đổi dữ liệu dựa trên mã băm SHA-256 trong file `manifest_2026-03.json`. 
- **Cách thức hoạt động**: Khi chạy `run-phase1.ts`, script sẽ tính toán hash của từng file thô. Nếu file đã được đánh dấu là `completed` trong manifest và hash không đổi, script sẽ tự động bỏ qua (`skip`) để tiết kiệm thời gian xử lý.
- **Các tham số hỗ trợ nâng cao trong Phase 1**:
  - `--dry-run`: Chạy thử để kiểm tra số lượng và tổng dung lượng file chuẩn bị xử lý mà không ghi đè dữ liệu.
  - `--force`: Ép buộc xử lý lại toàn bộ file kể cả khi manifest báo đã hoàn thành (cực kỳ hữu ích khi muốn tạo lại toàn bộ file tổng hợp `messages.jsonl` sau khi có thêm file mới).
  - `--limit-files=N`: Giới hạn chỉ xử lý tối đa N file đầu tiên (phù hợp để test chạy thử 1-5 file trước).
  - `--exclude-largest`: Tự động loại bỏ file có dung lượng lớn nhất trong danh sách xử lý để tăng tốc độ kiểm thử.

## 5. Đánh giá tính sẵn sàng của mã nguồn các Phase

- **Phần lớn các Phase (1 đến 7b, và 10 đến 11b)**: Hoàn toàn **SẴN SÀNG** chạy trực tiếp mà không cần sửa đổi mã nguồn. Các script được viết theo dạng tổng quát hóa, tự động xử lý toàn bộ tập tin đầu vào trong thư mục tháng được chỉ định hoặc đọc file tổng hợp dạng `.jsonl`.
- **Nên tái sử dụng hay tái tạo dữ liệu**: Khi bổ sung thêm 40 file Zalo mới vào tháng 3/2026, toàn bộ dữ liệu thống kê hành vi và các persona tương ứng sẽ bị thay đổi và mở rộng. Do đó, **không được tái sử dụng** các sản phẩm trung gian cũ mà bắt buộc phải chạy **tái tạo (regenerate) toàn bộ pipeline** từ Phase 1 đến Phase 11b bằng cờ `--force`.
