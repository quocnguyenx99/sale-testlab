import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  History,
  Home,
  RotateCcw,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTraining } from '../app/TrainingContext'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { CoachingSection } from '../features/practice/CoachingSection'
import { EvaluationSection } from '../features/practice/EvaluationSection'
import type { EvaluationResponse } from '../types/training'
import {
  labelMode,
  labelOutcome,
  labelSignal,
  labelTopic,
  labelTrainingStatus,
} from '../utils/trainingLabels'

export function SessionResultPage() {
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  const { session, loadSession } = useTraining()
  const [loading, setLoading] = useState(session?.id !== sessionId)
  const [error, setError] = useState('')
  const [evaluationState, setEvaluationState] = useState<
    EvaluationResponse['state'] | 'LOADING'
  >('LOADING')

  const handleEvaluationState = useCallback((state: EvaluationResponse['state']) => {
    setEvaluationState(state)
  }, [])

  useEffect(() => {
    if (!sessionId || session?.id === sessionId) {
      setLoading(false)
      return
    }
    loadSession(sessionId)
      .then(() => setError(''))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể tải kết quả phiên.')
      )
      .finally(() => setLoading(false))
  }, [loadSession, session?.id, sessionId])

  if (loading) {
    return <LoadingState label="Đang tải kết quả phiên..." />
  }

  if (!session || session.id !== sessionId) {
    return (
      <div className="mx-auto max-w-lg mt-8">
        <ErrorState
          title="Không thể tải kết quả"
          description={error || 'Phiên không tồn tại hoặc bạn không có quyền truy cập.'}
          action={<Button onClick={() => navigate('/dashboard')}>Về trang chủ</Button>}
        />
      </div>
    )
  }

  if (session.status === 'RUNNING') {
    return (
      <div className="mx-auto max-w-lg mt-8">
        <Card className="p-6 text-center">
          <h2 className="text-lg font-bold text-ink">Phiên vẫn đang hoạt động</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
            Hãy tiếp tục hội thoại hoặc kết thúc phiên trước khi xem kết quả tổng kết.
          </p>
          <Button className="mt-5" onClick={() => navigate(`/practice/${session.id}`)}>
            Tiếp tục luyện tập
          </Button>
        </Card>
      </div>
    )
  }

  if (!session.result) {
    return (
      <div className="mx-auto max-w-lg mt-8">
        <Card className="p-6 text-center">
          <h2 className="text-lg font-bold text-ink">Kết quả chưa sẵn sàng</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
            Phiên đã hoàn thành nhưng chưa có dữ liệu tổng kết đáng tin cậy.
          </p>
          <Button className="mt-5" onClick={() => navigate('/dashboard')}>
            Về trang chủ
          </Button>
        </Card>
      </div>
    )
  }

  const { persona, mode, result } = session
  const duration =
    result.durationSeconds < 60
      ? `${result.durationSeconds} giây`
      : `${Math.floor(result.durationSeconds / 60)} phút ${result.durationSeconds % 60} giây`

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {/* Top Completion Header */}
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-200/60 bg-emerald-50 text-emerald-600 shadow-subtle">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          Phiên đã hoàn thành
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Tổng kết phiên luyện tập
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-ink-secondary">
          Kết quả hội thoại và đánh giá kỹ năng được trình bày riêng biệt để bạn dễ theo dõi và cải
          thiện.
        </p>
      </div>

      {/* Session Summary Grid */}
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Left: Persona & Session Metrics */}
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Khách hàng AI
            </p>
            <div className="mt-3.5 flex items-center gap-3.5">
              <Avatar initials={persona.initials} color={persona.color} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-bold text-ink">{persona.displayName}</h3>
                <p className="text-xs font-semibold text-brand mt-0.5">{persona.role}</p>
                <p className="text-xs text-ink-muted">{persona.customerType}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Tóm tắt phiên
            </p>
            <dl className="mt-3.5 space-y-2.5 text-xs">
              <SummaryRow label="Lượt trao đổi của bạn" value={`${result.turnCount} lượt`} />
              <SummaryRow label="Thời lượng" value={duration} />
              <SummaryRow label="Chế độ bắt đầu" value={labelMode(mode)} />
            </dl>
          </Card>
        </div>

        {/* Right: Outcome & Topics & Signals */}
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-border p-5 bg-surface-subtle/30">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Kết quả hội thoại
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-ink">
                    {labelOutcome(result.outcome)}
                  </h3>
                </div>
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 w-fit">
                  {labelTrainingStatus(result.trainingStatus)}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                Trạng thái này phân loại trực tiếp từ dữ liệu phiên, độc lập với điểm đánh giá kỹ
                năng.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
              <TopicList title="Chủ đề đã trao đổi" items={result.resolvedTopics} resolved />
              <TopicList title="Chủ đề còn lại" items={result.missingTopics} />
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Tín hiệu ghi nhận
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.signals.length ? (
                result.signals.map((signal) => (
                  <Badge key={signal} className="bg-brand-soft text-brand border-brand-border/70">
                    <Check className="mr-1 h-3 w-3" />
                    {labelSignal(signal)}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-ink-muted">Chưa ghi nhận tín hiệu nổi bật.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Evaluation Section */}
      <EvaluationSection sessionId={session.id} onStateChange={handleEvaluationState} />

      {/* AI Coaching Section */}
      <CoachingSection sessionId={session.id} evaluationState={evaluationState} />

      {/* Navigation Footer */}
      <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
        <Button
          variant="secondary"
          icon={<RotateCcw className="h-4 w-4" />}
          onClick={() => navigate(`/practice/new?personaId=${persona.id}`)}
        >
          Luyện tập lại
        </Button>
        <Button
          variant="secondary"
          icon={<UsersRound className="h-4 w-4" />}
          onClick={() => navigate('/customers')}
        >
          Chọn khách hàng khác
        </Button>
        <Button
          variant="secondary"
          icon={<History className="h-4 w-4" />}
          onClick={() => navigate('/history')}
        >
          Về lịch sử
        </Button>
        <Button icon={<Home className="h-4 w-4" />} onClick={() => navigate('/dashboard')}>
          Về trang chủ
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="font-bold text-ink tabular-nums text-right">{value}</dd>
    </div>
  )
}

function TopicList({
  title,
  items,
  resolved = false,
}: {
  title: string
  items: string[]
  resolved?: boolean
}) {
  return (
    <div className="p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={item}
              className={`flex items-center gap-2 text-xs ${
                resolved ? 'font-semibold text-ink' : 'text-ink-secondary'
              }`}
            >
              {resolved ? (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                  <Check className="h-2.5 w-2.5" />
                </span>
              ) : (
                <Circle className="h-3.5 w-3.5 text-ink-muted shrink-0" />
              )}
              <span className="truncate">{labelTopic(item)}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-ink-muted">Không có chủ đề được ghi nhận.</p>
        )}
      </div>
    </div>
  )
}
