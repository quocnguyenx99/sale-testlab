import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white shadow-subtle hover:bg-brand-hover active:scale-[0.98] disabled:bg-brand/50 disabled:cursor-not-allowed',
  secondary: 'border border-border bg-surface text-ink shadow-subtle hover:bg-surface-hover hover:border-border-strong active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  ghost: 'text-ink-secondary hover:bg-surface-subtle hover:text-ink active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed',
  danger: 'bg-red-600 text-white shadow-subtle hover:bg-red-700 active:scale-[0.98] disabled:bg-red-300 disabled:cursor-not-allowed',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-xs rounded-lg',
  md: 'min-h-10 px-4 py-2 text-sm rounded-xl',
  lg: 'min-h-11 px-5 py-2.5 text-sm rounded-xl',
}

export function Button({ className = '', variant = 'primary', size = 'md', icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 select-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
