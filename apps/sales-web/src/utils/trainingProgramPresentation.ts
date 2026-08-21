import type { TrainingProgramStatus } from '../types/trainingProgram'

export function trainingProgramStatusLabel(status: TrainingProgramStatus): string {
  return status === 'DRAFT' ? 'Bản nháp' : status === 'PUBLISHED' ? 'Đã xuất bản' : 'Đã lưu trữ'
}

export function trainingProgramStatusClass(status: TrainingProgramStatus): string {
  if (status === 'DRAFT') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (status === 'PUBLISHED') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

export function isTrainingProgramEditable(status: TrainingProgramStatus): boolean {
  return status === 'DRAFT'
}

export function formatTrainingProgramDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
