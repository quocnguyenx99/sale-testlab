# Report 04: Local AI Qwen Readiness

Báo cáo này đánh giá khả năng tương thích và hiệu năng của mô hình ngôn ngữ lớn cục bộ (Local LLM) Qwen3:8B trong việc xử lý mô phỏng hội thoại và phân tích hành vi.

## 1. Trạng thái và Cấu hình mô hình AI local

- **Endpoint hiện tại**: `http://192.168.117.73:9001/v1` (tương thích chuẩn OpenAI API).
- **Model Name định cấu hình**: `qwen3-8b` (được cấu hình trong `.env`).
- **Khóa API**: `sk-ai-atom-qwen3-8b-9001`.
- **Kết quả kiểm tra thực tế**:
  - Chạy kết nối thành công qua file thử nghiệm `src/scratch_test_qwen.ts`.
  - Phản hồi nhận được từ mô hình trong vòng **301ms** (Độ trễ cực thấp, rất lý tưởng cho môi trường giả lập thời gian thực).
  - Không gặp lỗi kết nối hay lỗi định dạng dữ liệu (`error_type = null`).

## 2. Khả năng tái sử dụng của LocalAIAdapter

- **Cơ chế hoạt động**: `localAIRuntimeAdapter.ts` đóng gói kết nối API chat completions. Nó được thiết kế tổng quát hóa, không chỉ phục vụ chat Playground mà còn được dùng để chạy giả lập hàng loạt persona trong Phase 8 (`run-phase8.ts`) và đánh giá tự động ở Phase 8c (`run-phase8c.ts`).
- **Giới hạn số lượng Token (max_tokens)**: Được cấu hình là `512` token cho câu trả lời của khách hàng, đảm bảo câu trả lời của Customer AI luôn ngắn gọn, súc tích giống thực tế, tránh hiện tượng sinh quá dài gây hao phí năng lượng tính toán hoặc lỗi định dạng.

## 3. Khả năng xử lý lượng lớn dữ liệu thô cùng lúc (Raw Data Batching)

> [!CAUTION]
> **KHÔNG GỬI FILE THÔ LÊN LOCAL AI**:
> Mô hình Qwen3:8B (kể cả khi chạy cục bộ với cửa sổ ngữ cảnh lớn) **không thể** và **không được phép** nhận trực tiếp 50 file dữ liệu Zalo thô cùng lúc (dung lượng văn bản thô tổng cộng >300MB, vượt xa giới hạn ngữ cảnh của mô hình và gây nghẽn phần cứng nghiêm trọng).

- **Thiết kế phân lớp tách biệt**: Hệ thống tuân thủ nguyên tắc: **Tập luật đi trước, AI đi sau**.
  - Các bước từ Phase 1 đến Phase 7b thực hiện phân tích cú pháp, dọn dẹp dữ liệu, lọc rác, chia session, trích xuất tín hiệu hành vi và định hình persona bằng **thuật toán luật thuần túy (deterministic rule-based)**.
  - Local AI Qwen3 **chỉ được sử dụng** ở giai đoạn sau (Phase 8 giả lập) khi dữ liệu đã được tổng hợp thành các dòng cấu hình Persona ẩn danh hóa siêu ngắn.
  - **Khuyến nghị**: Tuyệt đối duy trì cơ chế này. Chỉ gửi các session/prompt nhỏ lẻ đã ẩn danh hóa sang cho Qwen3 xử lý, không bao giờ gửi các file dữ liệu thô cỡ lớn.

## 4. Khuyến nghị cấu hình Batch Size và Concurrency cho Phase 8 (Giả lập)

Khi chạy mô phỏng hàng loạt cho 50 file dữ liệu mới (có thể sinh ra hàng trăm persona):
- **Concurrency (Độ song song)**: Nên giới hạn ở mức **1 - 3 luồng chạy đồng thời** tùy thuộc vào dung lượng VRAM/GPU của máy chủ local `192.168.117.73`. Chạy quá nhiều luồng song song sẽ dẫn đến tràn bộ nhớ GPU và gây ra lỗi Timeout.
- **Timeout & Retries**: Cấu hình thời gian chờ mặc định (`timeoutMs`) là **30,000ms** (30 giây). Nếu gặp lỗi nghẽn phần cứng dẫn đến timeout, adapter sẽ tự động kích hoạt cơ chế `deterministic_fallback` để hệ thống không bị crash giữa chừng.
