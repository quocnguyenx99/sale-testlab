import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { CustomersPage } from '../pages/CustomersPage'
import { DashboardPage } from '../pages/DashboardPage'
import { HistoryPage } from '../pages/HistoryPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PracticePage } from '../pages/PracticePage'
import { ProgressPage } from '../pages/ProgressPage'
import { TrainingProgramsPage } from '../pages/TrainingProgramsPage'
import { TrainingProgramEditorPage } from '../pages/TrainingProgramEditorPage'
import { TrainingAssignmentsPage } from '../pages/TrainingAssignmentsPage'
import { TrainingAssignmentCreatePage } from '../pages/TrainingAssignmentCreatePage'
import { TrainingAssignmentDetailPage } from '../pages/TrainingAssignmentDetailPage'
import { MyTrainingAssignmentsPage } from '../pages/MyTrainingAssignmentsPage'
import { MyTrainingAssignmentDetailPage } from '../pages/MyTrainingAssignmentDetailPage'
import { SessionResultPage } from '../pages/SessionResultPage'
import { SessionReplayPage } from '../pages/SessionReplayPage'
import { SessionSetupPage } from '../pages/SessionSetupPage'
import { PersonaEditorPage, PersonaManagementPage } from '../pages/PersonaManagementPage'
import { ScenarioEditorPage, ScenarioManagementPage } from '../pages/ScenarioManagementPage'
import { LeaderboardPage } from '../pages/LeaderboardPage'
import { useAuth } from './AuthContext'
import { ForbiddenState, LoadingState } from '../components/ui/Feedback'
import { Button } from '../components/ui/Button'
import { hasUiCapability, isUserRole, type UiCapability, type UserRole } from './authorizationPolicy'

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

function RequireCapability({ capability }: { capability: UiCapability }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  return hasUiCapability(user?.role, capability)
    ? <Outlet />
    : <ForbiddenState action={<Button onClick={() => navigate('/dashboard')}>Về trang tổng quan</Button>} />
}

function RequireRole({ roles }: { roles: readonly UserRole[] }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  return isUserRole(user?.role) && roles.includes(user.role)
    ? <Outlet />
    : <ForbiddenState action={<Button onClick={() => navigate('/dashboard')}>Về trang tổng quan</Button>} />
}

export function App() {
  return <Routes><Route element={<LoginGate />}><Route element={<AuthLayout />}><Route path="/login" element={<LoginPage />} /></Route></Route><Route element={<RequireAuth />}><Route element={<AppLayout />}><Route path="/dashboard" element={<DashboardPage />} /><Route path="/customers" element={<CustomersPage />} /><Route path="/progress" element={<ProgressPage />} /><Route path="/history" element={<HistoryPage />} /><Route path="/history/:sessionId" element={<SessionReplayPage />} /><Route path="/practice/new" element={<SessionSetupPage />} /><Route path="/practice/:sessionId" element={<PracticePage />} /><Route path="/practice/:sessionId/result" element={<SessionResultPage />} /><Route element={<RequireCapability capability="VIEW_LEADERBOARD" />}><Route path="/leaderboard" element={<LeaderboardPage />} /></Route><Route element={<RequireCapability capability="MANAGE_PERSONAS" />}><Route path="/manage/personas" element={<PersonaManagementPage />} /><Route path="/manage/personas/new" element={<PersonaEditorPage />} /><Route path="/manage/personas/:personaId" element={<PersonaEditorPage />} /><Route path="/manage/personas/:personaId/versions/:versionId" element={<PersonaEditorPage />} /></Route><Route element={<RequireCapability capability="MANAGE_SCENARIOS" />}><Route path="/manage/scenarios" element={<ScenarioManagementPage />} /><Route path="/manage/scenarios/new" element={<ScenarioEditorPage />} /><Route path="/manage/scenarios/:scenarioId" element={<ScenarioEditorPage />} /><Route path="/manage/scenarios/:scenarioId/versions/:versionId" element={<ScenarioEditorPage />} /></Route><Route element={<RequireCapability capability="MANAGE_TRAINING_PROGRAMS" />}><Route path="/training-programs" element={<TrainingProgramsPage />} /><Route path="/training-programs/new" element={<TrainingProgramEditorPage />} /><Route path="/training-programs/:programId" element={<TrainingProgramEditorPage />} /></Route><Route element={<RequireCapability capability="ASSIGN_TRAINING" />}><Route path="/training-assignments" element={<TrainingAssignmentsPage />} /><Route path="/training-assignments/new" element={<TrainingAssignmentCreatePage />} /><Route path="/training-assignments/:assignmentId" element={<TrainingAssignmentDetailPage />} /></Route><Route element={<RequireRole roles={['SALE']} />}><Route path="/my-training-assignments" element={<MyTrainingAssignmentsPage />} /><Route path="/my-training-assignments/:assignmentId" element={<MyTrainingAssignmentDetailPage />} /></Route></Route></Route><Route path="/" element={<Navigate to="/dashboard" replace />} /><Route path="*" element={<NotFoundPage />} /></Routes>
}
