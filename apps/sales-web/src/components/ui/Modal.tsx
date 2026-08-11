import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open])
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="max-h-[90vh] w-full overflow-auto rounded-t-3xl bg-white shadow-float sm:max-w-lg sm:rounded-3xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-extrabold text-slate-900">{title}</h2><button aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}><X className="h-5 w-5" /></button></div>
      <div className="p-6">{children}</div>{footer && <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">{footer}</div>}
    </div>
  </div>
}
