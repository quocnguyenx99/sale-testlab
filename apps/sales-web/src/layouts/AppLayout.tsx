import { BarChart3, History, Home, Library, LogOut, Menu, MessageSquareText, Sparkles, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { Brand } from '../components/common/Brand'

const navItems = [
  { to: '/dashboard', label: 'Trang chủ', icon: Home },
  { to: '/customers', label: 'Khách hàng AI', icon: Library },
  { to: '/practice/new', label: 'Luyện tập 1vs1', icon: MessageSquareText },
  { to: '/progress', label: 'Tiến độ luyện tập', icon: BarChart3 },
  { to: '/history', label: 'Lịch sử luyện tập', icon: History },
]

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => { await logout(); navigate('/login') }
  const nav = <>
    <div className="flex h-20 items-center justify-between px-5"><Brand /><button aria-label="Đóng menu" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
    <nav aria-label="Điều hướng chính" className="mt-3 space-y-1 px-3">{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-5 w-5" />{label}</NavLink>)}</nav>
    <div className="mx-4 mt-8 rounded-2xl bg-slate-950 p-4 text-white"><div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-blue-600"><Sparkles className="h-4 w-4" /></div><p className="text-sm font-bold">Luyện tập tập trung</p><p className="mt-1 text-xs leading-5 text-slate-400">Một phiên 1vs1 ngắn mỗi ngày giúp bạn làm chủ tình huống.</p></div>
    <div className="absolute inset-x-0 bottom-0 border-t border-slate-100 p-4"><div className="flex items-center gap-3 rounded-xl p-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"><UserRound className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{user?.displayName}</p><p className="truncate text-xs text-slate-500">{user?.email}</p></div><button aria-label="Đăng xuất" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => void signOut()}><LogOut className="h-4 w-4" /></button></div></div>
  </>

  return <div className="min-h-screen bg-canvas"><aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">{nav}</aside>{open && <><button aria-label="Đóng menu" className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} /><aside className="fixed inset-y-0 left-0 z-50 w-[280px] bg-white shadow-float">{nav}</aside></>}<div className="lg:pl-64"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:hidden"><Brand compact /><button aria-label="Mở menu" className="rounded-xl border border-slate-200 p-2.5 text-slate-700" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button></header><main className="mx-auto min-h-screen max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10"><Outlet /></main></div></div>
}
