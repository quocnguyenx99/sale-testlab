import { Inbox, LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-sm font-medium text-slate-500"><LoaderCircle className="h-6 w-6 animate-spin text-blue-600" /><span>{label}</span></div>
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-card border border-dashed border-slate-300 bg-white p-8 text-center"><Inbox className="mb-3 h-8 w-8 text-slate-400" /><h3 className="font-bold text-slate-800">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p></div>
}
