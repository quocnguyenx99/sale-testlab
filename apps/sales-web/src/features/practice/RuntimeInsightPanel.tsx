import { Check, Circle, CircleDotDashed, Compass } from 'lucide-react'
import type { RuntimeInsight } from '../../types/training'
import { labelCustomerState, labelOutcome, labelTopic, labelTrainingStatus } from '../../utils/trainingLabels'

export function RuntimeInsightPanel({ insight }: { insight: RuntimeInsight }) {
  const progress = insight.topicProgress.total > 0 ? (insight.topicProgress.resolved / insight.topicProgress.total) * 100 : 0
  return <div>
    <div className="rounded-2xl bg-blue-50 p-4">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.13em] text-blue-600"><CircleDotDashed className="h-4 w-4" />Trạng thái khách hàng</div>
      <p className="mt-2 font-extrabold text-slate-900">{labelCustomerState(insight.runtimeState)}</p>
      {insight.activeProduct ? <div className="mt-3 rounded-xl bg-white/80 px-3 py-2"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Sản phẩm hiện tại</p><p className="mt-1 text-sm font-bold text-slate-700">{insight.activeProduct.model}</p></div> : <p className="mt-3 text-xs text-slate-500">Chưa xác định sản phẩm đang trao đổi.</p>}
    </div>

    <div className="mt-6"><div className="flex items-center justify-between text-sm"><span className="font-bold text-slate-800">Tiến độ chủ đề</span><span className="font-extrabold text-blue-600">{insight.topicProgress.resolved} / {insight.topicProgress.total}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div></div>

    <div className="mt-6"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Chủ đề đã trao đổi</p><div className="mt-3 space-y-2">{insight.resolvedTopics.length ? insight.resolvedTopics.map((item) => <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-3 w-3" /></span>{labelTopic(item)}</div>) : <p className="text-sm text-slate-500">Chưa có chủ đề được xác nhận.</p>}</div></div>

    <div className="mt-6"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Chủ đề còn lại</p>{insight.missingTopics.length ? <div className="mt-3 grid grid-cols-2 gap-2">{insight.missingTopics.map((item) => <div key={item} className="flex items-center gap-2 text-sm text-slate-500"><Circle className="h-4 w-4" />{labelTopic(item)}</div>)}</div> : <p className="mt-3 text-sm text-slate-500">Không còn chủ đề nào được ghi nhận là đang thiếu.</p>}</div>

    {insight.nextUnresolvedTopic && <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3"><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-blue-600"><Compass className="h-4 w-4" />Chủ đề nên khám phá</div><p className="mt-2 text-sm font-bold text-slate-800">{labelTopic(insight.nextUnresolvedTopic)}</p></div>}

    <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 px-3"><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm font-bold text-slate-700">Trạng thái hội thoại</dt><dd className="text-right text-xs font-extrabold text-amber-700">{labelOutcome(insight.dealOutcome)}</dd></div><div className="flex items-center justify-between gap-4 py-3"><dt className="text-sm font-bold text-slate-700">Trạng thái luyện tập</dt><dd className="text-right text-xs font-extrabold text-blue-700">{labelTrainingStatus(insight.trainingStatus)}</dd></div></dl>
    <p className="mt-4 text-xs leading-5 text-slate-400">Thông tin này phản ánh tiến trình hội thoại hiện tại, không phải điểm đánh giá hoặc gợi ý coaching.</p>
  </div>
}
