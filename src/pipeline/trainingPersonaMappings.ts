export const behaviorRulesMap: Record<string, string> = {
  price_sensitive_research_behavior: "Ưu tiên hỏi giá hoặc yêu cầu báo giá trước khi đi vào chi tiết.",
  repeated_product_comparison_behavior: "Có xu hướng so sánh nhiều model khác nhau trước khi chốt.",
  logistics_followup_tendency: "Thường hỏi thêm thông tin về thời gian giao hàng sau khi đã có giá.",
  high_frequency_operational_coordination: "Nhắn tin liên tục và kỳ vọng phản hồi nhanh về mặt vận hành.",
  operational_payment_followup_behavior: "Thường xuyên theo dõi và hỏi về tiến độ thanh toán, hóa đơn chứng từ.",
  short_operational_response_style: "Phản hồi ngắn gọn, đi thẳng vào vấn đề chính, không thích giải thích dài dòng.",
  detailed_product_inquiry_behavior: "Hỏi rất kỹ về cấu hình, thông số kỹ thuật trước khi hỏi giá.",
  document_request_pattern: "Yêu cầu cung cấp rõ ràng giấy tờ, chứng từ, hóa đơn trước khi thanh toán.",
  bulk_purchase_pattern: "Thể hiện ý định mua số lượng lớn hoặc hỏi chính sách cho khách sỉ.",
  repeated_price_inquiry_behavior: "Chỉ tập trung hỏi giá, nếu giá không tốt sẽ dễ dàng rời đi.",
  repeated_stock_check_pattern: "Liên tục hỏi xác nhận số lượng tồn kho trước khi quyết định.",
  fallback_rule: "Phản hồi dựa trên thông tin nhận được mà không thể hiện thái độ quá rõ rệt."
};

export const openingMessagesMap: Record<string, string[]> = {
  price_sensitive_research_behavior: [
    "Dạ mẫu này bên mình rổ giá sao ạ?",
    "Cho mình xin báo giá mã này với.",
    "Giá bên mình đang bán thế nào em?"
  ],
  repeated_product_comparison_behavior: [
    "Anh đang phân vân mẫu này với mẫu kia, em tư vấn giúp.",
    "2 mã này khác nhau chỗ nào em nhỉ?",
    "Cho anh xin thông số để so sánh thử nha."
  ],
  logistics_followup_tendency: [
    "Hàng này thì bao lâu nhận được em?",
    "Ship về bên anh thì mất mấy ngày?",
    "Có giao luôn trong hôm nay được không shop?"
  ],
  operational_payment_followup_behavior: [
    "Bên mình chuyển khoản hay thanh toán sao em?",
    "Mình xin số tài khoản công ty bên bạn nhé.",
    "Xuất VAT đầy đủ không em?"
  ],
  detailed_product_inquiry_behavior: [
    "Cho mình xin thông số chi tiết mã này.",
    "Mã này bảo hành bao lâu vậy?",
    "Hàng này của hãng nào, dùng ổn không em?"
  ],
  repeated_stock_check_pattern: [
    "Mã này bên mình còn sẵn hàng không?",
    "Còn màu này không em?",
    "Số lượng 5 cái thì còn sẵn không ạ?"
  ],
  bulk_purchase_pattern: [
    "Bên mình có chính sách cho đại lý không?",
    "Mình lấy số lượng thì giá sao em?",
    "Báo giá nét cho mình lô này nhé."
  ],
  fallback: [
    "Em ơi, bên mình còn mẫu này không?",
    "Cho mình hỏi thêm thông tin sản phẩm này với.",
    "Shop tư vấn giúp mình nhé."
  ]
};

export const likelyQuestionsMap: Record<string, string[]> = {
  price_sensitive_research_behavior: ["Giá này có bớt được nữa không?", "Có chương trình km gì không?"],
  logistics_followup_tendency: ["Giao qua đơn vị nào vậy?", "Phí ship bao nhiêu em?"],
  operational_payment_followup_behavior: ["Thanh toán khi nhận hàng được không?", "Công nợ bao nhiêu ngày?"],
  repeated_stock_check_pattern: ["Bao giờ thì có hàng lại?", "Kho nào đang sẵn hàng?"],
  detailed_product_inquiry_behavior: ["Có sẵn phụ kiện thay thế không?", "Hàng mới hay hàng lướt?"],
  fallback: ["Bước tiếp theo như nào em?", "Cho anh xin thêm thông tin."]
};

export const objectionPatternsMap: Record<string, string[]> = {
  price_sensitive_research_behavior: ["Giá bên em hơi cao so với bên kia.", "Để anh xem lại ngân sách đã."],
  logistics_followup_tendency: ["Giao hơi lâu nhỉ.", "Phí ship hơi cao."],
  operational_payment_followup_behavior: ["Bên anh chỉ thanh toán qua công ty.", "Thủ tục thanh toán bên em rườm rà thế."],
  repeated_product_comparison_behavior: ["Mẫu kia cấu hình ngon hơn.", "Để anh cân nhắc thêm mấy mã khác."],
  fallback: ["Để anh suy nghĩ thêm nhé.", "Anh chưa cần gấp."]
};

export const closingConditionsMap: Record<string, string[]> = {
  sales_context: [
    "Sale xác nhận đúng model hoặc nhu cầu cụ thể.",
    "Sale báo giá rõ ràng."
  ],
  logistics_context: [
    "Sale xác nhận được tồn kho.",
    "Sale chốt được thời gian và phương thức giao hàng."
  ],
  payment_context: [
    "Sale làm rõ thủ tục hóa đơn chứng từ.",
    "Sale xác nhận thông tin thanh toán thành công."
  ],
  fallback: [
    "Sale đưa ra bước hành động tiếp theo cụ thể."
  ]
};

export const trainingFocusMap: Record<string, string[]> = {
  sales_context: [
    "xác nhận nhu cầu",
    "báo giá rõ",
    "tư vấn model",
    "xử lý từ chối giá"
  ],
  logistics_context: [
    "xác nhận tồn kho",
    "chốt thời gian giao",
    "xử lý giao hàng"
  ],
  payment_context: [
    "follow-up thanh toán",
    "cung cấp chứng từ nhanh chóng"
  ],
  fallback: [
    "duy trì hội thoại",
    "chốt bước tiếp theo"
  ]
};
