import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  PlayCircle,
  RotateCcw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Badge, DifficultyBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { MessageBubble } from '../features/practice/MessageBubble'
import { trainingService } from '../services/trainingService'
import type { TrainingSession } from '../types/training'
import { labelMode, labelOutcome, labelTrainingStatus } from '../utils/trainingLabels'

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Chưa xác định'
}

function calculateDuration(start: string, end: string | null, durationSeconds?: number) {
  if (durationSeconds !== undefined && durationSeconds > 0) {
    if (durationSeconds < 60) return `${durationSeconds} giây`
    return `${Math.floor(durationSeconds / 60)} phút ${durationSeconds % 60} giây`
  }
  if (!end) return 'Chưa kết thúc'
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  if (diffMs <= 0) return 'Dưới 1 phút'
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds} giây`
  return `${Math.floor(seconds / 60)} phút ${seconds % 60} giây`
}

export function SessionReplayPage() {
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    trainingService
      .getReplaySession(sessionId)
      .then((value) => {
        if (active) {
          setSession(value)
          setError('')
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'Không thể tải dữ liệu xem lại.'
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [sessionId])

  if (loading) {
    return <LoadingState label="Đang tải dữ liệu xem lại phiên..." />
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-lg mt-8">
        <ErrorState
          title="Không thể mở phiên xem lại"
          description={error || 'Phiên không tồn tại hoặc bạn không có quyền truy cập.'}
          action={<Button onClick={() => navigate('/history')}>Về lịch sử</Button>}
        />
      </div>
    )
  }

  if (session.status === 'RUNNING') {
    return (
      <div className="mx-auto max-w-lg mt-8">
        <Card className="p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-brand shadow-subtle">
            <PlayCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-ink">Phiên vẫn đang hoạt động</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
            Phiên này đang diễn ra. Bạn có thể tiếp tục luyện tập hoặc hoàn thành phiên trước khi xem
            lại lịch sử.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/history')}>
              Về lịch sử
            </Button>
            <Button onClick={() => navigate(`/practice/${session.id}`)}>
              Tiếp tục luyện tập
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const { persona, scenario, mode, messages, result, runtimeInsight } = session
  const saleTurnCount =
    result?.turnCount ?? messages.filter((message) => message.sender === 'SALE').length
  const durationText = calculateDuration(
    session.createdAt,
    session.completedAt,
    result?.durationSeconds
  )
  const outcomeLabel = result
    ? labelOutcome(result.outcome)
    : runtimeInsight
      ? labelOutcome(runtimeInsight.dealOutcome)
      : 'Đã hoàn thành'
  const trainingLabel = result
    ? labelTrainingStatus(result.trainingStatus)
    : runtimeInsight
      ? labelTrainingStatus(runtimeInsight.trainingStatus)
      : null

  const hasResult = Boolean(result || session.status === 'COMPLETED')

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      {/* Top Breadcrumb / Back Link */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <button
          className="inline-flex items-center gap-2 text-xs font-semibold text-ink-secondary hover:text-brand transition duration-150"
          onClick={() => navigate('/history')}
        >
          <ArrowLeft className="h-4 w-4" />
          Lịch sử luyện tập
        </button>

        {hasResult && (
          <Button
            size="sm"
            variant="secondary"
            icon={<BarChart3 className="h-4 w-4" />}
            onClick={() => navigate(`/practice/${session.id}/result`)}
          >
            Xem kết quả
          </Button>
        )}
      </div>

      {/* Read-Only Status Banner */}
      <div className="rounded-xl border border-brand-border/70 bg-brand-soft/40 p-4 sm:p-4.5 shadow-subtle">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand shrink-0 mt-0.5">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-ink">Chế độ xem lại</h2>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold text-[11px]">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Đã hoàn thành
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              Phiên luyện tập đã kết thúc. Nội dung bên dưới được đọc trực tiếp từ các lượt hội thoại
              đã lưu và không thể chỉnh sửa hay gửi thêm tin nhắn.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left Column: Persona & Metadata */}
        <aside className="space-y-4">
          {/* Persona Card */}
          <Card className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Khách hàng AI
              </p>
              <div className="mt-3 flex items-start gap-3">
                <Avatar initials={persona.initials} color={persona.color} size="md" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-ink">{persona.displayName}</h3>
                  <p className="text-xs font-semibold text-brand mt-0.5">{persona.role}</p>
                  <p className="text-xs text-ink-muted">{persona.customerType}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-ink-muted font-medium">Độ khó:</span>
              <DifficultyBadge value={persona.difficulty} />
            </div>
          </Card>

          {/* Scenario Card */}
          <Card className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Tình huống luyện tập
            </p>
            <h4 className="text-xs font-bold text-ink">{scenario.title}</h4>
            <p className="text-xs leading-relaxed text-ink-secondary">{scenario.description}</p>
          </Card>

          {/* Session Metrics & Timing Card */}
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Thông tin phiên
            </p>
            <dl className="mt-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-secondary">Chế độ</dt>
                <dd className="font-semibold text-ink">{labelMode(mode)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-1 text-ink-secondary">
                  <CalendarDays className="h-3 w-3" />
                  Bắt đầu
                </dt>
                <dd className="font-medium text-ink tabular-nums">{formatDate(session.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-1 text-ink-secondary">
                  <Clock3 className="h-3 w-3" />
                  Hoàn thành
                </dt>
                <dd className="font-medium text-ink tabular-nums">
                  {formatDate(session.completedAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-secondary">Thời lượng</dt>
                <dd className="font-bold text-ink">{durationText}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-secondary">Lượt của bạn</dt>
                <dd className="font-bold text-brand tabular-nums">{saleTurnCount} lượt</dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-border pt-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Kết quả ghi nhận
              </p>
              <p className="mt-1 font-bold text-sm text-ink">{outcomeLabel}</p>
              {trainingLabel && (
                <p className="mt-0.5 text-xs text-ink-secondary">{trainingLabel}</p>
              )}
            </div>
          </Card>
        </aside>

        {/* Right Column: Historical Transcript Stream */}
        <section>
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-surface-subtle/50 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Nội dung hội thoại</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Sắp xếp theo trình tự thời gian · {messages.length} tin nhắn được lưu
                </p>
              </div>
              <Badge className="text-[10px] uppercase font-bold tracking-wider text-ink-muted bg-surface">
                Chỉ đọc
              </Badge>
            </div>

            <div className="min-h-96 bg-canvas px-4 py-6 sm:px-6">
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.length ? (
                  messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))
                ) : (
                  <div className="py-16 text-center">
                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface text-ink-muted">
                      <History className="h-5 w-5" />
                    </div>
                    <p className="mt-3 font-semibold text-sm text-ink">
                      Chưa có lượt hội thoại nào được lưu
                    </p>
                    <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto">
                      Phiên này không có tin nhắn nào trong lịch sử lưu trữ.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Bottom Action Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="secondary"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate('/history')}
            >
              Về lịch sử
            </Button>
            <Button
              variant="secondary"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={() => navigate(`/practice/new?personaId=${persona.id}`)}
            >
              Luyện tập lại
            </Button>
            {hasResult && (
              <Button
                icon={<BarChart3 className="h-4 w-4" />}
                onClick={() => navigate(`/practice/${session.id}/result`)}
              >
                Xem kết quả
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
