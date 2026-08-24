import {
  BarChart3,
  History,
  Home,
  Library,
  LogOut,
  Menu,
  MessageSquareText,
  BookOpenCheck,
  ClipboardList,
  ListChecks,
  UserRound,
  UsersRound,
  PanelsTopLeft,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { userRoleLabel, type UiCapability, type UserRole } from '../app/authorizationPolicy'
import { isNavigationItemVisible } from '../app/navigationPolicy'
import { Brand } from '../components/common/Brand'

type NavItem = { to: string; label: string; icon: LucideIcon; requiredCapability?: UiCapability; roles?: readonly UserRole[] }

const navItems: ReadonlyArray<NavItem> = [
  { to: '/dashboard', label: 'Tổng quan', icon: Home, requiredCapability: 'USE_OWN_TRAINING' },
  { to: '/customers', label: 'Khách hàng AI', icon: Library, requiredCapability: 'USE_OWN_TRAINING' },
  { to: '/practice/new', label: 'Luyện tập', icon: MessageSquareText, requiredCapability: 'USE_OWN_TRAINING' },
  { to: '/history', label: 'Lịch sử', icon: History, requiredCapability: 'USE_OWN_TRAINING' },
  { to: '/progress', label: 'Tiến độ', icon: BarChart3, requiredCapability: 'USE_OWN_TRAINING' },
  { to: '/training-programs', label: 'Chương trình đào tạo', icon: BookOpenCheck, requiredCapability: 'MANAGE_TRAINING_PROGRAMS' },
  { to: '/training-assignments', label: 'Phân công đào tạo', icon: ClipboardList, requiredCapability: 'ASSIGN_TRAINING' },
  { to: '/manage/personas', label: 'Quản lý Persona', icon: UsersRound, requiredCapability: 'MANAGE_PERSONAS' },
  { to: '/manage/scenarios', label: 'Quản lý tình huống', icon: PanelsTopLeft, requiredCapability: 'MANAGE_SCENARIOS' },
  { to: '/my-training-assignments', label: 'Bài tập được giao', icon: ListChecks, roles: ['SALE'] },
]

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const visibleNavItems = navItems.filter((item) => isNavigationItemVisible(item, user?.role))
  const roleLabel = userRoleLabel(user?.role)

  const signOut = async () => {
    await logout()
    navigate('/login')
  }

  const renderNavContent = () => (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex h-16 items-center justify-between px-5 border-b border-border">
          <Brand />
          <button
            aria-label="Đóng menu"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink lg:hidden transition duration-150"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Điều hướng chính" className="mt-4 space-y-1 px-3">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                  isActive
                    ? 'bg-brand-soft text-brand font-semibold'
                    : 'text-ink-secondary font-medium hover:bg-surface-subtle hover:text-ink'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-surface-subtle transition-colors duration-150">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-subtle text-ink-secondary shrink-0 border border-border">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink" title={user?.displayName}>
              {user?.displayName ?? 'Chuyên viên'}
            </p>
            <p className="truncate text-[11px] font-medium text-brand" title={roleLabel}>{roleLabel}</p>
            <p className="truncate text-[11px] text-ink-muted" title={user?.email}>{user?.email}</p>
          </div>
          <button
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600 transition-colors duration-150"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-surface lg:block">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer */}
      {open && (
        <>
          <button
            aria-label="Đóng menu"
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-surface shadow-float lg:hidden">
            {renderNavContent()}
          </aside>
        </>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-60">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:hidden">
          <Brand compact />
          <button
            aria-label="Mở menu"
            className="rounded-lg border border-border p-2 text-ink hover:bg-surface-subtle transition duration-150"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
        </header>

        {/* Page Content */}
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-[1360px] px-4 py-6 sm:px-6 sm:py-8 lg:min-h-screen lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
