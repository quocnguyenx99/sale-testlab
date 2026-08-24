import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
import { Surface } from '../components/ui/Surface'
import { trainingService } from '../services/trainingService'
import type { ProgressAnalytics, ProgressTrend, ProgressTrendState } from '../types/training'
import {
  formatProgressDate,
  formatProgressScore,
  isLowDataTrend,
  labelProgressMode,
  labelProgressTrend,
  progressResultPath,
} from '../utils/progressPresentation'

function trendTone(state: ProgressTrendState): string {
  if (state === 'IMPROVING') return 'border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold'
  if (state === 'DECLINING') return 'border-amber-200 bg-amber-50 text-amber-800 font-semibold'
  if (state === 'STABLE') return 'border-blue-200 bg-blue-50 text-blue-700 font-semibold'
  return 'border-border bg-surface-subtle text-ink-secondary font-medium'
}

function TrendBadge({ trend }: { trend: ProgressTrend }) {
  return <Badge className={trendTone(trend.state)}>{labelProgressTrend(trend.state)}</Badge>
}

function TrendChart({ progress }: { progress: ProgressAnalytics }) {
  const points = progress.overallTrend.points.slice(0, 12)
  const width = 640
  const height = 220
  const padding = { top: 20, right: 24, bottom: 30, left: 36 }
  const x = (index: number) =>
    points.length < 2
      ? width / 2
      : padding.left + index * ((width - padding.left - padding.right) / (points.length - 1))
  const y = (score: number) =>
    padding.top + (100 - score) * ((height - padding.top - padding.bottom) / 100)
  const polyline = points.map((point, index) => `${x(index)},${y(point.score)}`).join(' ')
  const description =
    points.length === 0
      ? 'Chưa có điểm đánh giá để hiển thị biểu đồ.'
      : `${points.length} điểm đánh giá, từ ${formatProgressScore(
          points[0].score
        )} đến ${formatProgressScore(points[points.length - 1].score)} trên thang 100.`

  if (points.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-dashed border-border bg-surface-subtle/50 p-8 text-center text-xs text-ink-muted">
        Chưa có điểm đánh giá để hiển thị xu hướng.
      </div>
    )
  }

  return (
    <div className="mt-5">
      <svg
        className="h-auto w-full overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Biểu đồ xu hướng điểm. ${description}`}
      >
        <title>Biểu đồ xu hướng điểm theo các phiên được đánh giá</title>
        <desc>{description}</desc>
        {/* Gridlines */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={y(100)}
          y2={y(100)}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={y(50)}
          y2={y(50)}
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={y(0)}
          y2={y(0)}
          stroke="#e2e8f0"
          strokeWidth="1"
        />
        {/* Y-axis Labels */}
        <text x="4" y={y(100) + 4} fill="#98A2B3" fontSize="12" fontFamily="inherit">
          100
        </text>
        <text x="10" y={y(50) + 4} fill="#98A2B3" fontSize="12" fontFamily="inherit">
          50
        </text>
        <text x="16" y={y(0) + 4} fill="#98A2B3" fontSize="12" fontFamily="inherit">
          0
        </text>

        {/* Trend Polyline */}
        {points.length > 1 && (
          <polyline
            fill="none"
            points={polyline}
            stroke="#0068FF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data Points */}
        {points.map((point, index) => (
          <g key={`${point.sessionId}-${point.evaluatedAt}`}>
            <circle
              cx={x(index)}
              cy={y(point.score)}
              r="5"
              fill="#ffffff"
              stroke="#0068FF"
              strokeWidth="2.5"
              className="transition duration-150 hover:r-6 cursor-pointer"
            />
            <title>{`Điểm ${formatProgressScore(point.score)} · ${formatProgressDate(
              point.evaluatedAt
            )}`}</title>
          </g>
        ))}
      </svg>
      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        {description} Trục điểm cố định từ 0 đến 100.
      </p>
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: string
  detail?: string
  icon: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
          {detail && <p className="mt-1 text-xs text-ink-muted leading-relaxed">{detail}</p>}
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand shrink-0">
          {icon}
        </div>
    </div>
  )
}

function HighlightCard({
  title,
  skill,
  tone,
}: {
  title: string
  skill: ProgressAnalytics['skills'][number] | undefined
  tone: 'strength' | 'attention'
}) {
  const isStrength = tone === 'strength'
  const icon = isStrength ? <Sparkles className="h-5 w-5" /> : <Target className="h-5 w-5" />
  const classes = isStrength
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
    : 'bg-amber-50 text-amber-800 border-amber-200/60'

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl border ${classes} shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {skill ? skill.label : 'Chưa đủ dữ liệu để xác định.'}
          </p>
        </div>
      </div>
      {skill && (
        <div className="border-t border-border pt-3 text-xs text-ink-secondary">
          Điểm trung bình:{' '}
          <span className="font-bold text-ink">{formatProgressScore(skill.averageScore)}</span> ·{' '}
          {skill.sampleCount} phiên có dữ liệu
        </div>
      )}
    </Card>
  )
}

export function ProgressPage() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<ProgressAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    let active = true
    setLoading(true)
    setError(false)
    trainingService
      .getProgress()
      .then((value) => {
        if (active) setProgress(value)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const header = (
    <PageHeader
      eyebrow="Phân tích học tập"
      title="Tiến độ luyện tập"
      description="Theo dõi kết quả từ các phiên đã hoàn thành và được hệ thống đánh giá."
    />
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        {header}
        <LoadingState label="Đang tải tiến độ luyện tập..." />
      </div>
    )
  }

  if (error || !progress) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        {header}
        <ErrorState
          title="Không thể tải tiến độ luyện tập lúc này"
          description="Đã có lỗi xảy ra khi lấy dữ liệu tiến độ. Hãy thử tải lại sau ít phút."
          action={
            <Button
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={load}
            >
              Thử tải lại
            </Button>
          }
        />
      </div>
    )
  }

  if (progress.summary.totalSessions === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-8">
        {header}
        <EmptyState
          title="Bạn chưa có phiên luyện tập"
          description="Bắt đầu một phiên luyện tập để rèn luyện kỹ năng và dữ liệu tiến độ sẽ xuất hiện tại đây."
          action={
            <Button
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={() => navigate('/customers')}
            >
              Bắt đầu luyện tập
            </Button>
          }
        />
      </div>
    )
  }

  const { summary, overallTrend, skills, highlights, recentEvaluatedSessions } = progress
  const strongestSkill = skills.find(
    (skill) => skill.criterionKey === highlights.strongestSkillKey
  )
  const attentionSkill = skills.find(
    (skill) => skill.criterionKey === highlights.needsAttentionSkillKey
  )
  const noEvaluations = summary.evaluatedSessions === 0

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      {header}

      {/* Summary KPI Metrics */}
      <div>
        <section
          aria-label="Tóm tắt tiến độ"
          className="grid overflow-hidden rounded-xl border border-border bg-surface shadow-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
        >
          <SummaryMetric
            label="Tổng số phiên"
            value={String(summary.totalSessions)}
            icon={<Compass className="h-5 w-5" />}
          />
          <SummaryMetric
            label="Phiên đã hoàn thành"
            value={String(summary.completedSessions)}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <SummaryMetric
            label="Phiên đã đánh giá"
            value={String(summary.evaluatedSessions)}
            icon={<ClipboardCheck className="h-5 w-5" />}
          />
          <SummaryMetric
            label="Điểm trung bình"
            value={formatProgressScore(summary.averageOverallScore)}
            detail={
              summary.recentAverageScore === null
                ? 'Chưa có điểm gần đây'
                : `Gần đây: ${formatProgressScore(summary.recentAverageScore)}`
            }
            icon={<BarChart3 className="h-5 w-5" />}
          />
        </section>

        {/* Training Frequency Line */}
        <p className="mt-3 text-xs text-ink-muted">
          Tần suất luyện tập:{' '}
          <span className="font-semibold text-ink">
            {summary.trainingFrequency.completedSessions} phiên /{' '}
            {summary.trainingFrequency.windowDays} ngày
          </span>{' '}
          · {formatProgressScore(summary.trainingFrequency.averagePerWeek)} phiên / tuần.
        </p>
      </div>

      {/* Warning Callout when no evaluations exist */}
      {noEvaluations && (
        <Card className="border-dashed p-5 bg-surface-subtle/30">
          <div className="flex gap-3">
            <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div>
              <h2 className="text-sm font-bold text-ink">Chưa có phiên được đánh giá</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Các phiên đã hoàn thành sẽ xuất hiện trong phân tích sau khi có kết quả đánh giá.
                Trang này không tự động tạo đánh giá.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Overall Trend & SVG Chart */}
      <section>
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-base font-bold text-ink">Xu hướng điểm</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Dựa trên các phiên đã được đánh giá, theo thứ tự thời gian.
              </p>
            </div>
            <TrendBadge trend={overallTrend} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-secondary">
            <span>{overallTrend.sampleCount} phiên có dữ liệu</span>
            {overallTrend.delta !== null && (
              <span className="inline-flex items-center gap-1 font-semibold">
                {overallTrend.delta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                ) : overallTrend.delta < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-amber-700" />
                ) : (
                  <BarChart3 className="h-3.5 w-3.5 text-brand" />
                )}
                {overallTrend.delta > 0 ? '+' : ''}
                {formatProgressScore(overallTrend.delta)} điểm so với nhóm phiên trước
              </span>
            )}
          </div>

          <TrendChart progress={progress} />
        </Card>
      </section>

      {/* Skills Rubric Grid */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-bold text-ink">Kỹ năng</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Mỗi kỹ năng dùng dữ liệu đánh giá do backend cung cấp.
          </p>
        </div>

        <Surface className="overflow-hidden border border-border shadow-subtle">
          <div className="-mb-px -mr-px grid md:grid-cols-2 xl:grid-cols-3">
          {skills.map((skill) => (
            <article
              key={skill.criterionKey}
              className="border-b border-r border-border p-5 transition-colors hover:bg-surface-subtle/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-ink">{skill.label}</h3>
                <TrendBadge trend={skill.trend} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Trung bình
                  </dt>
                  <dd className="mt-1 text-lg font-bold text-ink tabular-nums">
                    {formatProgressScore(skill.averageScore)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Gần đây
                  </dt>
                  <dd className="mt-1 text-lg font-bold text-ink tabular-nums">
                    {formatProgressScore(skill.recentScore)}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                {skill.sampleCount === 0
                  ? 'Chưa có dữ liệu đánh giá áp dụng cho kỹ năng này.'
                  : `${skill.sampleCount} phiên có dữ liệu · ${labelProgressTrend(
                      skill.trend.state
                    )}`}
              </p>
            </article>
          ))}
          </div>
        </Surface>
      </section>

      {/* Highlights Section */}
      <section className="grid gap-4 lg:grid-cols-2">
        <HighlightCard title="Điểm mạnh hiện tại" skill={strongestSkill} tone="strength" />
        <HighlightCard title="Cần chú ý" skill={attentionSkill} tone="attention" />
      </section>

      {/* Recent Evaluated Sessions */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-bold text-ink">Các phiên được đánh giá gần đây</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Mở lại kết quả chi tiết của từng phiên khi cần xem ngữ cảnh.
          </p>
        </div>

        {recentEvaluatedSessions.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-xs text-ink-muted">
            Chưa có phiên được đánh giá để hiển thị.
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-subtle/50 text-xs uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Khách hàng</th>
                    <th className="px-5 py-3.5 font-semibold">Thời điểm đánh giá</th>
                    <th className="px-5 py-3.5 font-semibold">Chế độ</th>
                    <th className="px-5 py-3.5 font-semibold">Điểm</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentEvaluatedSessions.map((session) => (
                    <tr
                      key={session.sessionId}
                      className="transition duration-150 hover:bg-surface-subtle/30"
                    >
                      <td className="px-5 py-4 font-bold text-ink">
                        {session.persona.displayName}
                      </td>
                      <td className="px-5 py-4 text-ink-secondary">
                        {formatProgressDate(session.evaluatedAt)}
                      </td>
                      <td className="px-5 py-4 text-ink-secondary">
                        {labelProgressMode(session.mode)}
                      </td>
                      <td className="px-5 py-4 font-bold text-ink tabular-nums text-sm">
                        {formatProgressScore(session.overallScore)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                          onClick={() => navigate(progressResultPath(session.sessionId))}
                        >
                          Xem kết quả
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile Stacked Cards */}
            <div className="space-y-3 md:hidden">
              {recentEvaluatedSessions.map((session) => (
                <Card key={session.sessionId} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink">
                        {session.persona.displayName}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                        <CalendarDays className="h-3 w-3" />
                        {formatProgressDate(session.evaluatedAt)}
                      </p>
                    </div>
                    <span className="text-base font-bold text-ink tabular-nums">
                      {formatProgressScore(session.overallScore)}
                    </span>
                  </div>

                  <p className="text-xs text-ink-secondary border-t border-border pt-2.5">
                    {labelProgressMode(session.mode)}
                  </p>

                  <Button
                    size="sm"
                    className="w-full"
                    variant="secondary"
                    icon={<ArrowUpRight className="h-3.5 w-3.5" />}
                    onClick={() => navigate(progressResultPath(session.sessionId))}
                  >
                    Xem kết quả
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Low-data encouragement note */}
      {isLowDataTrend(overallTrend.state) && !noEvaluations && (
        <p className="text-center text-xs text-ink-muted">
          Hãy hoàn thành thêm các phiên để xu hướng trở nên rõ ràng hơn.
        </p>
      )}
    </div>
  )
}
