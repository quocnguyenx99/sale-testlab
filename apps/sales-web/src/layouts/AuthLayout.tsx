import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-canvas">
      <a className="skip-link" href="#auth-content">Bỏ qua đến biểu mẫu đăng nhập</a>
      <main className="min-h-[100dvh]" id="auth-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
