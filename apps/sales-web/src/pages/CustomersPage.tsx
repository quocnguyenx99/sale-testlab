import { Building2, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { PersonaCard } from '../components/common/PersonaCard'
import { Avatar } from '../components/ui/Avatar'
import { Badge, DifficultyBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState, LoadingState } from '../components/ui/Feedback'
import { SearchInput, Select } from '../components/ui/FormControls'
import { Modal } from '../components/ui/Modal'
import { trainingService } from '../services/trainingService'
import type { Difficulty, PublicPersona } from '../types/training'

export function CustomersPage() {
  const navigate = useNavigate()
  const [personas, setPersonas] = useState<PublicPersona[]>([])
  const [selected, setSelected] = useState<PublicPersona | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | 'ALL'>('ALL')
  const [type, setType] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { trainingService.getPersonas().then(setPersonas).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Không thể tải thư viện khách hàng.')).finally(() => setLoading(false)) }, [])
  const customerTypes = useMemo(() => [...new Set(personas.map((item) => item.customerType))], [personas])
  const filtered = useMemo(() => personas.filter((persona) => {
    const term = search.trim().toLocaleLowerCase('vi')
    return (!term || `${persona.displayName} ${persona.role} ${persona.customerType}`.toLocaleLowerCase('vi').includes(term)) && (difficulty === 'ALL' || persona.difficulty === difficulty) && (type === 'ALL' || persona.customerType === type)
  }), [difficulty, personas, search, type])
  const practice = (persona: PublicPersona) => navigate(`/practice/new?personaId=${persona.id}`)

  return <><PageHeader eyebrow="Persona library" title="Thư viện khách hàng AI" description="Lựa chọn kiểu khách hàng và luyện tập theo tình huống phù hợp với mục tiêu của bạn." />
    <div className="mb-6 grid gap-3 md:grid-cols-[1fr_200px_220px]"><SearchInput aria-label="Tìm khách hàng" placeholder="Tìm theo tên, vai trò..." value={search} onChange={(event) => setSearch(event.target.value)} /><div className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" /><Select aria-label="Lọc độ khó" className="pl-10" value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty | 'ALL')}><option value="ALL">Tất cả độ khó</option><option value="EASY">Dễ</option><option value="MEDIUM">Trung bình</option><option value="HARD">Khó</option></Select></div><div className="relative"><Building2 className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" /><Select aria-label="Lọc nhóm khách hàng" className="pl-10" value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">Tất cả nhóm khách hàng</option>{customerTypes.map((item) => <option key={item}>{item}</option>)}</Select></div></div>
    {loading ? <LoadingState label="Đang tải thư viện khách hàng..." /> : error ? <div className="rounded-card border border-red-200 bg-red-50 p-6 text-center"><p role="alert" className="text-sm font-semibold text-red-700">{error}</p><Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>Thử tải lại</Button></div> : filtered.length ? <><p className="mb-4 text-sm font-semibold text-slate-500">{filtered.length} khách hàng phù hợp</p><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((persona) => <PersonaCard key={persona.id} persona={persona} onView={() => setSelected(persona)} onPractice={() => practice(persona)} />)}</div></> : <EmptyState title="Không tìm thấy khách hàng" description="Thử thay đổi từ khóa hoặc bộ lọc để xem thêm lựa chọn." />}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Thông tin khách hàng" footer={selected && <Button onClick={() => practice(selected)}>Luyện tập với {selected.displayName}</Button>}>{selected && <div><div className="flex items-center gap-4"><Avatar initials={selected.initials} color={selected.color} size="lg" /><div><h3 className="text-xl font-extrabold text-slate-950">{selected.displayName}</h3><p className="font-semibold text-blue-700">{selected.role}</p><p className="text-sm text-slate-500">{selected.customerType}</p></div></div><div className="mt-6 flex items-center gap-2"><span className="text-sm font-bold text-slate-700">Độ khó:</span><DifficultyBadge value={selected.difficulty} /></div><div className="mt-5"><p className="text-sm font-bold text-slate-800">Phong cách khách hàng</p><p className="mt-2 text-sm leading-6 text-slate-600">{selected.summary}</p></div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-800">Bối cảnh công khai</p><p className="mt-2 text-sm leading-6 text-slate-600">{selected.scenarioContext}</p></div><div className="mt-5"><p className="mb-2 text-sm font-bold text-slate-800">Chủ đề quan tâm</p><div className="flex flex-wrap gap-2">{selected.interests.map((item) => <Badge key={item}>{item}</Badge>)}</div></div></div>}</Modal>
  </>
}
