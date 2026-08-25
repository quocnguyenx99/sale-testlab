import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { AppSidebar } from '../components/shell/AppSidebar'
import { AppTopbar } from '../components/shell/AppTopbar'
import { MobileNavDrawer } from '../components/shell/MobileNavDrawer'
import { shellPageTitle } from '../components/shell/navigation'

const sidebarPreferenceKey = 'testlab-v3-sidebar-collapsed'

export function AppLayout() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(sidebarPreferenceKey) === 'true')
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user) return null

  const signOut = async () => {
    await logout()
    navigate('/login')
  }

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current
      localStorage.setItem(sidebarPreferenceKey, String(next))
      return next
    })
  }

  return (
    <div className="min-h-screen bg-canvas">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden overflow-visible border-r border-border bg-surface transition-[width] duration-150 lg:block ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[72px] xl:w-[248px]'
        }`}
      >
        <AppSidebar
          collapsed={sidebarCollapsed}
          onSignOut={() => void signOut()}
          onToggleCollapsed={toggleSidebar}
          pathname={location.pathname}
          user={user}
        />
      </aside>

      <MobileNavDrawer
        onClose={() => setMobileNavigationOpen(false)}
        onSignOut={() => void signOut()}
        open={mobileNavigationOpen}
        pathname={location.pathname}
        user={user}
      />

      <div className={`transition-[padding] duration-150 lg:pl-[72px] ${sidebarCollapsed ? '' : 'xl:pl-[248px]'}`}>
        <AppTopbar
          onOpenNavigation={() => setMobileNavigationOpen(true)}
          pageTitle={shellPageTitle(location.pathname)}
          user={user}
        />
        <main
          className="mx-auto min-h-[calc(100dvh-3.5rem)] max-w-[1360px] px-4 py-6 sm:px-6 lg:px-6 lg:py-8 xl:px-8"
          id="main-content"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
