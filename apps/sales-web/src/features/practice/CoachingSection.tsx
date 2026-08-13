import { AlertCircle, CheckCircle2, Lightbulb, LoaderCircle, Quote, RefreshCw, Sparkles, Target } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { trainingService } from '../../services/trainingService'
import type { CoachingResponse, EvaluationResponse } from '../../types/training'

export function CoachingSection({ sessionId, evaluationState }: { sessionId: string; evaluationState: EvaluationResponse['state'] | 'LOADING' }) {
  const [data, setData] = useState<CoachingResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (evaluationState !== 'COMPLETED') { setData(null); return }
    let active = true
    setLoading(true)
    trainingService.getCoaching(sessionId).then((value) => { if (active) setData(value) })
      .catch(() => { if (active) setError('Không thể tải trạng thái AI Coach.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [evaluationState, sessionId])

  const generate = async () => {
    setGenerating(true); setError('')
    try { setData(await trainingService.generateCoaching(sessionId)) }
    catch { setError('AI Coach chưa thể tạo gợi ý. Bạn có thể thử lại.') }
    finally { setGenerating(false) }
  }

  if (evaluationState !== 'COMPLETED') return <Card className="mt-6 p-6"><div className="flex items-start gap-3"><Lightbulb className="mt-0.5 h-5 w-5 text-slate-400" /><div><h2 className="font-extrabold text-slate-800">AI Coach</h2><p className="mt-1 text-sm leading-6 text-slate-500">Hãy phân tích kết quả trước để nhận gợi ý cải thiện dựa trên đánh giá đã lưu.</p></div></div></Card>
  if (loading) return <Card className="mt-6 p-6"><div className="flex items-center gap-3 text-sm font-semibold text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Đang tải trạng thái AI Coach...</div></Card>
  const coaching = data?.coaching
  if (!coaching || coaching.status === 'FAILED') return <Card className="mt-6 p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-violet-700"><Sparkles className="h-5 w-5" /><h2 className="text-lg font-extrabold">AI Coach</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Nhận gợi ý hành động dựa trên các ưu tiên do kết quả đánh giá xác định.</p>{(error || coaching?.status === 'FAILED') && <p role="alert" className="mt-2 flex items-center gap-2 text-sm font-semibold text-red-600"><AlertCircle className="h-4 w-4" />{error || 'Lần tạo gợi ý trước chưa thành công. Bạn có thể thử lại.'}</p>}</div><Button disabled={generating} icon={generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : coaching ? <RefreshCw className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />} onClick={generate}>{generating ? 'Đang tạo gợi ý...' : coaching ? 'Thử lại với AI Coach' : 'Nhận gợi ý từ AI Coach'}</Button></div></Card>

  return <Card className="mt-6 overflow-hidden"><div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white p-6"><div className="flex items-center gap-2 text-violet-700"><Sparkles className="h-5 w-5" /><p className="text-xs font-extrabold uppercase tracking-[0.14em]">AI Coach</p></div><h2 className="mt-2 text-2xl font-extrabold text-slate-950">Gợi ý cải thiện</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{coaching.summary}</p></div><div className="space-y-5 p-6"><div className="grid gap-4 lg:grid-cols-3">{coaching.priorities.map((priority, index) => <article key={priority.criterionKey} className={`rounded-2xl border p-5 ${priority.priorityKind === 'REFINEMENT' ? 'border-blue-100 bg-blue-50/40' : 'border-amber-100 bg-amber-50/40'}`}><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${priority.priorityKind === 'REFINEMENT' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{priority.priorityKind === 'REFINEMENT' ? 'Tinh chỉnh thêm' : `Ưu tiên ${index + 1}`}</span></div><h3 className="mt-3 font-extrabold text-slate-900">{priority.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{priority.observation}</p><p className="mt-3 text-sm font-semibold text-slate-800">Vì sao quan trọng</p><p className="mt-1 text-sm leading-6 text-slate-600">{priority.whyItMatters}</p><p className="mt-3 text-sm font-semibold text-slate-800">Hành động đề xuất</p><p className="mt-1 text-sm leading-6 text-slate-600">{priority.recommendedAction}</p>{priority.suggestedPhrasing && <div className="mt-4 rounded-xl bg-white p-3"><p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-violet-600"><Quote className="h-3.5 w-3.5" />Cách diễn đạt gợi ý</p><p className="mt-2 text-sm italic leading-6 text-slate-700">“{priority.suggestedPhrasing}”</p></div>}</article>)}</div>{coaching.strengthReinforcement && <section className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5"><h3 className="flex items-center gap-2 font-extrabold text-emerald-800"><CheckCircle2 className="h-5 w-5" />Tiếp tục duy trì</h3><p className="mt-2 text-sm leading-6 text-slate-600">{coaching.strengthReinforcement.message}</p></section>}<section><h3 className="flex items-center gap-2 font-extrabold text-slate-900"><Target className="h-5 w-5 text-violet-600" />Lần luyện tiếp theo hãy tập trung vào</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{coaching.nextPracticeFocus.map((item, index) => <p key={`${index}-${item}`} className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{item}</p>)}</div></section></div></Card>
}
