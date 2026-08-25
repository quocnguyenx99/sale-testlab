import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'
import { isNavigationItemVisible } from '../../app/navigationPolicy'
import { userRoleLabel } from '../../app/authorizationPolicy'
import { Brand } from '../common/Brand'
import type { PublicAuthUser } from '../../services/authService'
import { isShellItemActive, shellNavigation } from './navigation'

function userInitials(user: PublicAuthUser): string {
  const parts = user.displayName.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) || 'TL').toUpperCase()
}

interface AppSidebarProps {
  user: PublicAuthUser
  pathname: string
  collapsed: boolean
  mobile?: boolean
  onNavigate?: () => void
  onToggleCollapsed?: () => void
  onSignOut: () => void
}

export function AppSidebar({
  user,
  pathname,
  collapsed,
  mobile = false,
  onNavigate,
  onToggleCollapsed,
  onSignOut,
}: AppSidebarProps) {
  const groups = shellNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isNavigationItemVisible(item, user.role)),
    }))
    .filter((group) => group.items.length > 0)
  const showText = mobile || !collapsed
  const adaptiveRail = !mobile && !collapsed

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className={`flex h-16 shrink-0 items-center border-b border-border ${
        mobile ? 'justify-between px-4' : collapsed ? 'justify-center px-2' : 'justify-center px-2 xl:justify-between xl:px-4'
      }`}>
        <Brand compact={collapsed} adaptive={adaptiveRail} />
        {!mobile && showText && (
          <button
            aria-label="Thu gọn thanh điều hướng"
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-focus/30 xl:inline-flex"
            onClick={onToggleCollapsed}
            type="button"
          >
            <ChevronsLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="Điều hướng chính" className="scrollbar-thin flex-1 overflow-y-auto px-2 py-4">
        {groups.map((group, groupIndex) => (
          <div key={group.id} className={groupIndex === 0 ? '' : 'mt-5'}>
            {group.label && showText && (
              <p className={`mb-2 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted ${adaptiveRail ? 'hidden xl:block' : ''}`}>
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isShellItemActive(pathname, item)
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    aria-current={active ? 'page' : undefined}
                    aria-label={!showText || adaptiveRail ? item.label : undefined}
                    className={`group relative flex h-10 items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
                      mobile ? 'gap-3 px-3' : collapsed ? 'justify-center px-2' : 'justify-center px-2 xl:justify-start xl:gap-3 xl:px-3'
                    } ${
                      active
                        ? 'bg-brand-soft font-semibold text-brand-hover before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-brand'
                        : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                    }`}
                    onClick={onNavigate}
                    title={!showText || adaptiveRail ? item.label : undefined}
                    to={item.to}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    {showText && <span className={`truncate ${adaptiveRail ? 'hidden xl:block' : ''}`}>{item.label}</span>}
                    {(!showText || adaptiveRail) && (
                      <span
                        className={`pointer-events-none absolute left-[calc(100%+0.5rem)] z-50 hidden whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-dropdown group-hover:block group-focus-visible:block ${adaptiveRail ? 'xl:!hidden' : ''}`}
                        role="tooltip"
                      >
                        {item.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2">
        <div className={`flex items-center rounded-lg ${
          mobile ? 'gap-3 p-2' : collapsed ? 'flex-col gap-2 py-2' : 'flex-col gap-2 py-2 xl:flex-row xl:gap-3 xl:p-2'
        }`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-subtle text-xs font-bold text-brand">
            {userInitials(user)}
          </div>
          {showText && (
            <div className={`min-w-0 flex-1 ${adaptiveRail ? 'hidden xl:block' : ''}`}>
              <p className="truncate text-sm font-semibold leading-5 text-ink" title={user.displayName}>{user.displayName}</p>
              <p className="truncate text-xs leading-[18px] text-ink-secondary" title={userRoleLabel(user.role)}>{userRoleLabel(user.role)}</p>
            </div>
          )}
          <button
            aria-label="Đăng xuất"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-focus/30"
            onClick={onSignOut}
            title="Đăng xuất"
            type="button"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!mobile && collapsed && (
        <button
          aria-label="Mở rộng thanh điều hướng"
          className="m-2 hidden h-9 items-center justify-center rounded-lg border border-border text-ink-secondary transition-colors hover:border-border-strong hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-focus/30 xl:flex"
          onClick={onToggleCollapsed}
          type="button"
        >
          <ChevronsRight className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
