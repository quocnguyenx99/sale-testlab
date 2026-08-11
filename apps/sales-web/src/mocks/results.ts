import type { RuntimeInsight, SessionResult } from '../types/training'

export const initialInsight: RuntimeInsight = {
  state: 'NEEDS_DISCOVERY',
  completedTopics: ['Sản phẩm', 'Số lượng'],
  missingTopics: ['Giá', 'Ngân sách', 'Giao hàng', 'Bảo hành', 'Thanh toán', 'Người quyết định', 'Thời điểm mua'],
  totalTopics: 9,
  dealState: 'IN_PROGRESS',
}

export function makeSessionResult(sessionId: string, turnCount: number): SessionResult {
  return {
    sessionId,
    outcome: 'CUSTOMER_INTERESTED',
    turnCount,
    durationLabel: '08 phút',
    completedTopics: ['Nhu cầu', 'Sản phẩm', 'Giá', 'Bảo hành'],
    missingTopics: ['Ngân sách', 'Giao hàng'],
    signals: ['Khách hàng quan tâm về giá', 'Có tín hiệu mua hàng'],
  }
}
