import {
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  LoaderCircle,
  Quote,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { trainingService } from '../../services/trainingService'
import type { CoachingResponse, EvaluationResponse } from '../../types/training'

export function CoachingSection({
  sessionId,
  evaluationState,
}: {
  sessionId: string
  evaluationState: EvaluationResponse['state'] | 'LOADING'
}) {
  const [data, setData] = useState<CoachingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (evaluationState !== 'COMPLETED') {
      setData(null)
      return
    }
    let active = true
    setLoading(true)
    trainingService
      .getCoaching(sessionId)
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) setError('Không thể tải trạng thái AI Coach.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [evaluationState, sessionId])

  const generate = async () => {
    setGenerating(true)
    setError('')
    try {
      setData(await trainingService.generateCoaching(sessionId))
    } catch {
      setError('AI Coach chưa thể tạo gợi ý lúc này. Bạn có thể thử lại.')
    } finally {
      setGenerating(false)
    }
  }

  if (evaluationState !== 'COMPLETED') {
    return (
      <Card className="mt-6 p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface-subtle text-ink-muted shrink-0">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">AI Coach</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              Hãy đánh giá phiên luyện tập trước để mở khóa gợi ý cải thiện hành động dựa trên kết quả
              thực tế.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="mt-6 p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-ink-secondary">
          <LoaderCircle className="h-5 w-5 animate-spin text-brand" />
          <span>Đang tải trạng thái AI Coach...</span>
        </div>
      </Card>
    )
  }

  const coaching = data?.coaching

  if (!coaching || coaching.status === 'FAILED') {
    return (
      <Card className="mt-6 p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              AI Coach
            </div>
            <h3 className="mt-2 text-base font-bold text-ink">Gợi ý hành động từ AI Coach</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-secondary">
              Nhận phân tích ưu tiên hành động và ví dụ diễn đạt cụ thể dựa trên kết quả đánh giá.
            </p>
            {(error || coaching?.status === 'FAILED') && (
              <p
                role="alert"
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error || 'Lần tạo gợi ý trước chưa thành công. Bạn có thể thử lại.'}
              </p>
            )}
          </div>
          <Button
            size="md"
            disabled={generating}
            icon={
              generating ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : coaching ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )
            }
            onClick={generate}
          >
            {generating
              ? 'Đang tạo gợi ý...'
              : coaching
                ? 'Thử lại với AI Coach'
                : 'Nhận gợi ý từ AI Coach'}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mt-6 overflow-hidden">
      {/* Header Banner */}
      <div className="border-b border-border bg-gradient-to-r from-brand-soft/40 via-surface to-surface p-6">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-border bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
          <Sparkles className="h-3.5 w-3.5" />
          AI Coach
        </div>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">
          Gợi ý cải thiện từ AI Coach
        </h3>
        {coaching.summary && (
          <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-ink-secondary">
            {coaching.summary}
          </p>
        )}
      </div>

      <div className="space-y-6 p-6">
        {/* Authoritative Priority Cards */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
            Ưu tiên hành động
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {coaching.priorities.map((priority, index) => {
              const isRefinement = priority.priorityKind === 'REFINEMENT'
              return (
                <article
                  key={priority.criterionKey}
                  className={`flex flex-col justify-between rounded-xl border p-5 transition-colors ${
                    isRefinement
                      ? 'border-brand-border/60 bg-brand-soft/20'
                      : 'border-amber-200/70 bg-amber-50/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          isRefinement
                            ? 'bg-brand-soft text-brand'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isRefinement ? 'Tinh chỉnh thêm' : `Ưu tiên ${index + 1}`}
                      </span>
                    </div>

                    <h4 className="mt-3 text-sm font-bold text-ink">{priority.title}</h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                      {priority.observation}
                    </p>

                    <div className="mt-3 border-t border-border/50 pt-2.5">
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                        Vì sao quan trọng
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
                        {priority.whyItMatters}
                      </p>
                    </div>

                    <div className="mt-3 border-t border-border/50 pt-2.5">
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                        Hành động đề xuất
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
                        {priority.recommendedAction}
                      </p>
                    </div>
                  </div>

                  {priority.suggestedPhrasing && (
                    <div className="mt-4 rounded-lg border border-brand-border/70 bg-surface p-3 shadow-subtle">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                        <Quote className="h-3 w-3" />
                        Cách diễn đạt mẫu
                      </p>
                      <p className="mt-1 text-xs italic leading-relaxed text-ink">
                        “{priority.suggestedPhrasing}”
                      </p>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>

        {/* Strength Reinforcement */}
        {coaching.strengthReinforcement && (
          <section className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Tiếp tục duy trì
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-950">
              {coaching.strengthReinforcement.message}
            </p>
          </section>
        )}

        {/* Next Practice Focus */}
        {coaching.nextPracticeFocus && coaching.nextPracticeFocus.length > 0 && (
          <section>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <Target className="h-4 w-4 text-brand" />
              Lần luyện tập tiếp theo hãy tập trung vào
            </div>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              {coaching.nextPracticeFocus.map((item, index) => (
                <div
                  key={`${index}-${item}`}
                  className="rounded-lg border border-border bg-surface-subtle p-3 text-xs leading-relaxed text-ink font-medium"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Card>
  )
}
