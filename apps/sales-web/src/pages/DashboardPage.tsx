import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageCircleMore,
  PlayCircle,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { PageHeader } from '../components/common/PageHeader'
import { PersonaCard } from '../components/common/PersonaCard'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, LoadingState } from '../components/ui/Feedback'
import { trainingService } from '../services/trainingService'
import { gamificationService } from '../services/gamificationService'
import type { ProgressAnalytics, PublicPersona, RecentSession } from '../types/training'
import type { PersonalGamification } from '../types/gamification'
import { formatProgressScore, labelProgressTrend } from '../utils/progressPresentation'
import { labelMode, labelOutcome, labelTrainingStatus } from '../utils/trainingLabels'

const formatActivity = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

function DashboardProgressCard({
  progress,
  loading,
  unavailable,
  onRetry,
}: {
  progress: ProgressAnalytics | null
  loading: boolean
  unavailable: boolean
  onRetry: () => void
}) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <Card data-testid="dashboard-progress-card" className="mt-6 p-5 sm:p-6">
        <div className="flex items-center gap-3 text-sm text-ink-secondary">
          <BarChart3 className="h-5 w-5 animate-pulse text-brand" />
          <span>Đang tải tiến độ luyện tập...</span>
        </div>
      </Card>
    )
  }

  if (unavailable || !progress) {
    return (
      <Card data-testid="dashboard-progress-card" className="mt-6 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-ink">Tiến độ luyện tập</h2>
            <p role="status" className="mt-1 text-sm text-ink-secondary">
              Chưa thể tải tiến độ lúc này.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={onRetry}
            >
              Thử lại
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/progress')}>
              Xem tiến độ
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const noEvaluation =
    progress.summary.evaluatedSessions === 0 || progress.summary.averageOverallScore === null
  const { overallTrend } = progress

  return (
    <Card data-testid="dashboard-progress-card" className="mt-6 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-bold text-ink">Tiến độ luyện tập</h2>
          <p className="mt-1 text-xs text-ink-secondary">
            Tóm tắt nhanh từ các phiên đã được đánh giá.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => navigate('/progress')}
        >
          Xem tiến độ
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {noEvaluation ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-subtle p-4">
          <p className="font-semibold text-sm text-ink">Chưa có dữ liệu đánh giá</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            Hoàn thành một phiên và xem kết quả để tiến độ bắt đầu được tổng hợp.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => navigate('/customers')}
          >
            Bắt đầu luyện tập
          </Button>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <ProgressMetric
            label="Phiên đã đánh giá"
            value={String(progress.summary.evaluatedSessions)}
          />
          <ProgressMetric
            label="Điểm trung bình"
            value={formatProgressScore(progress.summary.averageOverallScore)}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Xu hướng
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-ink">
              {overallTrend.state === 'IMPROVING' ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : overallTrend.state === 'DECLINING' ? (
                <TrendingDown className="h-4 w-4 text-amber-600" />
              ) : (
                <BarChart3 className="h-4 w-4 text-brand" />
              )}
              {labelProgressTrend(overallTrend.state)}
            </p>
            {overallTrend.delta !== null && (
              <p className="mt-1 text-xs text-ink-muted tabular-nums">
                {overallTrend.delta > 0 ? '+' : ''}
                {formatProgressScore(overallTrend.delta)} điểm so với nhóm trước
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
    </div>
  )
}

function DashboardGamificationCard({ userRole, data, loading, unavailable }: { userRole: string | undefined; data: PersonalGamification | null; loading: boolean; unavailable: boolean }) {
  const navigate = useNavigate()
  if (userRole !== 'SALE') return <Card data-testid="dashboard-gamification-card" className="mt-6 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6"><div><h2 className="text-base font-bold text-ink">Bảng xếp hạng tháng</h2><p className="mt-1 text-sm text-ink-secondary">Theo dõi thành tích luyện tập an toàn của đội ngũ SALE.</p></div><Button variant="secondary" icon={<Trophy className="h-4 w-4" />} onClick={() => navigate('/leaderboard')}>Bảng xếp hạng</Button></Card>
  if (loading) return <Card data-testid="dashboard-gamification-card" className="mt-6 p-5 sm:p-6"><div className="flex items-center gap-3 text-sm text-ink-secondary"><Trophy className="h-5 w-5 animate-pulse text-brand" />Đang tải XP và xếp hạng...</div></Card>
  if (unavailable || !data) return <Card data-testid="dashboard-gamification-card" className="mt-6 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6"><div><h2 className="text-base font-bold text-ink">Gamification</h2><p className="mt-1 text-sm text-ink-secondary">Chưa thể tải XP cá nhân lúc này.</p></div><Button variant="secondary" onClick={() => navigate('/leaderboard')}>Bảng xếp hạng</Button></Card>
  return <Card data-testid="dashboard-gamification-card" className="mt-6 p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="flex items-center gap-2 text-base font-bold text-ink"><Trophy className="h-5 w-5 text-amber-600" />Thành tích luyện tập</h2><p className="mt-1 text-xs text-ink-secondary">XP là điểm hoạt động; chất lượng kỹ năng vẫn được theo dõi tại Tiến độ.</p></div><Button size="sm" variant="secondary" onClick={() => navigate('/leaderboard')}>Bảng xếp hạng<ArrowRight className="h-3.5 w-3.5" /></Button></div><div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4"><ProgressMetric label="Level" value={String(data.level)} /><ProgressMetric label="Tổng XP" value={String(data.totalXp)} /><ProgressMetric label="Hạng tháng" value={data.currentMonth.rank ? `#${data.currentMonth.rank}` : '—'} /><ProgressMetric label="Chuỗi ngày" value={`${data.currentStreakDays}`} /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, data.currentLevelXp / 2.5)}%` }} /></div><p className="mt-2 text-xs text-ink-muted">Còn {data.xpToNextLevel} XP để lên Level {data.level + 1}.</p></Card>
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [personas, setPersonas] = useState<PublicPersona[]>([])
  const [sessions, setSessions] = useState<RecentSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<ProgressAnalytics | null>(null)
  const [progressLoading, setProgressLoading] = useState(true)
  const [progressUnavailable, setProgressUnavailable] = useState(false)
  const [gamification, setGamification] = useState<PersonalGamification | null>(null)
  const [gamificationLoading, setGamificationLoading] = useState(true)
  const [gamificationUnavailable, setGamificationUnavailable] = useState(false)

  useEffect(() => {
    Promise.all([trainingService.getRecommendedPersonas(), trainingService.getRecentSessions()])
      .then(([nextPersonas, nextSessions]) => {
        setPersonas(nextPersonas)
        setSessions(nextSessions)
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu luyện tập.')
      )
      .finally(() => setLoading(false))
  }, [])

  const loadProgress = useCallback(() => {
    let active = true
    setProgressLoading(true)
    setProgressUnavailable(false)
    trainingService
      .getProgress()
      .then((value) => {
        if (active) setProgress(value)
      })
      .catch(() => {
        if (active) setProgressUnavailable(true)
      })
      .finally(() => {
        if (active) setProgressLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => loadProgress(), [loadProgress])

  useEffect(() => {
    if (user?.role !== 'SALE') { setGamificationLoading(false); return }
    let active = true
    setGamificationLoading(true)
    setGamificationUnavailable(false)
    gamificationService.getPersonal().then((value) => { if (active) setGamification(value) }).catch(() => { if (active) setGamificationUnavailable(true) }).finally(() => { if (active) setGamificationLoading(false) })
    return () => { active = false }
  }, [user?.role])

  const activeCount = sessions.filter((session) => session.status === 'RUNNING').length
  const completedCount = sessions.filter((session) => session.status === 'COMPLETED').length

  return (
    <>
      <PageHeader
        eyebrow="Không gian luyện tập"
        title={`Xin chào, ${user?.displayName ?? 'bạn'} 👋`}
        description="Hôm nay bạn muốn thực hành tình huống bán hàng nào?"
      />

      {/* Primary Practice CTA */}
      <Card className="border border-brand-border/60 bg-gradient-to-br from-brand-soft/40 via-surface to-surface p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Phiên luyện tập tiếp theo
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Sẵn sàng cho một cuộc hội thoại mới?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              Chọn một khách hàng AI, nắm bối cảnh và thực hành cách khám phá nhu cầu trong vài
              phút.
            </p>
          </div>
          <div className="shrink-0">
            <Button
              size="lg"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={() => navigate('/customers')}
            >
              Bắt đầu luyện tập
            </Button>
          </div>
        </div>
      </Card>

      {/* Progress Snapshot */}
      <DashboardProgressCard
        progress={progress}
        loading={progressLoading}
        unavailable={progressUnavailable}
        onRetry={loadProgress}
      />
      <DashboardGamificationCard userRole={user?.role} data={gamification} loading={gamificationLoading} unavailable={gamificationUnavailable} />

      {loading ? (
        <div className="mt-8">
          <LoadingState label="Đang tải dữ liệu luyện tập..." />
        </div>
      ) : error ? (
        <Card className="mt-8 p-6 text-center">
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
            Thử tải lại
          </Button>
        </Card>
      ) : (
        <>
          {/* Recommended Personas */}
          <section className="mt-9">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-base font-bold text-ink">Khách hàng đề xuất</h2>
                <p className="mt-0.5 text-xs text-ink-secondary">
                  Chọn một phong cách khách hàng để bắt đầu.
                </p>
              </div>
              <button
                className="text-xs font-semibold text-brand hover:text-brand-hover transition-colors"
                onClick={() => navigate('/customers')}
              >
                Xem tất cả
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {personas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  onPractice={() => navigate(`/practice/new?personaId=${persona.id}`)}
                />
              ))}
            </div>
          </section>

          {/* Recent Training Sessions */}
          <section className="mt-9">
            <div className="mb-4">
              <h2 className="text-base font-bold text-ink">Phiên luyện tập gần đây</h2>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Tiếp tục phiên đang hoạt động hoặc xem kết quả phiên đã hoàn thành.
              </p>
            </div>

            {sessions.length === 0 ? (
              <EmptyState
                title="Bạn chưa có phiên luyện tập"
                description="Bắt đầu một phiên để dữ liệu hoạt động và kết quả xuất hiện tại đây."
                action={
                  <Button
                    icon={<ArrowRight className="h-4 w-4" />}
                    onClick={() => navigate('/customers')}
                  >
                    Bắt đầu luyện tập
                  </Button>
                }
              />
            ) : (
              <Card className="overflow-hidden">
                <div className="divide-y divide-border">
                  {sessions.map((session) => {
                    const active = session.status === 'RUNNING'
                    const statusLabel = active ? 'Đang hoạt động' : 'Đã hoàn thành'
                    const detailLabel = session.dealOutcome
                      ? labelOutcome(session.dealOutcome)
                      : session.trainingStatus
                        ? labelTrainingStatus(session.trainingStatus)
                        : 'Chưa có kết quả'

                    return (
                      <div
                        key={session.id}
                        className="grid gap-4 p-4 transition-colors duration-150 hover:bg-surface-hover lg:grid-cols-[1.1fr_1.2fr_0.8fr_auto] lg:items-center lg:p-5"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            initials={session.persona.displayName.slice(0, 2).toUpperCase()}
                            color="#0068FF"
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink">
                              {session.persona.displayName}
                            </p>
                            <p className="truncate text-xs text-ink-secondary">
                              {session.persona.role}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-ink">
                            {labelMode(session.mode)} · {session.turnCount} lượt trao đổi
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted tabular-nums">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatActivity(session.updatedAt)}
                          </p>
                        </div>

                        <div>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                              active ? 'text-brand' : 'text-emerald-700'
                            }`}
                          >
                            {active ? (
                              <Clock3 className="h-3.5 w-3.5 text-brand" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                            {statusLabel}
                          </span>
                          <p className="mt-0.5 text-xs text-ink-secondary">{detailLabel}</p>
                        </div>

                        <div className="flex lg:justify-end">
                          <Button
                            size="sm"
                            variant={active ? 'primary' : 'secondary'}
                            icon={active ? <PlayCircle className="h-3.5 w-3.5" /> : undefined}
                            onClick={() =>
                              navigate(
                                active ? `/practice/${session.id}` : `/history/${session.id}`
                              )
                            }
                          >
                            {active ? 'Tiếp tục luyện tập' : 'Xem lại'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </section>

          {/* Activity Metrics Overview */}
          {sessions.length > 0 && (
            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <Card className="flex items-center gap-3.5 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand shrink-0">
                  <MessageCircleMore className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-ink tabular-nums">{sessions.length}</p>
                  <p className="text-xs text-ink-secondary">Phiên gần đây</p>
                </div>
              </Card>
              <Card className="flex items-center gap-3.5 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-ink tabular-nums">{activeCount}</p>
                  <p className="text-xs text-ink-secondary">Đang hoạt động</p>
                </div>
              </Card>
              <Card className="flex items-center gap-3.5 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-ink tabular-nums">{completedCount}</p>
                  <p className="text-xs text-ink-secondary">Đã hoàn thành</p>
                </div>
              </Card>
            </section>
          )}
        </>
      )}
    </>
  )
}
