import { Search } from 'lucide-react'
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

const base = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${base} ${props.className ?? ''}`} {...props} />
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input {...props} className={`pl-10 ${props.className ?? ''}`} /></div>
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${base} appearance-none pr-9 ${props.className ?? ''}`} {...props} />
}
