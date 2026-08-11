import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { CustomersPage } from '../pages/CustomersPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PracticePage } from '../pages/PracticePage'
import { SessionResultPage } from '../pages/SessionResultPage'
import { SessionSetupPage } from '../pages/SessionSetupPage'

export function App() {
  return <Routes><Route element={<AuthLayout />}><Route path="/login" element={<LoginPage />} /></Route><Route element={<AppLayout />}><Route path="/dashboard" element={<DashboardPage />} /><Route path="/customers" element={<CustomersPage />} /><Route path="/practice/new" element={<SessionSetupPage />} /><Route path="/practice/:sessionId" element={<PracticePage />} /><Route path="/practice/:sessionId/result" element={<SessionResultPage />} /></Route><Route path="/" element={<Navigate to="/dashboard" replace />} /><Route path="*" element={<NotFoundPage />} /></Routes>
}
