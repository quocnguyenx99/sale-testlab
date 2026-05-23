# Kế hoạch triển khai Phase 12G-lite

Kế hoạch này tập trung vào việc nâng cao tính tự nhiên, đồng nhất phong cách/giọng điệu (persona) và tăng độ mượt mà của luồng hội thoại cho **Khách hàng AI (Customer AI)** mà vẫn giữ nguyên các chốt chặn nghiêm ngặt về tiến độ (progress), điều kiện hoàn thành (completion) và chống đổi vai (role-drift) đã xây dựng ở các giai đoạn trước.

## Các điểm quan trọng cần review

> [!IMPORTANT]
>
> - Chúng ta **không nới lỏng bất kỳ chốt chặn an toàn nào** (tránh lặp chủ đề, tránh chốt sớm, chống đổi vai). Tất cả các fallback logic cứng vẫn hoạt động 100%, nhưng chúng ta sẽ điều chỉnh câu lệnh (prompt) mềm mỏng hơn để LLM có thể phản hồi tự nhiên, biết ghi nhận (acknowledgment) câu trả lời của Sale thay vì chỉ hỏi dồn dập như máy.
> - Bổ sung một **bộ phân nhóm hành vi người mua siêu nhẹ** (`price_sensitive` - nhạy cảm giá, `corporate_buyer` - mua cho doanh nghiệp, `reseller` - đại lý, `internal_it` - kỹ thuật nội bộ, `hesitant_buyer` - mua hàng lưỡng lự, `urgent_buyer` - mua gấp) dựa trên bối cảnh hiện có của Persona để đa dạng hóa câu mở đầu và các câu hỏi fallback.
> - Triển khai một **bộ lọc chống placeholder cực kỳ nghiêm ngặt** cho câu mở đầu của khách. Nếu phát hiện các ký tự lỗi như `[tên model A]`, `[model]`, `{model}`, `undefined`, `null`, hệ thống sẽ tự động chuyển sang câu hỏi mở đầu tự nhiên dựa trên nhu cầu thực tế (need-based opening) tương ứng với từng danh mục sản phẩm và nhóm hành vi của persona đó.

## Các thay đổi đề xuất

Các tệp được thay đổi được chia làm 2 phần chính: **Cơ chế Runtime** và **Playground Server**.

---

### Thành phần Runtime

#### [MODIFY] [conversationIdentity.ts](file:///d:/Workspace/sale-testlab-data-pipeline/src/runtime/conversationIdentity.ts)

- **Suy luận xưng hô khi Sale chủ động nhắn trước**:
  - Nâng cấp `buildIdentityProfileFromSaleOpening` để tự động suy luận xưng hô chính xác khi Sale mở lời đầu tiên.
  - Ví dụ:
    - `"em chào chị"`, `"em gửi chị báo giá"` $\rightarrow$ `customer_self_pronoun = "chị"`, `customer_target_pronoun = "em"`.
    - `"em chào anh"`, `"dạ bên em còn hàng anh"` $\rightarrow$ `customer_self_pronoun = "anh"`, `customer_target_pronoun = "em"`.
- **Bộ lọc kiểm soát giọng khách hàng (Customer Voice Guard)**:
  - Định nghĩa hàm `runCustomerVoiceGuard(reply, identity)` để phát hiện các câu nói có văn phong hỗ trợ/sale (ví dụ: _"tôi có thể hỗ trợ bạn"_, _"bên em hỗ trợ"_,...).
  - Phát hiện trường hợp khách tự xưng là `"anh/chị"` nhưng lại dùng đuôi `"ạ"` không tự nhiên khi trả lời Sale (ví dụ: _"chị đang tìm máy tính xách tay ạ"_, _"anh muốn xem mẫu này ạ"_ - đây là câu của Sale hỏi khách, không phải của khách nói).
  - Định nghĩa hàm `rewriteVoiceDrift(reply, identity)` để tự động viết lại các câu bị dính lỗi đuôi `"ạ"` thành câu nói tự nhiên của khách hàng thực tế (vẫn giữ nguyên ngữ cảnh sản phẩm).

#### [MODIFY] [customerOpeningBuilder.ts](file:///d:/Workspace/sale-testlab-data-pipeline/src/runtime/customerOpeningBuilder.ts)

- **Triệt tiêu Placeholder & Mở đầu tự nhiên**:
  - Bổ sung hàm kiểm tra placeholder cực kỳ chi tiết `hasPlaceholder` (quét toàn bộ các chuỗi dạng `[...]`, `{...}`, `undefined`, `null`, `placeholder`).
  - Định nghĩa bộ template mở đầu tự nhiên không model `VOICE_OPENINGS` được ánh xạ theo danh mục sản phẩm (Laptop, Desktop, Máy in, Máy chủ,...) và nhóm hành vi của Persona.
  - Nếu phát hiện placeholder trong câu mở đầu được sinh ra, hệ thống tự động đổi sang câu mở đầu tự nhiên, render chuẩn xác theo xưng hô đã lock.

#### [MODIFY] [repetitionGuard.ts](file:///d:/Workspace/sale-testlab-data-pipeline/src/runtime/repetitionGuard.ts)

- **Làm mềm câu lệnh tiến trình**:
  - Điều chỉnh hàm `buildProgressionInstruction` để hướng dẫn mô hình rằng chủ đề kế tiếp `next_unresolved_topic` là hướng đi khuyên dùng, không bắt buộc phải hỏi dồn dập ở mọi lượt.
  - Cho phép khách phản hồi tự nhiên bằng cách ghi nhận ngắn gọn câu trả lời của Sale, bày tỏ sự ngần ngại hoặc hỏi sâu hơn về bối cảnh trước khi chuyển chủ đề.

#### [MODIFY] [runtimePromptBuilder.ts](file:///d:/Workspace/sale-testlab-data-pipeline/src/runtime/runtimePromptBuilder.ts)

- **Tinh chỉnh prompt**:
  - Làm mềm các câu lệnh ràng buộc tiến trình để Khách AI tương tác mượt mà hơn, giảm cảm giác đi checklist từng bước nhưng vẫn tuyệt đối cấm hỏi lại các chủ đề đã trả lời xong (`blocked_topics`).

#### [MODIFY] [responseBank.ts](file:///d:/Workspace/sale-testlab-data-pipeline/src/runtime/responseBank.ts)

- **Phân nhóm hành vi siêu nhẹ**:
  - Triển khai hàm `inferVoiceGroup(persona)` dựa trên chức vụ, bối cảnh mua và quy tắc hành vi của Persona.
  - Tích hợp nhóm hành vi vào `buildResponseBankReply` để biến đổi linh hoạt các câu trả lời fallback theo nhóm (ví dụ: khách doanh nghiệp cần hóa đơn VAT trình duyệt, khách nhạy cảm giá muốn chiết khấu tốt nhất, khách mua gấp muốn giữ hàng ngay).

---

### Playground Server

#### [MODIFY] [server.ts](file:///d:/Workspace/sale-testlab-data-pipeline/src/playground/server.ts)

- **Đồng bộ hóa Xưng hô khi bắt đầu**:
  - Trong `handleChatEnriched`, phát hiện chính xác nếu session là lượt đầu tiên được Sale nhắn trước, thiết lập `saleOpeningIdentityDetected`.
  - Nếu persona không có cấu hình xưng hô cụ thể, sử dụng suy luận từ câu chào của Sale làm fallback.
- **Render lời chào tự nhiên theo xưng hô**:
  - Thay vì hardcode lời chào mặc định _"Chào bạn, mình..."_ khi Sale chỉ chào xã giao (`greetingOnly`), hệ thống sẽ render câu chào tương ứng chuẩn chỉnh theo xưng hô được lock (ví dụ: _"Chị chào em,..."_, _"Anh chào em,..."_).
- **Tích hợp bộ lọc Voice Guard**:
  - Chạy kiểm tra `CustomerVoiceGuard` cho các câu trả lời. Nếu phát hiện trôi giọng (drift), tự động gọi `rewriteVoiceDrift` hoặc chọn câu trả lời tự nhiên phù hợp từ response bank.
  - Trả về `customer_voice_drift_detected` và `customer_voice_guard_reason` trong metadata kỹ thuật JSON để theo dõi trực quan trên giao diện kiểm thử.

---

### Kiểm thử hồi quy (Regression Tests)

#### [NEW] [phase12g_lite.regression.test.ts](file:///d:/Workspace/sale-testlab-data-pipeline/src/runtime/phase12g_lite.regression.test.ts)

Tạo file test mới bao gồm các test case cho tất cả yêu cầu của Phase:

1. **Sale-start identity**: Sale chào `"em chào chị"`. Đảm bảo xưng hô được khóa là `chị` - `em` và khách không trả lời kiểu `"Em chào em"`.
2. **Opening placeholder**: Trường hợp thiếu model sản phẩm. Đảm bảo câu mở đầu tự nhiên, không chứa ký tự placeholder hay `undefined/null`.
3. **Voice guard**: Kiểm thử câu nói lỗi `"chị đang tìm máy tính xách tay ạ"`. Đảm bảo hệ thống phát hiện trôi giọng và viết lại thành công câu nói tự nhiên.
4. **Không hồi quy**: Đảm bảo các chủ đề đã trả lời vẫn bị chặn hỏi lại, chốt chặn hoàn thành hoạt động tốt, và persona nữ vẫn tự xưng `chị/em`.

---

## Kế hoạch nghiệm thu (Verification Plan)

### Chạy kiểm thử tự động

Chạy toàn bộ các bài test hồi quy hiện có và bài test mới:

```bash
npm run test:phase12cd
npm run test:phase12e
npx tsx src/runtime/phase12e1.regression.test.ts
npm run test:phase12f
npx tsx src/runtime/phase12f2.regression.test.ts
npx tsx src/runtime/phase12f2.null-guard.regression.test.ts
npx tsx src/runtime/phase12g_lite.regression.test.ts
```

### Chạy giao diện thủ công (Playground)

Sau khi toàn bộ test tự động vượt qua (PASS), chúng tôi khuyên bạn nên mở playground:

```bash
npm run playground
```

Và trực tiếp trao đổi thử nghiệm để cảm nhận giọng điệu tự nhiên, mượt mà hơn của Khách hàng AI!
