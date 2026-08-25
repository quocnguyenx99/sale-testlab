import { X } from 'lucide-react'
import type { PublicAuthUser } from '../../services/authService'
import { useFocusTrap } from '../ui/useFocusTrap'
import { AppSidebar } from './AppSidebar'

export function MobileNavDrawer({
  open,
  user,
  pathname,
  onClose,
  onSignOut,
}: {
  open: boolean
  user: PublicAuthUser
  pathname: string
  onClose: () => void
  onSignOut: () => void
}) {
  const drawerRef = useFocusTrap<HTMLElement>(open, onClose)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Đóng menu điều hướng"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <aside
        aria-label="Menu điều hướng"
        className="relative h-full w-[min(288px,calc(100vw-32px))] shadow-drawer"
        ref={drawerRef}
        tabIndex={-1}
      >
        <button
          aria-label="Đóng menu"
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-focus/30"
          data-autofocus
          onClick={onClose}
          type="button"
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <AppSidebar
          collapsed={false}
          mobile
          onNavigate={onClose}
          onSignOut={onSignOut}
          pathname={pathname}
          user={user}
        />
      </aside>
    </div>
  )
}
