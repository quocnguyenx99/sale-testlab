import type { ReactNode } from 'react'
import type { Difficulty } from '../../types/training'

export type StatusBadgeTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'

const statusTone: Record<StatusBadgeTone, string> = {
  neutral: 'border-border bg-surface-subtle text-ink-secondary',
  brand: 'border-brand-border bg-brand-soft text-brand-hover',
  info: 'border-blue-200 bg-info-soft text-info',
  success: 'border-emerald-200 bg-success-soft text-success',
  warning: 'border-amber-200 bg-warning-soft text-warning',
  danger: 'border-red-200 bg-danger-soft text-danger',
}

const difficultyStyle: Record<Difficulty, string> = {
  EASY: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200/60',
  HARD: 'bg-rose-50 text-rose-700 border-rose-200/60',
}

const labels: Record<Difficulty, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
}

export function DifficultyBadge({ value }: { value: Difficulty }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${difficultyStyle[value]}`}>
      {labels[value]}
    </span>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border border-border bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink-secondary ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: StatusBadgeTone
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold leading-[18px] ${statusTone[tone]} ${className}`}>
      {children}
    </span>
  )
}
