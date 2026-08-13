import { ArrowRight, Check, CheckCircle2, Circle, History, Home, RotateCcw, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTraining } from '../app/TrainingContext'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingState } from '../components/ui/Feedback'
import { EvaluationSection } from '../features/practice/EvaluationSection'
import { labelMode, labelOutcome, labelSignal, labelTopic, labelTrainingStatus } from '../utils/trainingLabels'

export function SessionResultPage() {
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  const { session, loadSession } = useTraining()
  const [loading, setLoading] = useState(session?.id !== sessionId)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId || session?.id === sessionId) { setLoading(false); return }
    loadSession(sessionId).then(() => setError('')).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải kết quả phiên.')).finally(() => setLoading(false))
  }, [loadSession, session?.id, sessionId])

  if (loading) return <LoadingState label="Đang tải kết quả phiên..." />
  if (!session || session.id !== sessionId) return <Card className="mx-auto max-w-lg p-6 text-center"><h1 className="font-extrabold">Không thể tải kết quả</h1><p role="alert" className="mt-2 text-sm text-red-600">{error || 'Phiên không tồn tại hoặc bạn không có quyền truy cập.'}</p><Button className="mt-5" onClick={() => navigate('/dashboard')}>Về trang chủ</Button></Card>
  if (session.status === 'RUNNING') return <Card className="mx-auto max-w-lg p-6 text-center"><h1 className="text-xl font-extrabold">Phiên vẫn đang hoạt động</h1><p className="mt-2 text-sm text-slate-500">Hãy tiếp tục hội thoại hoặc kết thúc phiên trước khi xem kết quả.</p><Button className="mt-5" onClick={() => navigate(`/practice/${session.id}`)}>Tiếp tục luyện tập</Button></Card>
  if (!session.result) return <Card className="mx-auto max-w-lg p-6 text-center"><h1 className="text-xl font-extrabold">Kết quả chưa sẵn sàng</h1><p className="mt-2 text-sm text-slate-500">Phiên đã hoàn thành nhưng chưa có dữ liệu tổng kết đáng tin cậy.</p><Button className="mt-5" onClick={() => navigate('/dashboard')}>Về trang chủ</Button></Card>

  const { persona, mode, result } = session
  const duration = result.durationSeconds < 60 ? `${result.durationSeconds} giây` : `${Math.floor(result.durationSeconds / 60)} phút ${result.durationSeconds % 60} giây`
  return <div className="mx-auto max-w-5xl">
    <div className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div><p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600">Phiên đã hoàn thành</p><h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Tổng kết phiên luyện tập</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">Kết quả hội thoại và đánh giá kỹ năng được trình bày riêng để bạn dễ theo dõi.</p></div>
    <div className="mt-8 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-5"><Card className="p-5"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Khách hàng</p><div className="mt-4 flex items-center gap-4"><Avatar initials={persona.initials} color={persona.color} size="lg" /><div><h2 className="text-xl font-extrabold text-slate-950">{persona.displayName}</h2><p className="font-semibold text-blue-700">{persona.role}</p><p className="text-sm text-slate-500">{persona.customerType}</p></div></div></Card><Card className="p-5"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Tóm tắt phiên</p><dl className="mt-4 space-y-3 text-sm"><SummaryRow label="Lượt trao đổi của bạn" value={String(result.turnCount)} /><SummaryRow label="Thời lượng" value={duration} /><SummaryRow label="Chế độ" value={labelMode(mode)} /></dl></Card></div>
      <div className="space-y-5"><Card className="overflow-hidden"><div className="border-b border-slate-100 p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Kết quả hội thoại</p><h2 className="mt-2 text-xl font-extrabold text-slate-950">{labelOutcome(result.outcome)}</h2></div><Badge className="bg-emerald-50 text-emerald-700">{labelTrainingStatus(result.trainingStatus)}</Badge></div><p className="mt-3 text-sm leading-6 text-slate-500">Đây là trạng thái phân loại từ dữ liệu phiên, độc lập với điểm đánh giá kỹ năng.</p></div><div className="grid sm:grid-cols-2"><TopicList title="Chủ đề đã trao đổi" items={result.resolvedTopics} resolved /><TopicList title="Chủ đề còn lại" items={result.missingTopics} /></div></Card><Card className="p-5"><p className="text-sm font-extrabold text-slate-800">Tín hiệu an toàn đã ghi nhận</p><div className="mt-4 flex flex-wrap gap-2">{result.signals.length ? result.signals.map((signal) => <Badge key={signal} className="bg-blue-50 text-blue-700"><Check className="mr-1.5 h-3.5 w-3.5" />{labelSignal(signal)}</Badge>) : <p className="text-sm text-slate-500">Chưa có tín hiệu đáng tin cậy để hiển thị.</p>}</div></Card></div>
    </div>
    <EvaluationSection sessionId={session.id} />
    <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => navigate(`/practice/new?personaId=${persona.id}`)}>Luyện tập lại</Button><Button variant="secondary" icon={<UsersRound className="h-4 w-4" />} onClick={() => navigate('/customers')}>Chọn khách hàng khác</Button><Button variant="secondary" icon={<History className="h-4 w-4" />} onClick={() => navigate('/history')}>Về lịch sử</Button><Button icon={<Home className="h-4 w-4" />} onClick={() => navigate('/dashboard')}>Về trang chủ<ArrowRight className="h-4 w-4" /></Button></div>
  </div>
}

function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-extrabold text-slate-900">{value}</dd></div> }
function TopicList({ title, items, resolved = false }: { title: string; items: string[]; resolved?: boolean }) { return <div className="border-t border-slate-100 p-5 first:border-t-0 sm:border-t-0 sm:first:border-r"><p className="text-sm font-extrabold text-slate-800">{title}</p><div className="mt-4 space-y-3">{items.length ? items.map((item) => <div key={item} className={`flex items-center gap-2.5 text-sm ${resolved ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>{resolved ? <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check className="h-3 w-3" /></span> : <Circle className="h-5 w-5" />}{labelTopic(item)}</div>) : <p className="text-sm text-slate-500">Không có chủ đề được ghi nhận.</p>}</div></div> }
