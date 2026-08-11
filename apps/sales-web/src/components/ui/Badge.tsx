import type { ReactNode } from 'react'
import type { Difficulty } from '../../types/training'

const difficultyStyle: Record<Difficulty, string> = {
  EASY: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  HARD: 'bg-rose-50 text-rose-700 ring-rose-600/15',
}

const labels: Record<Difficulty, string> = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' }

export function DifficultyBadge({ value }: { value: Difficulty }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${difficultyStyle[value]}`}>{labels[value]}</span>
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ${className}`}>{children}</span>
}
