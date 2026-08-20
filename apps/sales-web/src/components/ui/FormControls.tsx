import { ChevronDown, Search } from 'lucide-react'
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

const base =
  'w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted transition duration-150 hover:border-border-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-surface-subtle disabled:opacity-60'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${base} ${props.className ?? ''}`} {...props} />
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <Input {...props} className={`pl-10 ${props.className ?? ''}`} />
    </div>
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        className={`${base} appearance-none pr-9 cursor-pointer ${props.className ?? ''}`}
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  )
}
