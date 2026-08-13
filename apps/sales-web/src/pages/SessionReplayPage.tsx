import { ArrowLeft, BarChart3, CalendarDays, Clock3, History, PlayCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingState } from '../components/ui/Feedback'
import { MessageBubble } from '../features/practice/MessageBubble'
import { trainingService } from '../services/trainingService'
import type { TrainingSession } from '../types/training'
import { labelMode, labelOutcome, labelTrainingStatus } from '../utils/trainingLabels'

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Chưa có'
}

export function SessionReplayPage() {
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    trainingService.getReplaySession(sessionId)
      .then((value) => { if (active) { setSession(value); setError('') } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu xem lại.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sessionId])

  if (loading) return <LoadingState label="Đang tải hội thoại đã lưu..." />
  if (!session) return <Card className="mx-auto max-w-lg p-7 text-center"><h1 className="text-xl font-extrabold text-slate-900">Không thể mở phiên xem lại</h1><p role="alert" className="mt-2 text-sm text-red-600">{error || 'Phiên không tồn tại hoặc bạn không có quyền truy cập.'}</p><Button className="mt-5" onClick={() => navigate('/history')}>Về lịch sử</Button></Card>
  if (session.status === 'RUNNING') return <Card className="mx-auto max-w-lg p-7 text-center"><PlayCircle className="mx-auto h-10 w-10 text-blue-600" /><h1 className="mt-4 text-xl font-extrabold text-slate-900">Phiên vẫn đang hoạt động</h1><p className="mt-2 text-sm leading-6 text-slate-500">Phiên đang chạy được mở trong khu vực luyện tập để tránh tạo thêm một luồng chat có thể chỉnh sửa.</p><div className="mt-5 flex justify-center gap-3"><Button variant="secondary" onClick={() => navigate('/history')}>Về lịch sử</Button><Button onClick={() => navigate(`/practice/${session.id}`)}>Tiếp tục luyện tập</Button></div></Card>

  const resultLabel = session.result ? labelOutcome(session.result.outcome) : session.runtimeInsight ? labelOutcome(session.runtimeInsight.dealOutcome) : 'Chưa có kết quả tin cậy'
  const trainingLabel = session.result ? labelTrainingStatus(session.result.trainingStatus) : session.runtimeInsight ? labelTrainingStatus(session.runtimeInsight.trainingStatus) : null

  return <div className="mx-auto max-w-6xl">
    <button className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-700" onClick={() => navigate('/history')}><ArrowLeft className="h-4 w-4" />Lịch sử luyện tập</button>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Badge className="bg-slate-100 text-slate-700"><History className="mr-1.5 h-3.5 w-3.5" />Chỉ đọc</Badge><Badge className="bg-emerald-50 text-emerald-700">Đã hoàn thành</Badge></div><h1 className="mt-3 text-2xl font-extrabold text-slate-950 sm:text-3xl">Xem lại hội thoại</h1><p className="mt-2 text-sm text-slate-500">Nội dung dưới đây được đọc trực tiếp từ các lượt hội thoại đã lưu.</p></div>{session.result && <Button icon={<BarChart3 className="h-4 w-4" />} onClick={() => navigate(`/practice/${session.id}/result`)}>Xem kết quả</Button>}</div>

    <div className="mt-7 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]"><aside className="space-y-4"><Card className="p-5"><div className="flex items-center gap-3"><Avatar initials={session.persona.initials} color={session.persona.color} /><div><h2 className="font-extrabold text-slate-900">{session.persona.displayName}</h2><p className="text-sm text-blue-700">{session.persona.role}</p></div></div><dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm"><div><dt className="text-xs text-slate-500">Chế độ</dt><dd className="mt-1 font-bold text-slate-800">{labelMode(session.mode)}</dd></div><div><dt className="flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />Bắt đầu</dt><dd className="mt-1 font-semibold text-slate-700">{formatDate(session.createdAt)}</dd></div><div><dt className="flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />Hoàn thành</dt><dd className="mt-1 font-semibold text-slate-700">{formatDate(session.completedAt)}</dd></div><div><dt className="text-xs text-slate-500">Lượt trao đổi của bạn</dt><dd className="mt-1 font-bold text-slate-800">{session.messages.filter((message) => message.sender === 'SALE').length}</dd></div></dl></Card><Card className="p-5"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Trạng thái phiên</p><p className="mt-3 font-extrabold text-slate-900">{resultLabel}</p>{trainingLabel && <p className="mt-1 text-sm text-slate-500">{trainingLabel}</p>}</Card></aside>
      <Card className="overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold text-slate-900">Nội dung hội thoại</h2><p className="mt-1 text-xs text-slate-500">Sắp xếp theo thứ tự lượt đã lưu · Không thể gửi thêm tin nhắn</p></div><div className="min-h-64 bg-slate-50 px-4 py-6 sm:px-7"><div className="mx-auto max-w-3xl space-y-5">{session.messages.length ? session.messages.map((message) => <MessageBubble key={message.id} message={message} />) : <div className="py-16 text-center"><History className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-bold text-slate-800">Chưa có lượt hội thoại đã lưu</p><p className="mt-1 text-sm text-slate-500">Phiên này được hiển thị đúng theo dữ liệu hiện có; hệ thống không tạo nội dung thay thế.</p></div>}</div></div></Card></div>
    <div className="mt-7 flex justify-center"><Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/history')}>Về lịch sử</Button></div>
  </div>
}
