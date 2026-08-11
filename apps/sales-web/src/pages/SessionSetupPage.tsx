import { ArrowLeft, Bot, Check, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTraining } from '../app/TrainingContext'
import { PageHeader } from '../components/common/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { DifficultyBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { trainingService } from '../services/trainingService'
import type { TrainingMode } from '../types/training'

const modes = [
  { value: 'CUSTOMER_FIRST' as const, title: 'Khách hàng mở lời', label: 'CUSTOMER_FIRST', description: 'Khách hàng AI mở đầu cuộc trò chuyện dựa trên tình huống.', icon: Bot },
  { value: 'SALE_FIRST' as const, title: 'Bạn chủ động mở lời', label: 'SALE_FIRST', description: 'Bạn chủ động chào hỏi và bắt đầu khai thác nhu cầu trước.', icon: MessageCircle },
]

export function SessionSetupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { startSession } = useTraining()
  const persona = trainingService.getPersona(params.get('personaId'))
  const scenario = trainingService.getAssignedScenario()
  const [mode, setMode] = useState<TrainingMode>('CUSTOMER_FIRST')
  const [starting, setStarting] = useState(false)
  function start() { setStarting(true); window.setTimeout(() => { const session = startSession(persona.id, mode); navigate(`/practice/${session.id}`) }, 450) }

  return <><button className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900" onClick={() => navigate('/customers')}><ArrowLeft className="h-4 w-4" />Thư viện khách hàng</button><PageHeader eyebrow="Session setup" title="Thiết lập phiên luyện tập" description="Kiểm tra bối cảnh và chọn cách bắt đầu trước khi bước vào hội thoại." />
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.35fr]"><Card className="p-5 sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-400">Khách hàng đã chọn</p><div className="mt-5 flex items-center gap-4"><Avatar initials={persona.initials} color={persona.color} size="lg" /><div><h2 className="text-xl font-extrabold text-slate-950">{persona.displayName}</h2><p className="font-semibold text-blue-700">{persona.role}</p><p className="text-sm text-slate-500">{persona.customerType}</p></div></div><div className="my-5 h-px bg-slate-100" /><div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-700">Độ khó</span><DifficultyBadge value={persona.difficulty} /></div><p className="mt-5 text-sm leading-6 text-slate-600">{persona.summary}</p><button className="mt-5 text-sm font-bold text-blue-600 hover:text-blue-700" onClick={() => navigate('/customers')}>Đổi khách hàng</button></Card>
      <div className="space-y-6"><Card className="p-5 sm:p-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-blue-600">Tình huống được gán</p><h2 className="mt-1 text-lg font-extrabold text-slate-950">{scenario.title}</h2></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{scenario.description}</p><div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800"><ShieldCheck className="h-4 w-4" />Tình huống mock dành riêng cho trải nghiệm V1.</div></Card>
      <Card className="p-5 sm:p-6"><h2 className="text-lg font-extrabold text-slate-950">Ai sẽ mở đầu cuộc trò chuyện?</h2><p className="mt-1 text-sm text-slate-500">Bạn có thể thử cả hai cách để luyện phản xạ khác nhau.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{modes.map(({ value, title, label, description, icon: Icon }) => { const active = mode === value; return <button key={value} aria-pressed={active} onClick={() => setMode(value)} className={`relative rounded-2xl border p-4 text-left transition ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}><div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon className="h-5 w-5" /></div><p className="font-extrabold text-slate-900">{title}</p><p className="mt-1 text-[11px] font-bold text-blue-600">{label}</p><p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>{active && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white"><Check className="h-3.5 w-3.5" /></span>}</button> })}</div><Button className="mt-6 w-full sm:w-auto" disabled={starting} onClick={start}>{starting ? 'Đang chuẩn bị phiên...' : 'Bắt đầu phiên luyện tập'}</Button></Card></div>
    </div>
  </>
}
