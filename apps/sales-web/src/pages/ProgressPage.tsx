import { ArrowRight, ArrowUpRight, BarChart3, CheckCircle2, ClipboardCheck, Compass, RefreshCw, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, LoadingState } from '../components/ui/Feedback'
import { trainingService } from '../services/trainingService'
import type { ProgressAnalytics, ProgressTrend, ProgressTrendState } from '../types/training'
import { formatProgressDate, formatProgressScore, isLowDataTrend, labelProgressMode, labelProgressTrend, progressResultPath } from '../utils/progressPresentation'

function trendTone(state: ProgressTrendState): string {
  if (state === 'IMPROVING') return 'bg-emerald-50 text-emerald-700'
  if (state === 'DECLINING') return 'bg-amber-50 text-amber-800'
  if (state === 'STABLE') return 'bg-blue-50 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

function TrendBadge({ trend }: { trend: ProgressTrend }) {
  return <Badge className={trendTone(trend.state)}>{labelProgressTrend(trend.state)}</Badge>
}

function TrendChart({ progress }: { progress: ProgressAnalytics }) {
  const points = progress.overallTrend.points.slice(0, 12)
  const width = 640
  const height = 220
  const padding = { top: 20, right: 22, bottom: 30, left: 34 }
  const x = (index: number) => points.length < 2 ? width / 2 : padding.left + index * ((width - padding.left - padding.right) / (points.length - 1))
  const y = (score: number) => padding.top + (100 - score) * ((height - padding.top - padding.bottom) / 100)
  const polyline = points.map((point, index) => `${x(index)},${y(point.score)}`).join(' ')
  const description = points.length === 0
    ? 'Chưa có điểm đánh giá để hiển thị biểu đồ.'
    : `${points.length} điểm đánh giá, từ ${formatProgressScore(points[0].score)} đến ${formatProgressScore(points[points.length - 1].score)} trên thang 100.`

  if (points.length === 0) return <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-7 text-center text-sm text-slate-500">Chưa có điểm đánh giá để hiển thị xu hướng.</div>

  return <div className="mt-5">
    <svg className="h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Biểu đồ xu hướng điểm. ${description}`}>
      <title>Biểu đồ xu hướng điểm theo các phiên được đánh giá</title>
      <desc>{description}</desc>
      <line x1={padding.left} x2={width - padding.right} y1={y(100)} y2={y(100)} stroke="#e2e8f0" />
      <line x1={padding.left} x2={width - padding.right} y1={y(50)} y2={y(50)} stroke="#e2e8f0" strokeDasharray="4 5" />
      <line x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} stroke="#e2e8f0" />
      <text x="4" y={y(100) + 4} fill="#64748b" fontSize="11">100</text><text x="10" y={y(50) + 4} fill="#64748b" fontSize="11">50</text><text x="16" y={y(0) + 4} fill="#64748b" fontSize="11">0</text>
      {points.length > 1 && <polyline fill="none" points={polyline} stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((point, index) => <g key={`${point.sessionId}-${point.evaluatedAt}`}><circle cx={x(index)} cy={y(point.score)} r="5" fill="white" stroke="#2563eb" strokeWidth="3" /><title>{`Điểm ${formatProgressScore(point.score)} · ${formatProgressDate(point.evaluatedAt)}`}</title></g>)}
    </svg>
    <p className="mt-2 text-xs leading-5 text-slate-500">{description} Trục điểm cố định từ 0 đến 100.</p>
  </div>
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: ReactNode }) {
  return <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{value}</p>{detail && <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>}</div><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">{icon}</div></div></Card>
}

function HighlightCard({ title, skill, tone }: { title: string; skill: ProgressAnalytics['skills'][number] | undefined; tone: 'strength' | 'attention' }) {
  const icon = tone === 'strength' ? <Sparkles className="h-5 w-5" /> : <Target className="h-5 w-5" />
  const classes = tone === 'strength' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
  return <Card className="p-5"><div className="flex items-center gap-3"><div className={`rounded-xl p-2.5 ${classes}`}>{icon}</div><div><h3 className="font-extrabold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-500">{skill ? skill.label : 'Chưa đủ dữ liệu để xác định.'}</p></div></div>{skill && <p className="mt-4 text-sm text-slate-600">Điểm trung bình: <span className="font-extrabold text-slate-900">{formatProgressScore(skill.averageScore)}</span> · {skill.sampleCount} phiên có dữ liệu</p>}</Card>
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
    trainingService.getProgress().then((value) => { if (active) setProgress(value) }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => load(), [load])

  const header = <PageHeader eyebrow="Progress analytics" title="Tiến độ luyện tập" description="Theo dõi kết quả từ các phiên đã hoàn thành và được hệ thống đánh giá." />
  if (loading) return <>{header}<LoadingState label="Đang tải tiến độ luyện tập..." /></>
  if (error || !progress) return <>{header}<Card className="p-7 text-center"><p role="alert" className="text-sm font-semibold text-red-700">Không thể tải tiến độ luyện tập lúc này.</p><p className="mt-2 text-sm text-slate-500">Hãy thử tải lại sau ít phút.</p><Button className="mt-5" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={load}>Thử tải lại</Button></Card></>
  if (progress.summary.totalSessions === 0) return <>{header}<EmptyState title="Bạn chưa có phiên luyện tập" description="Bắt đầu một phiên để dữ liệu tiến độ xuất hiện tại đây." /><div className="mt-5 text-center"><Button icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/customers')}>Bắt đầu luyện tập</Button></div></>

  const { summary, overallTrend, skills, highlights, recentEvaluatedSessions } = progress
  const strongestSkill = skills.find((skill) => skill.criterionKey === highlights.strongestSkillKey)
  const attentionSkill = skills.find((skill) => skill.criterionKey === highlights.needsAttentionSkillKey)
  const noEvaluations = summary.evaluatedSessions === 0

  return <>
    {header}
    <section aria-label="Tóm tắt tiến độ" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Tổng số phiên" value={String(summary.totalSessions)} icon={<Compass className="h-5 w-5" />} /><SummaryCard label="Phiên đã hoàn thành" value={String(summary.completedSessions)} icon={<CheckCircle2 className="h-5 w-5" />} /><SummaryCard label="Phiên đã đánh giá" value={String(summary.evaluatedSessions)} icon={<ClipboardCheck className="h-5 w-5" />} /><SummaryCard label="Điểm trung bình" value={formatProgressScore(summary.averageOverallScore)} detail={summary.recentAverageScore === null ? 'Chưa có điểm gần đây' : `Gần đây: ${formatProgressScore(summary.recentAverageScore)}`} icon={<BarChart3 className="h-5 w-5" />} /></section>
    <p className="mt-3 text-sm text-slate-500">Tần suất luyện tập: <span className="font-bold text-slate-700">{summary.trainingFrequency.completedSessions} phiên / {summary.trainingFrequency.windowDays} ngày</span> · {formatProgressScore(summary.trainingFrequency.averagePerWeek)} phiên / tuần.</p>

    {noEvaluations && <Card className="mt-6 border-dashed p-6"><div className="flex gap-3"><ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><div><h2 className="font-extrabold text-slate-900">Chưa có phiên được đánh giá</h2><p className="mt-1 text-sm leading-6 text-slate-500">Các phiên đã hoàn thành sẽ xuất hiện trong phân tích sau khi có kết quả đánh giá. Trang này không tự động tạo đánh giá.</p></div></div></Card>}

    <section className="mt-7"><Card className="p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-lg font-extrabold text-slate-950">Xu hướng điểm</h2><p className="mt-1 text-sm leading-6 text-slate-500">Dựa trên các phiên đã được đánh giá, theo thứ tự thời gian.</p></div><TrendBadge trend={overallTrend} /></div><div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600"><span>{overallTrend.sampleCount} phiên có dữ liệu</span>{overallTrend.delta !== null && <span className="inline-flex items-center gap-1 font-semibold">{overallTrend.delta > 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : overallTrend.delta < 0 ? <TrendingDown className="h-4 w-4 text-amber-700" /> : <BarChart3 className="h-4 w-4 text-blue-600" />}{overallTrend.delta > 0 ? '+' : ''}{formatProgressScore(overallTrend.delta)} điểm so với nhóm phiên trước</span>}</div><TrendChart progress={progress} /></Card></section>

    <section className="mt-7"><div className="mb-4"><h2 className="text-lg font-extrabold text-slate-950">Kỹ năng</h2><p className="mt-1 text-sm text-slate-500">Mỗi kỹ năng dùng dữ liệu đánh giá do backend cung cấp.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{skills.map((skill) => <Card key={skill.criterionKey} className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-extrabold text-slate-900">{skill.label}</h3><TrendBadge trend={skill.trend} /></div><dl className="mt-5 grid grid-cols-2 gap-4"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trung bình</dt><dd className="mt-1 text-xl font-extrabold text-slate-950">{formatProgressScore(skill.averageScore)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gần đây</dt><dd className="mt-1 text-xl font-extrabold text-slate-950">{formatProgressScore(skill.recentScore)}</dd></div></dl><p className="mt-4 text-xs leading-5 text-slate-500">{skill.sampleCount === 0 ? 'Chưa có dữ liệu đánh giá áp dụng cho kỹ năng này.' : `${skill.sampleCount} phiên có dữ liệu · ${labelProgressTrend(skill.trend.state)}`}</p></Card>)}</div></section>

    <section className="mt-7 grid gap-4 lg:grid-cols-2"><HighlightCard title="Điểm mạnh hiện tại" skill={strongestSkill} tone="strength" /><HighlightCard title="Cần chú ý" skill={attentionSkill} tone="attention" /></section>

    <section className="mt-7"><div className="mb-4"><h2 className="text-lg font-extrabold text-slate-950">Các phiên được đánh giá gần đây</h2><p className="mt-1 text-sm text-slate-500">Mở lại kết quả chi tiết của từng phiên khi cần xem ngữ cảnh.</p></div>{recentEvaluatedSessions.length === 0 ? <Card className="border-dashed p-7 text-center text-sm text-slate-500">Chưa có phiên được đánh giá để hiển thị.</Card> : <><Card className="hidden overflow-hidden md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-bold">Khách hàng</th><th className="px-5 py-3 font-bold">Thời điểm đánh giá</th><th className="px-5 py-3 font-bold">Chế độ</th><th className="px-5 py-3 font-bold">Điểm</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{recentEvaluatedSessions.map((session) => <tr key={session.sessionId}><td className="px-5 py-4 font-bold text-slate-900">{session.persona.displayName}</td><td className="px-5 py-4 text-slate-600">{formatProgressDate(session.evaluatedAt)}</td><td className="px-5 py-4 text-slate-600">{labelProgressMode(session.mode)}</td><td className="px-5 py-4 font-extrabold text-slate-950">{formatProgressScore(session.overallScore)}</td><td className="px-5 py-4 text-right"><Button className="min-h-9 px-3 py-1.5" variant="secondary" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => navigate(progressResultPath(session.sessionId))}>Xem kết quả</Button></td></tr>)}</tbody></table></Card><div className="space-y-3 md:hidden">{recentEvaluatedSessions.map((session) => <Card key={session.sessionId} className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{session.persona.displayName}</h3><p className="mt-1 text-xs text-slate-500">{formatProgressDate(session.evaluatedAt)}</p></div><p className="text-lg font-extrabold text-slate-950">{formatProgressScore(session.overallScore)}</p></div><p className="mt-3 text-sm text-slate-600">{labelProgressMode(session.mode)}</p><Button className="mt-4 w-full" variant="secondary" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => navigate(progressResultPath(session.sessionId))}>Xem kết quả</Button></Card>)}</div></>}</section>
    {isLowDataTrend(overallTrend.state) && !noEvaluations && <p className="mt-6 text-center text-sm text-slate-500">Hãy hoàn thành thêm các phiên để xu hướng trở nên rõ ràng hơn.</p>}
  </>
}
