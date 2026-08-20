import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { trainingService } from '../../services/trainingService'
import type { EvaluationResponse, SessionEvaluation } from '../../types/training'

export function EvaluationSection({
  sessionId,
  onStateChange,
}: {
  sessionId: string
  onStateChange?: (state: EvaluationResponse['state'], evaluation: SessionEvaluation | null) => void
}) {
  const [data, setData] = useState<EvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    trainingService
      .getEvaluation(sessionId)
      .then((value) => {
        if (active) {
          setData(value)
          onStateChange?.(value.state, value.evaluation)
        }
      })
      .catch(() => {
        if (active) setError('Không thể tải trạng thái đánh giá lúc này.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [onStateChange, sessionId])

  const evaluate = async () => {
    setEvaluating(true)
    setError('')
    try {
      const value = await trainingService.evaluateSession(sessionId)
      setData(value)
      onStateChange?.(value.state, value.evaluation)
    } catch {
      setError('Đánh giá chưa thành công. Bạn có thể thử lại.')
    } finally {
      setEvaluating(false)
    }
  }

  if (loading) {
    return (
      <Card className="mt-6 p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-ink-secondary">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand" />
          <span>Đang tải trạng thái đánh giá...</span>
        </div>
      </Card>
    )
  }

  const evaluation = data?.evaluation

  if (!evaluation || evaluation.status === 'FAILED') {
    return (
      <Card className="mt-6 p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Đánh giá kỹ năng
            </div>
            <h3 className="mt-2 text-base font-bold text-ink">Phân tích kỹ năng bán hàng</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-secondary">
              Đánh giá dựa trên rubric có cấu trúc, tách biệt độc lập với kết quả phân loại hội thoại.
            </p>
            {(error || evaluation?.status === 'FAILED') && (
              <p
                role="alert"
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error || 'Lần đánh giá trước chưa thành công. Bạn có thể thử lại.'}
              </p>
            )}
          </div>
          <Button
            size="md"
            disabled={evaluating}
            icon={
              evaluating ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : evaluation ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <BarChart3 className="h-4 w-4" />
              )
            }
            onClick={evaluate}
          >
            {evaluating
              ? 'Đang đánh giá...'
              : evaluation
                ? 'Thử đánh giá lại'
                : 'Đánh giá phiên luyện tập'}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mt-6 overflow-hidden">
      {/* Header Banner with Overall Score */}
      <div className="border-b border-border bg-gradient-to-r from-brand-soft/40 via-surface to-surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Đánh giá kỹ năng
            </div>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">
              Kết quả đánh giá phiên
            </h3>
            <p className="mt-1 text-xs text-ink-secondary">
              Điểm tổng hợp theo rubric năng lực tư vấn bán hàng.
            </p>
          </div>
          <div className="flex items-baseline gap-1 rounded-xl border border-border bg-surface px-5 py-3 shadow-subtle shrink-0">
            <span className="text-3xl font-bold tracking-tight text-brand tabular-nums">
              {evaluation.overallScore}
            </span>
            <span className="text-xs font-bold text-ink-muted">/100</span>
          </div>
        </div>
      </div>

      {/* Criteria & Strengths/Improvements Grid */}
      <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr]">
        {/* Dynamic Criteria List (renders whatever backend returns) */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Tiêu chí đánh giá
          </p>
          <div className="space-y-2.5">
            {evaluation.criteria.map((criterion) => {
              const isApplicable = criterion.applicability === 'APPLICABLE'
              return (
                <div
                  key={criterion.key}
                  className="rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ink">{criterion.label}</p>
                    {isApplicable ? (
                      <span className="text-sm font-bold text-brand tabular-nums">
                        {criterion.score}/100
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-ink-muted">Không áp dụng</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    {criterion.summary}
                  </p>
                  {criterion.evidenceTurnSequences && criterion.evidenceTurnSequences.length > 0 && (
                    <p className="mt-2 text-[11px] text-ink-muted">
                      Lượt trao đổi liên quan:{' '}
                      <span className="font-semibold text-ink-secondary">
                        {criterion.evidenceTurnSequences.map((seq) => `#${seq}`).join(', ')}
                      </span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Strengths & Improvement Areas */}
        <div className="space-y-5 border-t border-border pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          <Observation
            title="Điểm làm tốt"
            items={evaluation.strengths}
            positive
            emptyMessage="Chưa có điểm nổi bật cụ thể."
          />
          <div className="border-t border-border pt-5" />
          <Observation
            title="Cần cải thiện"
            items={evaluation.improvementAreas}
            positive={false}
            emptyMessage="Không có điểm cần khắc phục đáng kể."
          />
        </div>
      </div>
    </Card>
  )
}

function Observation({
  title,
  items,
  positive = false,
  emptyMessage,
}: {
  title: string
  items: string[]
  positive?: boolean
  emptyMessage: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</p>
      <div className="mt-2.5 space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${index}-${item}`} className="flex items-start gap-2.5 text-xs leading-relaxed text-ink">
              {positive ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              )}
              <span>{item}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-ink-muted">{emptyMessage}</p>
        )}
      </div>
    </div>
  )
}
