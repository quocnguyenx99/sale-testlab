import type { HTMLAttributes } from 'react'

type SurfaceTone = 'default' | 'subtle' | 'elevated'

const toneClasses: Record<SurfaceTone, string> = {
  default: 'bg-surface',
  subtle: 'bg-surface-subtle',
  elevated: 'bg-surface-elevated shadow-dropdown',
}

export function Surface({
  className = '',
  tone = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: SurfaceTone }) {
  return <div className={`rounded-xl ${toneClasses[tone]} ${className}`} {...props} />
}
