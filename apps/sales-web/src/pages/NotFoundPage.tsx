import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center">
      <Card className="max-w-md p-8 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
          Đường dẫn bạn yêu cầu không tồn tại hoặc đã được thay đổi trong hệ thống.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-subtle hover:bg-brand-hover active:scale-[0.98] transition duration-150"
          to="/dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Về tổng quan
        </Link>
      </Card>
    </main>
  )
}
