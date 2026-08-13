import type { TrainingMode } from '../types/training'

const topicLabels: Record<string, string> = {
  product_model: 'Sản phẩm',
  configuration: 'Cấu hình',
  price: 'Giá',
  stock: 'Khả năng đáp ứng',
  delivery: 'Giao hàng',
  warranty: 'Bảo hành',
  payment: 'Thanh toán',
  invoice_or_document: 'Hóa đơn / tài liệu',
  next_step: 'Bước tiếp theo',
}

const outcomeLabels: Record<string, string> = {
  not_ready: 'Đang khám phá nhu cầu',
  quote_requested: 'Khách hàng yêu cầu báo giá',
  ready_to_close: 'Sẵn sàng chốt bước tiếp theo',
  payment_info_requested: 'Khách hàng hỏi thanh toán',
  hold_requested: 'Khách hàng muốn giữ hàng',
  customer_committed: 'Khách hàng đã cam kết',
  pending_approval: 'Đang chờ phê duyệt',
  pending_payment: 'Đang chờ thanh toán',
  closed_won_simulated: 'Chốt thành công mô phỏng',
  closed_lost: 'Chưa đạt thỏa thuận',
  stalled: 'Hội thoại chưa tiến triển',
}

const trainingStatusLabels: Record<string, string> = {
  in_progress: 'Đang luyện tập',
  completed: 'Đã hoàn thành',
  success: 'Đã đạt mục tiêu hội thoại',
  needs_follow_up: 'Cần trao đổi thêm',
}

const stateLabels: Record<string, string> = {
  greeting: 'Mở đầu hội thoại',
  discovery: 'Đang khám phá nhu cầu',
  discovery_phase: 'Đang khám phá nhu cầu',
  product_discussion: 'Trao đổi sản phẩm',
  pricing_phase: 'Thảo luận về giá',
  objection_handling: 'Xử lý băn khoăn',
  logistics_phase: 'Trao đổi giao nhận',
  closing_phase: 'Đang chốt bước tiếp theo',
  auto_state: 'Đang xác định ngữ cảnh',
}

const signalLabels: Record<string, string> = {
  quote_request_signal: 'Yêu cầu báo giá',
  payment_request_signal: 'Yêu cầu thông tin thanh toán',
  purchase_intent_signal: 'Tín hiệu mua hàng',
  hold_request_signal: 'Yêu cầu giữ hàng',
  invoice_request_signal: 'Yêu cầu hóa đơn',
}

const readable = (value: string) => value.replaceAll('_', ' ')

export const labelMode = (mode: TrainingMode) => mode === 'CUSTOMER_FIRST' ? 'Khách hàng mở lời' : 'Bạn mở lời'
export const labelTopic = (value: string) => topicLabels[value] ?? readable(value)
export const labelOutcome = (value: string) => outcomeLabels[value] ?? readable(value)
export const labelTrainingStatus = (value: string) => trainingStatusLabels[value] ?? readable(value)
export const labelCustomerState = (value: string) => stateLabels[value] ?? readable(value)
export const labelSignal = (value: string) => signalLabels[value] ?? readable(value)
