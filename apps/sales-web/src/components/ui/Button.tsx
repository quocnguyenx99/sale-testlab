import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover active:translate-y-px active:bg-brand-pressed disabled:cursor-not-allowed disabled:bg-brand/45',
  secondary: 'border border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-subtle active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
  ghost: 'text-ink-secondary hover:bg-surface-subtle hover:text-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40',
  danger: 'bg-danger text-white hover:bg-red-700 active:translate-y-px disabled:cursor-not-allowed disabled:bg-danger/40',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 rounded-lg px-3 py-1.5 text-xs',
  md: 'min-h-10 rounded-lg px-4 py-2 text-sm',
  lg: 'min-h-11 rounded-lg px-5 py-2.5 text-sm',
}

export function Button({ className = '', variant = 'primary', size = 'md', icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex select-none items-center justify-center gap-2 font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-focus/35 focus-visible:ring-offset-2 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
