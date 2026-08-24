import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Surface } from '../components/ui/Surface'

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center">
      <Surface className="max-w-md p-8 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand">404 · Không có đường dẫn</p>
        <h1 className="mt-2 text-[30px] font-bold leading-[38px] tracking-[-0.025em] text-ink">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm leading-[22px] text-ink-secondary">
          Đường dẫn bạn yêu cầu không tồn tại hoặc đã được thay đổi trong hệ thống.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition-colors duration-150 hover:bg-brand-hover active:bg-brand-pressed focus-visible:ring-2 focus-visible:ring-focus/35 focus-visible:ring-offset-2"
          to="/dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Về tổng quan
        </Link>
      </Surface>
    </main>
  )
}
