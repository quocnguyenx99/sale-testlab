import type { ProgressTrendState, TrainingMode } from '../types/training'

const trendLabels: Record<ProgressTrendState, string> = {
  NO_DATA: 'Chưa có dữ liệu',
  BASELINE_ONLY: 'Đã có điểm khởi đầu',
  LIMITED_DATA: 'Chưa đủ dữ liệu để xác định xu hướng',
  IMPROVING: 'Đang cải thiện',
  STABLE: 'Tương đối ổn định',
  DECLINING: 'Có xu hướng giảm',
}

export function labelProgressTrend(state: ProgressTrendState): string {
  return trendLabels[state]
}

export function formatProgressScore(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return 'Chưa có dữ liệu'
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(score)
}

export function formatProgressDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa rõ thời điểm'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function labelProgressMode(mode: TrainingMode): string {
  return mode === 'CUSTOMER_FIRST' ? 'Khách hàng mở lời' : 'Bạn mở lời'
}

export function progressResultPath(sessionId: string): string {
  return `/practice/${encodeURIComponent(sessionId)}/result`
}

export function isLowDataTrend(state: ProgressTrendState): boolean {
  return state === 'NO_DATA' || state === 'BASELINE_ONLY' || state === 'LIMITED_DATA'
}
