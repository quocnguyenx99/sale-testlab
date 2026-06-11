# Report 06: 50-File Import Recommendation

Báo cáo này đưa ra các khuyến nghị hành động cụ thể cho việc import toàn bộ 50 file Zalo thô tháng 3/2026 (`2026-03`) vào hệ thống dữ liệu dự án.

## 1. Quyết định phê duyệt (Verdict)

> [!IMPORTANT]
> **PHÊ DUYỆT CHẠY THỬ NGHIỆM TRƯỚC (APPROVE SAMPLE FIRST)**:
> Hệ thống và môi trường đã sẵn sàng. Tuy nhiên, để tuân thủ quy tắc bảo mật dữ liệu và phòng ngừa lỗi nghẽn tải phần cứng, **không được chạy ngay lập tức cả 50 file**.
> Quy trình bắt buộc là: **Kiểm tra danh sách file (Dry-run) → Chạy thử 5 file (Sample Run) → Kiểm tra kết quả mẫu → Chạy toàn bộ 50 file**.

## 2. Nơi đặt file dữ liệu thô

Toàn bộ 50 file Zalo thô dạng `.txt` bắt buộc phải được copy vào đường dẫn duy nhất sau:
`sale-testlab-data/00_raw/zalo/2026-03/`

*Lưu ý: Không tạo thêm thư mục con hay đặt tên sai khác.*

## 3. Quy trình thực thi từng bước (Step-by-Step Execution Plan)

Người dùng cần chạy các lệnh theo đúng trình tự sau trong Powershell:

### Bước 1: Kiểm tra tổng quan dữ liệu (Dry-run)
Lệnh chạy thử nghiệm để quét dung lượng và đếm số file thô thực tế đã nhận diện:
```bash
npm run phase1 -- --month=2026-03 --dry-run
```
*Việc cần check*: Đảm bảo console hiển thị đúng tổng số file (ví dụ: 50 files) và tổng dung lượng mong đợi.

### Bước 2: Chạy thử mẫu 5 file (Sample run)
```bash
npm run phase1 -- --month=2026-03 --limit-files=5 --force
```
*Việc cần check*: Đảm bảo 5 file được parse thành công, tạo ra file `messages.jsonl` mẫu trong `sale-testlab-data/01_normalized/2026-03/`. Kiểm tra xem file `parse_errors_2026-03.jsonl` trong thư mục `logs/` có phát sinh lỗi nghiêm trọng nào không.

### Bước 3: Thực hiện chạy đầy đủ Phase 1 (Full Parse & Normalization)
```bash
npm run phase1 -- --month=2026-03 --force
```
*Lưu ý*: Cờ `--force` là bắt buộc vì manifest cũ đã ghi nhận 10 file hoàn thành. Ta cần ép chạy lại để dọn dẹp và gom chung toàn bộ dữ liệu của 50 file vào file đích `messages.jsonl`.

### Bước 4: Chạy các pha phân tích và trích xuất offline ( deterministic pipeline)
Chạy tuần tự các lệnh sau để xử lý dữ liệu hoàn toàn bằng tập luật offline (không gọi AI):
```bash
# Phân loại và lọc tin nhắn nội bộ
npm run phase2b -- --month=2026-03

# Gom cụm tin nhắn theo Session
npm run phase3 -- --month=2026-03

# Trích xuất tín hiệu hành vi khách hàng
npm run phase4 -- --month=2026-03

# Tổng hợp hành vi theo cuộc hội thoại
npm run phase5 -- --month=2026-03

# Xây dựng mối quan hệ ngữ cảnh
npm run phase5b -- --month=2026-03

# Cắt tỉa liên kết ngữ cảnh nhiễu
npm run phase5c -- --month=2026-03

# Dự thảo cấu hình persona khách hàng
npm run phase6 -- --month=2026-03

# Tinh chỉnh refined persona
npm run phase6c -- --month=2026-03

# Xây dựng runtime persona ẩn danh
npm run phase7 -- --month=2026-03

# Phân cụm archetype hành vi
npm run phase7b -- --month=2026-03
```

### Bước 5: Chạy Giả lập và Mô phỏng (Local AI Simulation)
Chỉ chạy bước này khi local AI Qwen3 trực tuyến (đã kiểm tra thành công):
```bash
# Giả lập hội thoại persona
npm run phase8 -- --month=2026-03

# Đánh giá kết quả mô phỏng
npm run phase8c -- --month=2026-03
```

### Bước 6: Tổng hợp và làm giàu danh tính Persona huấn luyện
```bash
# Biên tập training persona
npm run phase10 -- --month=2026-03

# Làm sạch training persona
npm run phase10c -- --month=2026-03

# Làm giàu danh tính persona (synthetic names, roles)
npm run phase10d -- --month=2026-03

# Kiểm tra sẵn sàng Playground
npm run phase11b -- --month=2026-03
```

## 4. Những điều tuyệt đối KHÔNG làm

- **KHÔNG COMMIT** bất kỳ thay đổi nào trong thư mục `sale-testlab-data` lên Git (Thư mục này đã được gitignore bảo vệ, giữ nguyên như vậy).
- **KHÔNG IN** nội dung văn bản tin nhắn thô ra console hay ghi log ngoài hệ thống.
- **KHÔNG GỬI** dữ liệu thô tháng 3 lên bất kỳ mô hình AI đám mây nào (Qwen3 local chỉ nhận prompt chứa persona đã ẩn danh hóa ở Phase 8, không nhận raw chat).
