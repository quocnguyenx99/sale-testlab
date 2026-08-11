import type { ChatMessage, TrainingMode } from '../types/training'

export function initialMessages(mode: TrainingMode): ChatMessage[] {
  if (mode === 'SALE_FIRST') return []
  return [{
    id: 'opening-message',
    sender: 'CUSTOMER',
    content: 'Chào bạn, bên tôi đang cần trang bị khoảng 50 laptop cho đội phát triển. Tôi muốn tìm hiểu một phương án đủ mạnh nhưng vẫn hợp lý về chi phí.',
    createdAt: new Date().toISOString(),
  }]
}

export function mockCustomerReply(message: string, order: number): string {
  const normalized = message.toLocaleLowerCase('vi')
  if (/giá|chi phí|ngân sách|bao nhiêu/.test(normalized)) {
    return 'Mức giá đó áp dụng cho cấu hình nào? Nếu lấy 50 máy thì bên bạn có chính sách tốt hơn không?'
  }
  if (/bảo hành|đổi trả|hỗ trợ/.test(normalized)) {
    return 'Tôi quan tâm nhất là thời gian xử lý bảo hành. Đội kỹ thuật không thể chờ máy quá lâu khi có sự cố.'
  }
  if (/giao|thời gian|tiến độ|khi nào/.test(normalized)) {
    return 'Bên tôi cần nhận đủ máy trong tháng này. Bạn có thể cam kết tiến độ và phương án nếu giao trễ không?'
  }
  const replies = [
    'Bạn có thể nói rõ hơn vì sao giải pháp này phù hợp với đội phát triển của chúng tôi không?',
    'Tôi hiểu. Nhưng ngoài cấu hình, bên bạn có điểm gì khác biệt so với các lựa chọn chúng tôi đang cân nhắc?',
    'Thông tin đó khá hữu ích. Tôi cần thêm một phương án cụ thể để có thể trao đổi với bộ phận mua hàng.',
  ]
  return replies[order % replies.length]
}
