import { Sparkles } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm"><Sparkles className="h-5 w-5" /></div>{!compact && <div><div className="font-extrabold leading-tight text-slate-900">AI Sales TestLab</div><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">Practice smarter</div></div>}</div>
}
