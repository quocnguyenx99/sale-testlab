# Report 02: Privacy and Data Security

Báo cáo này đánh giá mức độ tuân thủ nguyên tắc bảo mật thông tin và an toàn dữ liệu cá nhân theo chính sách bảo mật của Sale TestLab.

## 1. Kiểm soát phiên bản Git và chống rò rỉ dữ liệu thô

- **Thư mục dữ liệu**: Tất cả dữ liệu thô, trung gian và đầu ra đều được lưu trong thư mục `sale-testlab-data/`.
- **Cấu hình Gitignore**: File `.gitignore` đã bỏ qua hoàn toàn thư mục này bằng dòng khai báo:
  ```
  sale-testlab-data/
  ```
- **Đánh giá rủi ro**: Do thư mục mẹ chứa dữ liệu đã bị Git bỏ qua ở mức cao nhất, không có bất kỳ khả năng nào để các file dữ liệu Zalo thô hoặc kết quả phân tích trung gian có thể bị commit nhầm lên repo Git công khai.
- **Phân loại vùng an toàn/không an toàn**:
  - **Vùng An Toàn (Có thể commit)**: `src/`, `docs/`, `package.json`, `.gitignore`, `tsconfig.json`. Vùng này chỉ chứa mã nguồn, tài liệu hướng dẫn và cấu hình hệ thống.
  - **Vùng Không An Toàn (Tuyệt đối KHÔNG commit)**: `sale-testlab-data/`, `.env`, `logs/`. Vùng này chứa thông tin khách hàng, khóa API local, và dữ liệu hội thoại thực tế.

## 2. Kiểm soát mã nguồn và cơ chế ghi log (Sanitization)

- **Sanitization lỗi**: Khi chạy phân tích cú pháp ở Phase 1 (`run-phase1.ts`), nếu có dòng tin nhắn không hợp lệ hoặc lỗi Zod Schema, hệ thống chỉ ghi lại lỗi kỹ thuật (chẳng hạn: lỗi kiểu dữ liệu cột, thiếu dữ liệu) cùng mã hash của file và số dòng. Toàn bộ nội dung văn bản thô của tin nhắn bị lỗi **KHÔNG** bị ghi vào log lỗi `parse_errors_YYYY-MM.jsonl`.
- **Không gửi lên Cloud AI**: Không có bất kỳ import hoặc SDK nào của OpenAI, Google Gemini, Anthropic hay các nhà cung cấp Cloud AI khác được gọi trong các pha xử lý dữ liệu từ 1 đến 7b. Việc phân loại tin nhắn, trích xuất hành vi và phân cụm persona được thực hiện 100% bằng tập luật và đối khớp biểu thức chính quy (regular expressions) chạy offline cục bộ.

## 3. Luồng dữ liệu bảo mật (Privacy Pipeline Flow)

Pipeline tuân thủ đúng thiết kế bảo mật cục bộ từng bước:
1. **Raw Local Zalo**: Đọc từ local disk → parse bằng parser cục bộ.
2. **Normalized Data**: Chuẩn hóa cấu trúc tin nhắn cục bộ.
3. **Filtered/Sessionized**: Loại bỏ tin nhắn rác, tách session theo thời gian bằng thuật toán deterministic cục bộ.
4. **Behavior Extraction**: Trích xuất tín hiệu hành vi bằng regex & rule-matching offline.
5. **Persona Draft & Archetypes**: Phân cụm hành vi tạo persona thô cục bộ.
6. **Anonymized Persona**: Chỉ lưu thông tin hành vi chung (không chứa tên thật, số điện thoại, stk hay thông tin định danh cá nhân của khách hàng thực tế).
7. **Runtime Simulation**: Nạp persona đã ẩn danh hóa vào mô hình AI cục bộ (Qwen3:8B qua endpoint local) để kiểm tra hành vi giả lập.

## 4. Danh sách các lệnh CẤM chạy (Do-Not-Run)

Để đảm bảo không hiển thị thông tin riêng tư lên context của mô hình AI bên ngoài, tuyệt đối **KHÔNG** chạy các lệnh sau:
- `cat sale-testlab-data/00_raw/...` hoặc `head sale-testlab-data/00_raw/...`
- `Get-Content sale-testlab-data/00_raw/...`
- `type sale-testlab-data/00_raw/...`
- Bất kỳ script tùy biến nào in ra trực tiếp nội dung tin nhắn thô lên console.

## 5. Danh sách các lệnh An Toàn (Safe Commands)

Các lệnh sau được phép chạy vì chúng chỉ trả về thông tin siêu dữ liệu (metadata), thống kê hoặc chạy trên môi trường test mock:
- `Get-ChildItem -Path sale-testlab-data/00_raw/zalo/2026-03 -File` (chỉ hiển thị tên file và dung lượng).
- `npx tsx src/scratch_test_qwen.ts` (kiểm tra kết nối AI local bằng câu hỏi generic).
- `npx tsx src/runtime/phase12h1_regression_fix.regression.test.ts` (chạy test suite giả lập an toàn).
