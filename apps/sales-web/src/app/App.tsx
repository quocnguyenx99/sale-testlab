import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { CustomersPage } from '../pages/CustomersPage'
import { DashboardPage } from '../pages/DashboardPage'
import { HistoryPage } from '../pages/HistoryPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PracticePage } from '../pages/PracticePage'
import { ProgressPage } from '../pages/ProgressPage'
import { SessionResultPage } from '../pages/SessionResultPage'
import { SessionReplayPage } from '../pages/SessionReplayPage'
import { SessionSetupPage } from '../pages/SessionSetupPage'
import { useAuth } from './AuthContext'
import { LoadingState } from '../components/ui/Feedback'

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingState label="Đang kiểm tra phiên đăng nhập..." />
  return user ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname }} replace />
}

function LoginGate() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingState label="Đang kiểm tra phiên đăng nhập..." />
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />
}

export function App() {
  return <Routes><Route element={<LoginGate />}><Route element={<AuthLayout />}><Route path="/login" element={<LoginPage />} /></Route></Route><Route element={<RequireAuth />}><Route element={<AppLayout />}><Route path="/dashboard" element={<DashboardPage />} /><Route path="/customers" element={<CustomersPage />} /><Route path="/progress" element={<ProgressPage />} /><Route path="/history" element={<HistoryPage />} /><Route path="/history/:sessionId" element={<SessionReplayPage />} /><Route path="/practice/new" element={<SessionSetupPage />} /><Route path="/practice/:sessionId" element={<PracticePage />} /><Route path="/practice/:sessionId/result" element={<SessionResultPage />} /></Route></Route><Route path="/" element={<Navigate to="/dashboard" replace />} /><Route path="*" element={<NotFoundPage />} /></Routes>
}
