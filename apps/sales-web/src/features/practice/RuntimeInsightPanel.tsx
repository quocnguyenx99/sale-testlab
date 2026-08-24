import { Check, Circle, CircleDotDashed, Compass } from 'lucide-react'
import type { RuntimeInsight } from '../../types/training'
import {
  labelCustomerState,
  labelOutcome,
  labelTopic,
  labelTrainingStatus,
} from '../../utils/trainingLabels'

export function RuntimeInsightPanel({ insight }: { insight: RuntimeInsight }) {
  const progress =
    insight.topicProgress.total > 0
      ? (insight.topicProgress.resolved / insight.topicProgress.total) * 100
      : 0

  return (
    <div className="space-y-5">
      {/* Customer State Overview */}
      <div className="rounded-xl border border-border bg-surface-subtle p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
          <CircleDotDashed className="h-4 w-4" />
          Trạng thái khách hàng
        </div>
        <p className="mt-1.5 font-bold text-sm text-ink">
          {labelCustomerState(insight.runtimeState)}
        </p>
        {insight.activeProduct ? (
          <div className="mt-2.5 rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Sản phẩm quan tâm
            </p>
            <p className="mt-0.5 text-xs font-bold text-ink">{insight.activeProduct.model}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">Chưa xác định sản phẩm đang trao đổi.</p>
        )}
      </div>

      {/* Topic Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">Tiến độ chủ đề</span>
          <span className="font-bold text-brand tabular-nums">
            {insight.topicProgress.resolved} / {insight.topicProgress.total}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Resolved Topics */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Chủ đề đã trao đổi
        </p>
        <div className="mt-2 space-y-1.5">
          {insight.resolvedTopics.length ? (
            insight.resolvedTopics.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs font-medium text-ink">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span>{labelTopic(item)}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-ink-muted">Chưa có chủ đề được xác nhận.</p>
          )}
        </div>
      </div>

      {/* Missing Topics */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Chủ đề còn lại
        </p>
        {insight.missingTopics.length ? (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {insight.missingTopics.map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-xs text-ink-secondary">
                <Circle className="h-3 w-3 text-ink-muted shrink-0" />
                <span className="truncate">{labelTopic(item)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">
            Không còn chủ đề nào được ghi nhận là đang thiếu.
          </p>
        )}
      </div>

      {/* Next Unresolved Topic Suggestion */}
      {insight.nextUnresolvedTopic && (
        <div className="rounded-lg border border-brand-border/70 bg-brand-soft/40 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
            <Compass className="h-3.5 w-3.5" />
            Chủ đề nên khai thác tiếp
          </div>
          <p className="mt-1 text-xs font-bold text-ink">
            {labelTopic(insight.nextUnresolvedTopic)}
          </p>
        </div>
      )}

      {/* Status Summary */}
      <dl className="divide-y divide-border rounded-lg border border-border px-3 text-xs">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-ink-secondary">Trạng thái hội thoại</dt>
          <dd className="font-semibold text-amber-700">{labelOutcome(insight.dealOutcome)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-ink-secondary">Trạng thái luyện tập</dt>
          <dd className="font-semibold text-brand">{labelTrainingStatus(insight.trainingStatus)}</dd>
        </div>
      </dl>

      <p className="text-xs leading-relaxed text-ink-muted">
        Thông tin này phản ánh tiến trình hội thoại hiện tại, không phải điểm đánh giá hoặc gợi ý
        coaching.
      </p>
    </div>
  )
}
