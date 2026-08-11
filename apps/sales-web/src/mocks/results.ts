import type { RuntimeInsight, SessionResult } from '../types/training'

export const initialInsight: RuntimeInsight = {
  runtimeState: 'discovery',
  resolvedTopics: ['product_model'],
  missingTopics: ['Giá', 'Ngân sách', 'Giao hàng', 'Bảo hành', 'Thanh toán', 'Người quyết định', 'Thời điểm mua'],
  nextUnresolvedTopic: 'configuration',
  dealOutcome: 'not_ready',
  trainingStatus: 'in_progress',
  topicProgress: { resolved: 1, total: 9 },
  activeProduct: null,
}

export function makeSessionResult(sessionId: string, turnCount: number): SessionResult {
  return {
    outcome: sessionId ? 'customer_interested' : 'not_ready',
    trainingStatus: 'in_progress',
    turnCount,
    durationSeconds: 480,
    resolvedTopics: ['Nhu cầu', 'Sản phẩm', 'Giá', 'Bảo hành'],
    missingTopics: ['Ngân sách', 'Giao hàng'],
    signals: ['Khách hàng quan tâm về giá', 'Có tín hiệu mua hàng'],
  }
}
