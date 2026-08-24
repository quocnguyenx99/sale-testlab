import { Menu } from 'lucide-react'
import type { PublicAuthUser } from '../../services/authService'
import { Brand } from '../common/Brand'

export function AppTopbar({
  pageTitle,
  user,
  onOpenNavigation,
}: {
  pageTitle: string
  user: PublicAuthUser
  onOpenNavigation: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-md sm:px-6 lg:px-6 xl:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Mở menu điều hướng"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-ink transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus/30 lg:hidden"
          onClick={onOpenNavigation}
          type="button"
        >
          <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <div className="lg:hidden"><Brand compact /></div>
        <p className="hidden truncate text-sm font-semibold text-ink sm:block" data-testid="shell-page-title">
          {pageTitle}
        </p>
      </div>
      <div
        aria-label={`${user.displayName}, ${user.role}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-xs font-bold text-white lg:hidden"
        role="img"
      >
          {user.displayName.trim().slice(0, 1).toUpperCase() || 'T'}
      </div>
    </header>
  )
}
