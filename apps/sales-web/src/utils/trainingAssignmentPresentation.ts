import type { TrainingAssignmentItemState, TrainingAssignmentState } from '../types/trainingAssignment'

export function assignmentStateLabel(state: TrainingAssignmentState): string {
  return { ASSIGNED: 'Đã giao', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' }[state]
}

export function assignmentStateClass(state: TrainingAssignmentState): string {
  if (state === 'COMPLETED') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (state === 'IN_PROGRESS') return 'border-blue-200 bg-blue-50 text-blue-800'
  if (state === 'CANCELLED') return 'border-slate-200 bg-slate-100 text-slate-700'
  return 'border-amber-200 bg-amber-50 text-amber-800'
}

export function assignmentItemStateLabel(state: TrainingAssignmentItemState): string {
  return { NOT_STARTED: 'Chưa bắt đầu', IN_PROGRESS: 'Đang luyện tập', COMPLETED: 'Hoàn thành' }[state]
}

export function formatAssignmentDate(value: string | null): string {
  if (!value) return 'Không có'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value))
}

export function trainingModeLabel(mode: 'SALE_FIRST' | 'CUSTOMER_FIRST'): string {
  return mode === 'SALE_FIRST' ? 'Bạn mở lời' : 'Khách hàng mở lời'
}
