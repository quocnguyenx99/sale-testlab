import { Check, Circle, CircleDotDashed } from 'lucide-react'
import type { RuntimeInsight } from '../../types/training'

const topicLabels: Record<string, string> = {
  product_model: 'Sản phẩm', configuration: 'Cấu hình', price: 'Giá', stock: 'Tồn kho', delivery: 'Giao hàng', warranty: 'Bảo hành', payment: 'Thanh toán', invoice_or_document: 'Hóa đơn / tài liệu', next_step: 'Bước tiếp theo',
}
const stateLabels: Record<string, string> = {
  greeting: 'Mở đầu hội thoại', discovery: 'Đang khám phá nhu cầu', discovery_phase: 'Đang khám phá nhu cầu', product_discussion: 'Trao đổi sản phẩm', pricing_phase: 'Thảo luận về giá', objection_handling: 'Xử lý băn khoăn', logistics_phase: 'Trao đổi giao nhận', closing_phase: 'Đang chốt bước tiếp theo', auto_state: 'Đang xác định ngữ cảnh',
}
const labelTopic = (topic: string) => topicLabels[topic] ?? topic.replaceAll('_', ' ')

export function RuntimeInsightPanel({ insight }: { insight: RuntimeInsight }) {
  const progress = insight.topicProgress.total > 0 ? (insight.topicProgress.resolved / insight.topicProgress.total) * 100 : 0
  return <div>
    <div className="rounded-2xl bg-blue-50 p-4">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.13em] text-blue-600"><CircleDotDashed className="h-4 w-4" />Runtime state · Real</div>
      <p className="mt-2 font-extrabold text-slate-900">{stateLabels[insight.runtimeState] ?? insight.runtimeState}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{insight.runtimeState}</p>
      {insight.activeProduct && <div className="mt-3 rounded-xl bg-white/80 px-3 py-2"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Sản phẩm hiện tại</p><p className="mt-1 text-xs font-bold text-slate-700">{insight.activeProduct.model}</p><p className="text-[10px] text-slate-500">{insight.activeProduct.code}</p></div>}
    </div>
    <div className="mt-6"><div className="flex items-center justify-between text-sm"><span className="font-bold text-slate-800">Tiến độ chủ đề</span><span className="font-extrabold text-blue-600">{insight.topicProgress.resolved} / {insight.topicProgress.total}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div></div>
    <div className="mt-6"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Đã biết</p><div className="mt-3 space-y-2">{insight.resolvedTopics.length ? insight.resolvedTopics.map((item) => <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-3 w-3" /></span>{labelTopic(item)}</div>) : <p className="text-sm text-slate-500">Chưa có chủ đề được xác nhận.</p>}</div></div>
    <div className="mt-6"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Còn thiếu</p><div className="mt-3 grid grid-cols-2 gap-2">{insight.missingTopics.map((item) => <div key={item} className="flex items-center gap-2 text-sm text-slate-500"><Circle className="h-4 w-4" />{labelTopic(item)}</div>)}</div></div>
    <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3"><span className="text-sm font-bold text-slate-700">Trạng thái deal</span><span className="text-xs font-extrabold text-amber-700">{insight.dealOutcome}</span></div>
    <p className="mt-4 text-xs leading-5 text-slate-400">Dữ liệu deterministic từ runtime hiện tại. Không phải gợi ý coaching hoặc điểm evaluator.</p>
  </div>
}
