import { ArrowRight, CalendarDays, CheckCircle2, Clock3, MessageCircleMore, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { PersonaCard } from '../components/common/PersonaCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingState } from '../components/ui/Feedback'
import { trainingService } from '../services/trainingService'
import type { PublicPersona, RecentSession } from '../types/training'

export function DashboardPage() {
  const navigate = useNavigate()
  const [personas, setPersonas] = useState<PublicPersona[]>([])
  const [sessions, setSessions] = useState<RecentSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { Promise.all([trainingService.getRecommendedPersonas(), trainingService.getRecentSessions()]).then(([nextPersonas, nextSessions]) => { setPersonas(nextPersonas); setSessions(nextSessions) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu luyện tập.')).finally(() => setLoading(false)) }, [])

  return <><PageHeader eyebrow="Sales workspace" title="Xin chào, Minh 👋" description="Hôm nay bạn muốn luyện tình huống bán hàng nào?" />
    <Card className="relative overflow-hidden border-0 bg-[#0b1f47] p-6 text-white sm:p-8"><div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border-[50px] border-blue-500/15" /><div className="absolute right-28 top-10 h-20 w-20 rounded-full bg-cyan-400/10 blur-xl" /><div className="relative max-w-2xl"><Badge className="bg-white/10 text-blue-100">Phiên luyện tập tiếp theo</Badge><h2 className="mt-5 text-balance text-2xl font-extrabold sm:text-3xl">Sẵn sàng cho một cuộc hội thoại mới?</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Chọn một khách hàng AI, nắm bối cảnh và thực hành cách khám phá nhu cầu trong vài phút.</p><Button className="mt-6 bg-blue-500 hover:bg-blue-400" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate('/customers')}>Bắt đầu luyện tập</Button></div></Card>
    {loading ? <LoadingState /> : error ? <Card className="mt-7 p-6 text-center"><p role="alert" className="text-sm font-semibold text-red-700">{error}</p><Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>Thử tải lại</Button></Card> : <><section className="mt-9"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-extrabold text-slate-900">Khách hàng đề xuất</h2><p className="mt-1 text-sm text-slate-500">Chọn một phong cách khách hàng để bắt đầu.</p></div><button className="text-sm font-bold text-blue-600 hover:text-blue-700" onClick={() => navigate('/customers')}>Xem tất cả</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{personas.map((persona) => <PersonaCard key={persona.id} persona={persona} onPractice={() => navigate(`/practice/new?personaId=${persona.id}`)} />)}</div></section>
    <section className="mt-9"><div className="mb-4"><h2 className="text-lg font-extrabold text-slate-900">Phiên luyện tập gần đây</h2><p className="mt-1 text-sm text-slate-500">Tóm tắt những tình huống bạn vừa hoàn thành.</p></div><Card className="overflow-hidden"><div className="divide-y divide-slate-100">{sessions.map((session) => <div key={session.id} className="grid gap-3 p-4 transition hover:bg-slate-50 sm:grid-cols-[1.2fr_1.4fr_0.8fr] sm:items-center sm:p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><UsersRound className="h-4 w-4" /></div><div><p className="text-sm font-bold text-slate-900">{session.customer}</p><p className="text-xs text-slate-500">{session.role}</p></div></div><div><p className="text-sm font-semibold text-slate-700">{session.scenario}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{session.dateLabel}</p></div><div className="flex items-center justify-between gap-2 sm:justify-end"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{session.outcomeLabel}</span></div></div>)}</div></Card></section>
    <section className="mt-7 grid gap-4 sm:grid-cols-3"><Card className="flex items-center gap-3 p-4"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><MessageCircleMore className="h-5 w-5" /></div><div><p className="text-xl font-extrabold">3</p><p className="text-xs text-slate-500">Phiên gần đây</p></div></Card><Card className="flex items-center gap-3 p-4"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-xl font-extrabold">3</p><p className="text-xs text-slate-500">Đã hoàn thành</p></div></Card><Card className="flex items-center gap-3 p-4"><div className="rounded-xl bg-amber-50 p-3 text-amber-600"><Clock3 className="h-5 w-5" /></div><div><p className="text-xl font-extrabold">24 phút</p><p className="text-xs text-slate-500">Thời gian luyện tập</p></div></Card></section></>}
  </>
}
