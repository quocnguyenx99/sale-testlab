import { AlertCircle, Inbox, LoaderCircle, ShieldAlert } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'

export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200/75 motion-reduce:animate-none ${className}`}
      {...props}
    />
  )
}

export function InlineAlert({
  children,
  tone = 'danger',
}: {
  children: ReactNode
  tone?: 'danger' | 'info'
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-5 ${
        tone === 'danger'
          ? 'border-red-200 bg-danger-soft text-danger'
          : 'border-blue-200 bg-info-soft text-info'
      }`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function LoadingState({ label = 'Đang tải dữ liệu...' }: { label?: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-sm font-medium text-ink-secondary" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin text-brand motion-reduce:animate-none" aria-hidden="true" />
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
        <Inbox className="h-5 w-5" aria-hidden="true" />
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
    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-red-200 bg-danger-soft p-8 text-center" role="alert">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-danger">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-3 font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-[22px] text-ink-secondary">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ForbiddenState({ action }: { action?: ReactNode }) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center rounded-xl bg-surface p-6 text-center sm:p-10" aria-labelledby="forbidden-title">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-soft text-brand">
        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-xl font-bold leading-7 tracking-[-0.02em] text-ink" id="forbidden-title">Bạn không có quyền truy cập</h2>
      <p className="mt-1.5 max-w-md text-sm leading-[22px] text-ink-secondary">
        Tài khoản hiện tại không có quyền sử dụng chức năng này.
      </p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  )
}
