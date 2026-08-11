import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <main className="grid min-h-screen place-items-center bg-canvas p-6 text-center"><div><p className="text-sm font-extrabold uppercase tracking-[0.2em] text-blue-600">404</p><h1 className="mt-3 text-3xl font-extrabold text-slate-950">Không tìm thấy trang</h1><p className="mt-2 text-slate-500">Đường dẫn này chưa tồn tại trong phiên bản thử nghiệm.</p><Link className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white" to="/dashboard"><ArrowLeft className="h-4 w-4" />Về trang chủ</Link></div></main>
}
