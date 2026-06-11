# Report 05: Runtime Health and Live QA

Báo cáo này đánh giá sức khỏe của môi trường chạy giả lập (runtime) hiện tại, các số liệu Live QA mới nhất và tính ổn định của hệ thống trước khi thực hiện import dữ liệu lớn.

## 1. Trạng thái các Cổng kiểm soát (Gating Status)

Theo thỏa thuận tại **Runtime Contract - Phase 12H**:
- **Safety Gate 12H.1**: ĐÃ CHẤP NHẬN và ĐÓNG BĂNG.
  - Các luật cấm fake price negotiation, cấm chốt đơn khi sản phẩm mơ hồ, cấm lộ số lượng kho thô (`slctx`), và cấm lật vai (role inversion) đều đang hoạt động tốt.
- **Style Gate 12H.3-A (Buyer Voice Style)**: ĐÃ CHẤP NHẬN và ĐÓNG BĂNG.
  - Các kiểm soát về giọng điệu khách hàng mua sỉ thực tế, không dùng kính ngữ quá trang trọng kiểu CSKH, được áp dụng làm soft gate.

## 2. Số liệu Live QA mới nhất (Cập nhật 10/06/2026)

Dựa trên kết quả chạy Live QA tự động mới nhất được ghi nhận tại [live_qa_summary.json](file:///d:/Workspace/sale-testlab-data-pipeline/logs/live_qa_summary.json) (Thời gian chạy: 10/06/2026 09:31:02 GMT+7):

| Chỉ số | Giá trị thực tế | Trạng thái | Ghi chú |
|---|---|---|---|
| **critical_fail_count** | **0** | **PASS** | Không phát hiện lỗi nghiêm trọng (safety/ pronoun drift) nào trong 12 test cases. |
| **fallback_rate** | **0.0%** | **PASS** | Không có case nào phải chuyển sang fallback cứng toàn bộ câu. |
| **exact_template_usage_count** | **0** | **PASS** | Không dùng template cứng nào cho phản hồi thông thường. |
| **forced_completion_rate** | **0.0%** | **PASS** | Không bị kết thúc đơn cưỡng bức sai lệch. |
| **average_buyer_voice_score** | **97.0 / 100** | **PASS** | Điểm số giọng điệu người mua rất cao. |
| **sale_tone_high_count** | **1** | **PASS** | Chỉ có 1 trường hợp (C4) bị đánh giá có chút âm hưởng CSKH nhưng nằm trong ngưỡng soft finding được chấp nhận. |
| **local_ai_generated_untouched_rate**| **75.0%** | *Observation*| Tỷ lệ phản hồi trực tiếp từ Qwen3 không qua chỉnh sửa. |
| **local_ai_rewritten_rate** | **25.0%** | *Observation*| Tỷ lệ phản hồi được chỉnh sửa tối thiểu (pronoun/ending) bởi lớp guard. |
| **effective_ai_response_rate** | **100.0%** | **PASS** | Tổng tỷ lệ sinh bởi AI (gồm nguyên bản + sửa lỗi tối thiểu). |

## 3. Đánh giá độ ổn định của Runtime

- **Độ tin cậy của mô hình**: Qwen3:8B local tạo ra các phản hồi rất tự nhiên.
- **Vai trò của lớp Guard**: Hoạt động hiệu quả, chỉ can thiệp sửa đổi pronoun/hậu tố khi phát hiện lệch pronoun nhẹ (như sửa hậu tố `ạ` thành `nhé` ở case A4, B1, C1), giúp giữ lại tối đa câu sinh ra từ AI gốc mà vẫn đảm bảo tính nhất quán danh tính (`Anh/Chị` xưng với `Em`).
- **Kết luận**: Phiên bản Runtime hiện tại đạt độ ổn định tuyệt đối và hoàn toàn đủ điều kiện làm baseline đóng băng để bắt đầu Phase 12H.3-B. Không cần thực hiện bất kỳ thay đổi logic runtime hay cấu hình prompt nào trước khi tiến hành import dữ liệu.
