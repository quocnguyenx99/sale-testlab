import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export function LoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-sm font-medium text-ink-secondary">
      <LoaderCircle className="h-5 w-5 animate-spin text-brand" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-8 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-subtle text-ink-muted">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-secondary">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Không thể tải dữ liệu',
  description = 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 p-8 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-semibold text-red-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-red-700">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
