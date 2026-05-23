# Kế hoạch Mở rộng Pipeline & Runtime Simulator Zalo TestLab

Tài liệu này phác thảo chiến lược đề xuất để xử lý toàn bộ tập dữ liệu tháng 3, cải thiện độ chân thực của khách hàng AI, nâng cao chiều sâu của các persona và chuẩn bị cho việc tách microservice trong tương lai.

## Yêu cầu Người dùng Đánh giá

> [!WARNING]
> Vui lòng xem xét chiến lược chia nhỏ dữ liệu (chunking) và các thay đổi đề xuất đối với việc xây dựng prompt. Chúng ta cần đảm bảo script xử lý hàng loạt không vi phạm giới hạn bộ nhớ trên máy local khi chạy Gemma.
> Phần Kiến trúc Microservice hiện tại chỉ mang tính khái niệm; vui lòng xác nhận xem các định nghĩa ranh giới này có phù hợp với định hướng của bạn hay không.

## Các Câu hỏi Mở

> [!IMPORTANT]
>
> 1. Kích thước file/số lượng dòng dự kiến cho toàn bộ tập dữ liệu Zalo tháng 3 là bao nhiêu? Điều này sẽ giúp tinh chỉnh kích thước batch (ví dụ: 500 hay 2000 dòng mỗi chunk).
> 2. Script xử lý hàng loạt mới nên chạy toàn bộ pipeline (Phase 1-7) tuần tự cho từng chunk, hay nên xử lý Phase 1 cho tất cả các chunk, sau đó đến Phase 2 cho tất cả các chunk, v.v.?
> 3. Đối với sắc thái "chưa chắc chắn/lưỡng lự" (uncertain-interest), bạn có ví dụ cụ thể nào về hành vi "chần chừ" hoặc "trì hoãn" từ dữ liệu thực tế mà chúng ta nên ưu tiên trong việc trích xuất hành vi mới không?

## Các Thay đổi Đề xuất

---

### 1. Mở rộng Pipeline Dữ liệu Thô & Xử lý Hàng loạt (Batch Processing)

Để xử lý an toàn tập dữ liệu Zalo tháng 3 mà không gặp lỗi OOM (Out Of Memory) và để quản lý giới hạn sinh văn bản của AI local.

#### [NEW] `src/pipeline/batchProcessor.ts`

- Triển khai trình đọc luồng (stream) sử dụng `readline` của Node.js để đọc các file thô theo từng dòng.
- Nhóm các dòng thành các chunk dễ quản lý (ví dụ: 1000 cuộc hội thoại mỗi batch).
- Điều phối các lệnh gọi AI local với giới hạn luồng đồng thời (concurrency) và cơ chế thử lại (retry) để xử lý tình trạng timeout của Gemma 4 E2B.

#### [MODIFY] Các script `src/run-phase*.ts`

- Cập nhật các phase script để chấp nhận chỉ mục chunk hoặc đường dẫn file đầu vào/đầu ra cụ thể thông qua tham số dòng lệnh (CLI), thay vì fix cứng (hardcode) đường dẫn thư mục.
- Đảm bảo tất cả các trạng thái trung gian (`01_normalized/`, `02_filtered/`, v.v.) tuân thủ quy ước đặt tên chunk (ví dụ: `batch_001_normalized.jsonl`).

---

### 2. Cải thiện Thêm Độ Chân thực của Runtime (Runtime Realism)

Để giải quyết tình trạng các câu trả lời giống như văn mẫu và sắc thái "chưa chắc chắn/lưỡng lự" còn yếu.

#### [MODIFY] `src/runtime/runtimeStateRouter.ts`

- Thêm các trạng thái runtime mới để nhận diện các sắc thái như `hesitation` (chần chừ), `comparison_shopping` (so sánh giá), và `budget_stall` (trì hoãn do ngân sách).
- Cải thiện logic suy luận dựa trên mức độ hối thúc của Sale (ví dụ: nếu Sale hối thúc thanh toán, Khách hàng có thể sẽ trì hoãn).

#### [MODIFY] `src/runtime/runtimeConstraints.ts`

- Thêm các câu từ ưa thích và các ràng buộc hành vi cho các trạng thái mới (ví dụ: "Để mình xem lại", "Dạ để mình hỏi ý kiến người nhà").
- Đưa khái niệm "nhiệt độ" (temperature) hoặc "seed biến thể" (variation seed) vào mức prompt để buộc AI phải chọn các cấu trúc câu từ khác nhau một cách an toàn.

#### [MODIFY] `src/runtime/runtimePromptBuilder.ts`

- Tiêm (inject) các trạng thái sắc thái mới này vào phần ngữ cảnh (context) của prompt.
- Thêm các ràng buộc phủ định để chống lại sự đồng tình kiểu văn mẫu (ví dụ: "Không chỉ nói 'Ok shop' hoặc 'Dạ vâng' nếu tin nhắn trước đó là một lời chào hàng chi tiết; hãy phản hồi lại ngữ cảnh chào hàng đó hoặc tỏ ra chần chừ").

---

### 3. Chiến lược Cải thiện Chất lượng Persona

Để phát triển các persona từ các hồ sơ hành vi đơn giản thành các bối cảnh khách hàng sâu sắc.

#### [MODIFY] `src/run-phase4.ts` (Trích xuất Hành vi)

- Trích xuất "nỗi đau" (pain points), "tín hiệu ngân sách" (budget signals), và "mức độ khẩn cấp" (urgency levels) bên cạnh các hành vi định giá/vận chuyển thông thường.
- Ghi nhận _trigger_ (điều kiện kích hoạt) cho một hành vi (ví dụ: "chỉ phàn nàn về giá KHI phí ship được nhắc đến").

#### [MODIFY] `src/run-phase6.ts` & `src/run-phase6c.ts` (Tinh chỉnh Persona)

- Phân cụm các hồ sơ hành vi tương tự nhau trên tập dữ liệu tháng 3 lớn hơn để tổng hợp thành các "Deep Personas" (Persona Sâu sắc).
- Thêm trường `scenario_context` (ngữ cảnh kịch bản) mới vào persona, định nghĩa điều kiện bắt đầu của họ (ví dụ: "Đang tìm quà gấp, nhưng rất nhạy cảm về giá").

---

### 4. Kế hoạch Tách Microservice Trong Tương Lai (Khái niệm)

Chuyển đổi từ một phòng thí nghiệm local sang một kiến trúc sẵn sàng cho production.

- **Data Pipeline Service**: Tách các phase 1-7 thành một worker bất đồng bộ. Được kích hoạt qua API/cron, xử lý dữ liệu ở background và xuất các persona đã được tinh chỉnh vào Database.
- **AI Runtime Service**: Một service suy luận chuyên biệt bọc lại `src/runtime`. Expose một endpoint dạng `/chat/completions`. Quản lý trạng thái hội thoại và tích hợp persona.
- **Web Frontend**: Giao diện `src/playground` được chuyển thành một dự án Next.js/React độc lập. Kết nối với AI Runtime Service thông qua API Gateway.
- **Storage/DB Service**: Thay thế hệ thống file phẳng (`00_raw` đến `07_runtime_personas`) bằng một Document Store có cấu trúc (ví dụ: MongoDB hoặc Postgres với JSONB) để lưu trữ persona và log hội thoại.

## Kế hoạch Xác minh (Verification Plan)

### Kiểm thử Tự động (Automated Tests)

- Chạy `run-phase8c.ts` (Harness đánh giá Gemma) đối với các trạng thái sắc thái mới để đo lường độ trễ, độ an toàn và tính chân thực.
- Triển khai unit test cho `batchProcessor.ts` để đảm bảo các chunk được lắp ráp và parse chính xác mà không bị mất dữ liệu.

### Xác minh Thủ công (Manual Verification)

- Xử lý một tập con nhỏ của dữ liệu tháng 3 bằng chiến lược chunking mới. Xác thực rằng các output xuất hiện trong đúng các thư mục tuần tự.
- Sử dụng playground local (`http://localhost:3009`) để giả lập một cuộc trò chuyện với các persona mới được tinh chỉnh, đặc biệt là kiểm thử kịch bản "chưa chắc chắn/lưỡng lự".
