import { ArrowLeft, Bot, Check, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTraining } from '../app/TrainingContext'
import { PageHeader } from '../components/common/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { DifficultyBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingState } from '../components/ui/Feedback'
import { trainingService } from '../services/trainingService'
import type { PublicPersona, TrainingMode } from '../types/training'

const modes = [
  { value: 'CUSTOMER_FIRST' as const, title: 'Khách hàng mở lời', label: 'CUSTOMER_FIRST', description: 'Runtime tạo lời mở đầu thật từ persona và tình huống đã chọn.', icon: Bot },
  { value: 'SALE_FIRST' as const, title: 'Bạn chủ động mở lời', label: 'SALE_FIRST', description: 'Bạn chủ động chào hỏi; hệ thống không tạo tin nhắn khách hàng trước.', icon: MessageCircle },
]

export function SessionSetupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { startSession } = useTraining()
  const personaId = params.get('personaId') ?? ''
  const [persona, setPersona] = useState<PublicPersona | null>(null)
  const [mode, setMode] = useState<TrainingMode>('CUSTOMER_FIRST')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!personaId) { navigate('/customers', { replace: true }); return }
    trainingService.getPersona(personaId).then(setPersona).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải khách hàng.'))
  }, [navigate, personaId])

  async function start() {
    if (!persona || starting) return
    setStarting(true); setError('')
    try {
      const session = await startSession(persona.id, mode)
      navigate(`/practice/${session.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể bắt đầu phiên luyện tập.')
      setStarting(false)
    }
  }

  if (!persona && !error) return <LoadingState label="Đang tải thông tin khách hàng..." />
  if (!persona) return <Card className="mx-auto max-w-lg p-6 text-center"><h1 className="font-extrabold text-slate-900">Không thể chuẩn bị phiên</h1><p role="alert" className="mt-2 text-sm text-red-600">{error}</p><Button className="mt-5" onClick={() => navigate('/customers')}>Quay lại thư viện</Button></Card>
  const scenario = persona.defaultScenario

  return <><button className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900" onClick={() => navigate('/customers')}><ArrowLeft className="h-4 w-4" />Thư viện khách hàng</button><PageHeader eyebrow="Session setup" title="Thiết lập phiên luyện tập" description="Kiểm tra bối cảnh và chọn cách bắt đầu trước khi bước vào hội thoại." />
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.35fr]"><Card className="p-5 sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">Khách hàng đã chọn</p><div className="mt-5 flex items-center gap-4"><Avatar initials={persona.initials} color={persona.color} size="lg" /><div><h2 className="text-xl font-extrabold text-slate-950">{persona.displayName}</h2><p className="font-semibold text-blue-700">{persona.role}</p><p className="text-sm text-slate-500">{persona.customerType}</p></div></div><div className="my-5 h-px bg-slate-100" /><div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-700">Độ khó</span><DifficultyBadge value={persona.difficulty} /></div><p className="mt-5 text-sm leading-6 text-slate-600">{persona.summary}</p><button className="mt-5 text-sm font-bold text-blue-600 hover:text-blue-700" onClick={() => navigate('/customers')}>Đổi khách hàng</button></Card>
      <div className="space-y-6"><Card className="p-5 sm:p-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-blue-600">Tình huống từ persona</p><h2 className="mt-1 text-lg font-extrabold text-slate-950">{scenario.title}</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{scenario.description}</p><div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800"><ShieldCheck className="h-4 w-4" />Nguồn persona đã được enrich và anonymize tại local pipeline.</div></Card>
      <Card className="p-5 sm:p-6"><h2 className="text-lg font-extrabold text-slate-950">Ai sẽ mở đầu cuộc trò chuyện?</h2><p className="mt-1 text-sm text-slate-500">Cả hai chế độ dùng cùng runtime và guard pipeline hiện tại.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{modes.map(({ value, title, label, description, icon: Icon }) => { const active = mode === value; return <button key={value} aria-pressed={active} onClick={() => setMode(value)} className={`relative rounded-2xl border p-4 text-left transition ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}><div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-5 w-5" /></div><p className="font-extrabold text-slate-900">{title}</p><p className="mt-1 text-[11px] font-bold text-blue-600">{label}</p><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>{active && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white"><Check className="h-3.5 w-3.5" /></span>}</button> })}</div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}<Button className="mt-6 w-full sm:w-auto" disabled={starting} onClick={() => void start()}>{starting ? 'Đang tạo phiên thật...' : 'Bắt đầu phiên luyện tập'}</Button></Card></div>
    </div>
  </>
}
