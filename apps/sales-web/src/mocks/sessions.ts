import type { RecentSession, TrainingScenario } from '../types/training'

export const assignedScenario: TrainingScenario = {
  id: 'laptop-dev-team',
  title: 'Mua 50 laptop cho đội ngũ phát triển',
  description: 'Tư vấn giải pháp thiết bị phù hợp cho đội kỹ thuật đang mở rộng, với yêu cầu rõ về hiệu năng, ngân sách và tiến độ.',
  difficulty: 'MEDIUM',
}

export const recentSessions: RecentSession[] = [
  { id: 'recent-1', customer: 'Chị Linh', role: 'Trưởng phòng mua hàng', scenario: 'Gia hạn thiết bị văn phòng', dateLabel: 'Hôm qua, 15:20', outcomeLabel: 'Đang cân nhắc', status: 'COMPLETED' },
  { id: 'recent-2', customer: 'Anh Huy', role: 'Chủ doanh nghiệp', scenario: 'Nâng cấp laptop cho đội Sale', dateLabel: '08/08, 10:05', outcomeLabel: 'Quan tâm', status: 'COMPLETED' },
  { id: 'recent-3', customer: 'Chị Mai', role: 'Giám đốc vận hành', scenario: 'Thiết bị cho chi nhánh mới', dateLabel: '06/08, 09:30', outcomeLabel: 'Cần thêm thông tin', status: 'COMPLETED' },
]
