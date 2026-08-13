import { ArrowLeft, BarChart3, Info, Send, Square, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTraining } from '../app/TrainingContext'
import { Avatar } from '../components/ui/Avatar'
import { DifficultyBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingState } from '../components/ui/Feedback'
import { Modal } from '../components/ui/Modal'
import { MessageBubble } from '../features/practice/MessageBubble'
import { RuntimeInsightPanel } from '../features/practice/RuntimeInsightPanel'

export function PracticePage() {
  const navigate = useNavigate()
  const { sessionId = '' } = useParams()
  const { session, messages, loadSession, sendMessage, stopSession } = useTraining()
  const [draft, setDraft] = useState('')
  const [responding, setResponding] = useState(false)
  const [loading, setLoading] = useState(session?.id !== sessionId)
  const [error, setError] = useState('')
  const [insightOpen, setInsightOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [stopping, setStopping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId || session?.id === sessionId) { setLoading(false); return }
    setLoading(true)
    loadSession(sessionId).then(() => setError('')).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể khôi phục phiên.')).finally(() => setLoading(false))
  }, [loadSession, session?.id, sessionId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, responding])

  async function submitMessage() {
    const content = draft.trim()
    if (!content || responding || !session) return
    setDraft(''); setResponding(true); setError('')
    try {
      await sendMessage(session.id, content)
    } catch (reason) {
      setDraft(content)
      setError(reason instanceof Error ? reason.message : 'Khách hàng AI chưa thể phản hồi. Vui lòng thử lại.')
    } finally {
      setResponding(false)
    }
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitMessage() } }
  async function endSession() {
    if (!session || stopping) return
    setStopping(true); setError('')
    try {
      await stopSession(session.id)
      navigate(`/practice/${session.id}/result`)
    } catch (reason) {
      setConfirmEnd(false)
      setError(reason instanceof Error ? reason.message : 'Không thể kết thúc phiên. Vui lòng thử lại.')
      setStopping(false)
    }
  }

  if (loading) return <LoadingState label="Đang khôi phục phiên luyện tập..." />
  if (!session || session.id !== sessionId) return <Card className="mx-auto max-w-lg p-6 text-center"><h1 className="font-extrabold text-slate-900">Không thể tải phiên luyện tập</h1><p role="alert" className="mt-2 text-sm text-red-600">{error || 'Phiên không tồn tại hoặc backend đã khởi động lại.'}</p><Button className="mt-5" onClick={() => navigate('/customers')}>Chọn khách hàng khác</Button></Card>
  if (session.status === 'COMPLETED') return <Card className="mx-auto max-w-lg p-6 text-center"><h1 className="text-xl font-extrabold text-slate-900">Phiên đã hoàn thành</h1><p className="mt-2 text-sm text-slate-500">Phiên này không thể nhận thêm tin nhắn. Bạn có thể xem dữ liệu tổng kết đã ghi nhận.</p><Button className="mt-5" onClick={() => navigate(`/practice/${session.id}/result`, { replace: true })}>Xem kết quả</Button></Card>
  const { persona, scenario, mode, runtimeInsight } = session

  return <div className="-mx-4 -my-6 flex min-h-[calc(100vh-4rem)] flex-col bg-slate-100 sm:-mx-7 sm:-my-8 lg:-mx-10 lg:-my-10 lg:min-h-screen">
    <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6"><div className="flex min-w-0 items-center gap-3"><button aria-label="Quay lại thiết lập" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={() => navigate(`/practice/new?personaId=${persona.id}`)}><ArrowLeft className="h-5 w-5" /></button><Avatar initials={persona.initials} color={persona.color} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-900">{persona.displayName}</p><div className="flex items-center gap-2"><span className={`inline-block h-2 w-2 rounded-full ${session.status === 'RUNNING' ? 'bg-emerald-500' : 'bg-slate-400'}`} /><span className="truncate text-xs text-slate-500">{session.status === 'RUNNING' ? 'Phiên đang diễn ra' : 'Phiên đã hoàn thành'}</span></div></div></div><div className="flex shrink-0 items-center gap-2"><Button variant="secondary" className="hidden sm:inline-flex" disabled={!runtimeInsight} icon={<BarChart3 className="h-4 w-4" />} onClick={() => setInsightOpen(true)}>Trạng thái phiên</Button><button aria-label="Trạng thái phiên" disabled={!runtimeInsight} className="rounded-xl border border-slate-200 p-2.5 text-blue-600 disabled:opacity-40 sm:hidden" onClick={() => setInsightOpen(true)}><BarChart3 className="h-5 w-5" /></button><Button variant="secondary" className="hidden border-red-200 text-red-600 hover:border-red-300 hover:text-red-700 sm:inline-flex" icon={<Square className="h-3.5 w-3.5" />} onClick={() => setConfirmEnd(true)}>Kết thúc phiên</Button><button aria-label="Kết thúc phiên" className="rounded-xl border border-red-200 p-2.5 text-red-600 sm:hidden" onClick={() => setConfirmEnd(true)}><Square className="h-4 w-4" /></button></div></header>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_1fr]"><aside className="hidden border-r border-slate-200 bg-white p-5 lg:block"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Khách hàng</p><div className="mt-5 flex items-center gap-3"><Avatar initials={persona.initials} color={persona.color} /><div><h1 className="font-extrabold text-slate-950">{persona.displayName}</h1><p className="text-xs font-semibold text-blue-700">{persona.role}</p></div></div><div className="mt-5 flex items-center justify-between"><span className="text-xs font-bold text-slate-500">Độ khó</span><DifficultyBadge value={persona.difficulty} /></div><div className="mt-6 border-t border-slate-100 pt-5"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">Tình huống</p><p className="mt-2 text-sm font-bold leading-5 text-slate-800">{scenario.title}</p><p className="mt-2 text-xs leading-5 text-slate-500">{scenario.description}</p></div><div className="mt-6 rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Info className="h-4 w-4" />Chế độ luyện tập</div><p className="mt-2 text-xs font-extrabold text-blue-700">{mode}</p></div></aside>
      <section className="flex min-h-0 flex-col bg-[#f7f9fc]"><div className="border-b border-slate-200 bg-white px-4 py-2 lg:hidden"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold text-slate-600"><span className="font-extrabold text-slate-900">Tình huống:</span> {scenario.title}</p><span className="shrink-0 text-[10px] font-extrabold text-blue-600">{mode === 'CUSTOMER_FIRST' ? 'KHÁCH MỞ LỜI' : 'BẠN MỞ LỜI'}</span></div></div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5 sm:px-8 lg:px-12"><div className="mx-auto max-w-3xl space-y-5">{messages.length === 0 && <div className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600"><UserRound className="h-5 w-5" /></div><h2 className="mt-4 font-extrabold text-slate-900">Bạn là người mở đầu</h2><p className="mt-2 text-sm leading-6 text-slate-500">Hãy chào {persona.displayName} và bắt đầu khám phá nhu cầu.</p></div>}{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{responding && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="flex gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 [animation-delay:300ms]" /></span>Khách hàng đang phản hồi...</div></div></div>}{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error} Nội dung vẫn còn trong ô soạn để bạn thử lại.</div>}<div ref={endRef} /></div></div>
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-7 sm:py-4"><div className="mx-auto max-w-3xl"><div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100"><textarea aria-label="Tin nhắn cho khách hàng" className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400" disabled={session.status !== 'RUNNING'} rows={1} placeholder={session.status === 'RUNNING' ? 'Nhập tin nhắn...' : 'Phiên đã hoàn thành'} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} /><Button aria-label="Gửi tin nhắn" className="h-11 w-11 shrink-0 px-0" disabled={!draft.trim() || responding || session.status !== 'RUNNING'} onClick={() => void submitMessage()}><Send className="h-4 w-4" /></Button></div><p className="mt-2 hidden text-center text-[10px] text-slate-400 sm:block">Enter để gửi · Shift + Enter để xuống dòng</p></div></div>
      </section></div>
    {insightOpen && runtimeInsight && <div className="fixed inset-0 z-50"><button aria-label="Đóng trạng thái phiên" className="absolute inset-0 bg-slate-950/40" onClick={() => setInsightOpen(false)} /><aside role="dialog" aria-modal="true" aria-label="Trạng thái phiên" className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-float sm:inset-y-0 sm:left-auto sm:w-[390px] sm:rounded-none"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-600">Tiến trình hội thoại</p><h2 className="mt-1 text-xl font-extrabold text-slate-950">Trạng thái phiên</h2></div><button aria-label="Đóng" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={() => setInsightOpen(false)}><ArrowLeft className="h-5 w-5 rotate-180 sm:rotate-0" /></button></div><RuntimeInsightPanel insight={runtimeInsight} /></aside></div>}
    <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Kết thúc phiên luyện tập?" footer={<><Button variant="secondary" disabled={stopping} onClick={() => setConfirmEnd(false)}>Tiếp tục luyện tập</Button><Button variant="danger" disabled={stopping} onClick={() => void endSession()}>{stopping ? 'Đang tổng hợp...' : 'Kết thúc phiên'}</Button></>}><div className="flex gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Info className="h-5 w-5" /></div><p className="text-sm leading-6 text-slate-600">Phiên sẽ được đánh dấu hoàn thành và dữ liệu tổng kết hiện có sẽ được hiển thị.</p></div></Modal>
  </div>
}
