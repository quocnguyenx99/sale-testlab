import { ArrowRight, CalendarDays, CheckCircle2, Clock3, MessageCircleMore, PlayCircle, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { PageHeader } from '../components/common/PageHeader'
import { PersonaCard } from '../components/common/PersonaCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingState } from '../components/ui/Feedback'
import { trainingService } from '../services/trainingService'
import type { PublicPersona, RecentSession } from '../types/training'
import { labelMode, labelOutcome, labelTrainingStatus } from '../utils/trainingLabels'

const formatActivity = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value))

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [personas, setPersonas] = useState<PublicPersona[]>([])
  const [sessions, setSessions] = useState<RecentSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([trainingService.getRecommendedPersonas(), trainingService.getRecentSessions()])
      .then(([nextPersonas, nextSessions]) => { setPersonas(nextPersonas); setSessions(nextSessions) })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu luyện tập.'))
      .finally(() => setLoading(false))
  }, [])

  const activeCount = sessions.filter((session) => session.status === 'RUNNING').length
  const completedCount = sessions.filter((session) => session.status === 'COMPLETED').length

  return <>
    <PageHeader eyebrow="Sales workspace" title={`Xin chào, ${user?.displayName ?? 'bạn'} 👋`} description="Hôm nay bạn muốn luyện tình huống bán hàng nào?" />
    <Card className="relative overflow-hidden border-0 bg-[#0b1f47] p-6 text-white sm:p-8"><div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border-[50px] border-blue-500/15" /><div className="absolute right-28 top-10 h-20 w-20 rounded-full bg-cyan-400/10 blur-xl" /><div className="relative max-w-2xl"><Badge className="bg-white/10 text-blue-100">Phiên luyện tập tiếp theo</Badge><h2 className="mt-5 text-balance text-2xl font-extrabold sm:text-3xl">Sẵn sàng cho một cuộc hội thoại mới?</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Chọn một khách hàng AI, nắm bối cảnh và thực hành cách khám phá nhu cầu trong vài phút.</p><Button className="mt-6 bg-blue-500 hover:bg-blue-400" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/customers')}>Bắt đầu luyện tập</Button></div></Card>

    {loading ? <LoadingState label="Đang tải dữ liệu luyện tập..." /> : error ? <Card className="mt-7 p-6 text-center"><p role="alert" className="text-sm font-semibold text-red-700">{error}</p><Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>Thử tải lại</Button></Card> : <>
      <section className="mt-9"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-extrabold text-slate-900">Khách hàng đề xuất</h2><p className="mt-1 text-sm text-slate-500">Chọn một phong cách khách hàng để bắt đầu.</p></div><button className="text-sm font-bold text-blue-600 hover:text-blue-700" onClick={() => navigate('/customers')}>Xem tất cả</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{personas.map((persona) => <PersonaCard key={persona.id} persona={persona} onPractice={() => navigate(`/practice/new?personaId=${persona.id}`)} />)}</div></section>

      <section className="mt-9"><div className="mb-4"><h2 className="text-lg font-extrabold text-slate-900">Phiên luyện tập gần đây</h2><p className="mt-1 text-sm text-slate-500">Tiếp tục phiên đang hoạt động hoặc xem kết quả phiên đã hoàn thành.</p></div>
        {sessions.length === 0 ? <Card className="border-dashed p-8 text-center"><MessageCircleMore className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-bold text-slate-800">Bạn chưa có phiên luyện tập</h3><p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Bắt đầu một phiên để dữ liệu hoạt động và kết quả xuất hiện tại đây.</p><Button className="mt-5" onClick={() => navigate('/customers')}>Bắt đầu luyện tập</Button></Card> : <Card className="overflow-hidden"><div className="divide-y divide-slate-100">{sessions.map((session) => {
          const active = session.status === 'RUNNING'
          const statusLabel = active ? 'Đang hoạt động' : 'Đã hoàn thành'
          const detailLabel = session.dealOutcome ? labelOutcome(session.dealOutcome) : session.trainingStatus ? labelTrainingStatus(session.trainingStatus) : 'Chưa có kết quả'
          return <div key={session.id} className="grid gap-4 p-4 transition hover:bg-slate-50 lg:grid-cols-[1.1fr_1.2fr_0.8fr_auto] lg:items-center lg:p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><UsersRound className="h-4 w-4" /></div><div><p className="text-sm font-bold text-slate-900">{session.persona.displayName}</p><p className="text-xs text-slate-500">{session.persona.role}</p></div></div><div><p className="text-sm font-semibold text-slate-700">{labelMode(session.mode)} · {session.turnCount} lượt trao đổi</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{formatActivity(session.updatedAt)}</p></div><div><span className={`inline-flex items-center gap-1.5 text-xs font-bold ${active ? 'text-blue-700' : 'text-emerald-700'}`}>{active ? <Clock3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{statusLabel}</span><p className="mt-1 text-xs text-slate-500">{detailLabel}</p></div><Button className="min-h-9 px-3 py-1.5" variant={active ? 'primary' : 'secondary'} icon={active ? <PlayCircle className="h-4 w-4" /> : undefined} onClick={() => navigate(active ? `/practice/${session.id}` : `/history/${session.id}`)}>{active ? 'Tiếp tục luyện tập' : 'Xem lại'}</Button></div>
        })}</div></Card>}
      </section>

      {sessions.length > 0 && <section className="mt-7 grid gap-4 sm:grid-cols-3"><Card className="flex items-center gap-3 p-4"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><MessageCircleMore className="h-5 w-5" /></div><div><p className="text-xl font-extrabold">{sessions.length}</p><p className="text-xs text-slate-500">Phiên gần đây</p></div></Card><Card className="flex items-center gap-3 p-4"><div className="rounded-xl bg-amber-50 p-3 text-amber-600"><Clock3 className="h-5 w-5" /></div><div><p className="text-xl font-extrabold">{activeCount}</p><p className="text-xs text-slate-500">Đang hoạt động</p></div></Card><Card className="flex items-center gap-3 p-4"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-xl font-extrabold">{completedCount}</p><p className="text-xs text-slate-500">Đã hoàn thành</p></div></Card></section>}
    </>}
  </>
}
