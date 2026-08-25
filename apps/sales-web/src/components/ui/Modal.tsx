import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useFocusTrap } from './useFocusTrap'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useId()
  const dialogRef = useFocusTrap<HTMLDivElement>(open, onClose)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[90dvh] w-full overflow-auto rounded-t-2xl bg-surface shadow-dialog sm:max-w-lg sm:rounded-2xl"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-ink" id={titleId}>{title}</h2>
          <button
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-focus/30"
            data-autofocus
            onClick={onClose}
            type="button"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2.5 border-t border-border bg-surface-subtle/50 px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
