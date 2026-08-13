import { AlertCircle, BarChart3, CheckCircle2, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { trainingService } from '../../services/trainingService'
import type { EvaluationResponse, SessionEvaluation } from '../../types/training'

export function EvaluationSection({ sessionId, onStateChange }: { sessionId: string; onStateChange?: (state: EvaluationResponse['state'], evaluation: SessionEvaluation | null) => void }) {
  const [data, setData] = useState<EvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    trainingService.getEvaluation(sessionId).then((value) => { if (active) { setData(value); onStateChange?.(value.state, value.evaluation) } })
      .catch(() => { if (active) setError('Không thể tải trạng thái đánh giá.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onStateChange, sessionId])

  const evaluate = async () => {
    setEvaluating(true); setError('')
    try { const value = await trainingService.evaluateSession(sessionId); setData(value); onStateChange?.(value.state, value.evaluation) }
    catch { setError('Phân tích chưa thành công. Bạn có thể thử lại.') }
    finally { setEvaluating(false) }
  }

  if (loading) return <Card className="mt-6 p-6"><div className="flex items-center gap-3 text-sm font-semibold text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Đang tải trạng thái đánh giá...</div></Card>
  const evaluation = data?.evaluation
  if (!evaluation || evaluation.status === 'FAILED') return <Card className="mt-6 p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-blue-700"><Sparkles className="h-5 w-5" /><h2 className="text-lg font-extrabold">Đánh giá kỹ năng</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Phân tích theo rubric có cấu trúc, tách biệt với kết quả hội thoại hiện có.</p>{(error || evaluation?.status === 'FAILED') && <p role="alert" className="mt-2 flex items-center gap-2 text-sm font-semibold text-red-600"><AlertCircle className="h-4 w-4" />{error || 'Lần phân tích trước chưa thành công. Bạn có thể thử lại.'}</p>}</div><Button disabled={evaluating} icon={evaluating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : evaluation ? <RefreshCw className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />} onClick={evaluate}>{evaluating ? 'Đang phân tích...' : evaluation ? 'Thử phân tích lại' : 'Phân tích kết quả'}</Button></div></Card>

  return <Card className="mt-6 overflow-hidden"><div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-600">Đánh giá kỹ năng</p><h2 className="mt-1 text-2xl font-extrabold text-slate-950">Kết quả phân tích</h2></div><div className="flex items-baseline gap-1 rounded-2xl bg-white px-5 py-3 shadow-sm"><span className="text-4xl font-black text-blue-700">{evaluation.overallScore}</span><span className="font-bold text-slate-400">/100</span></div></div></div><div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr]"><div className="space-y-3">{evaluation.criteria.map((criterion) => <div key={criterion.key} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><p className="font-extrabold text-slate-900">{criterion.label}</p>{criterion.applicability === 'APPLICABLE' ? <span className="font-black text-blue-700">{criterion.score}/100</span> : <span className="text-xs font-bold text-slate-400">Không áp dụng</span>}</div><p className="mt-2 text-sm leading-6 text-slate-500">{criterion.summary}</p></div>)}</div><div className="space-y-5"><Observation title="Điểm mạnh" items={evaluation.strengths} positive /><Observation title="Cần cải thiện" items={evaluation.improvementAreas} /></div></div></Card>
}

function Observation({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return <div><h3 className="font-extrabold text-slate-900">{title}</h3><div className="mt-3 space-y-2">{items.length ? items.map((item, index) => <p key={`${index}-${item}`} className="flex gap-2 text-sm leading-6 text-slate-600"><CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${positive ? 'text-emerald-600' : 'text-amber-600'}`} />{item}</p>) : <p className="text-sm text-slate-400">Chưa có nhận xét phù hợp.</p>}</div></div>
}
