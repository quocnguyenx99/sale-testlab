import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, History, PlayCircle, SearchX } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LoadingState } from '../components/ui/Feedback'
import { SearchInput, Select } from '../components/ui/FormControls'
import { trainingService } from '../services/trainingService'
import type { HistoryPage, TrainingMode } from '../types/training'
import { labelMode, labelOutcome, labelTrainingStatus } from '../utils/trainingLabels'

const EMPTY_PAGE: HistoryPage = { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }

function positivePage(value: string | null) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function formatActivity(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function HistoryPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const queryKey = params.toString()
  const page = positivePage(params.get('page'))
  const status = params.get('status') === 'RUNNING' || params.get('status') === 'COMPLETED' ? params.get('status')! : ''
  const mode = params.get('mode') === 'CUSTOMER_FIRST' || params.get('mode') === 'SALE_FIRST' ? params.get('mode')! : ''
  const search = params.get('search') ?? ''
  const [searchDraft, setSearchDraft] = useState(search)
  const [history, setHistory] = useState<HistoryPage>(EMPTY_PAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { setSearchDraft(search) }, [search])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    trainingService.getHistory({
      page,
      pageSize: 10,
      ...(status ? { status: status as 'RUNNING' | 'COMPLETED' } : {}),
      ...(mode ? { mode: mode as TrainingMode } : {}),
      ...(search ? { search } : {}),
    }).then((result) => { if (active) setHistory(result) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Không thể tải lịch sử luyện tập.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [mode, page, queryKey, search, status])

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value); else next.delete(name)
    next.delete('page')
    setParams(next)
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    updateParam('search', searchDraft.trim())
  }

  function clearFilters() {
    setSearchDraft('')
    setParams({})
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(params)
    if (nextPage <= 1) next.delete('page'); else next.set('page', String(nextPage))
    setParams(next)
  }

  const filtered = Boolean(status || mode || search)

  return <>
    <PageHeader eyebrow="Training history" title="Lịch sử luyện tập" description="Tìm lại các phiên đã lưu, tiếp tục phiên đang chạy hoặc xem lại toàn bộ hội thoại đã hoàn thành." action={<Button icon={<PlayCircle className="h-4 w-4" />} onClick={() => navigate('/customers')}>Bắt đầu luyện tập</Button>} />

    <Card className="p-4 sm:p-5">
      <form className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_210px_210px_auto]" onSubmit={submitSearch}>
        <SearchInput aria-label="Tìm theo khách hàng" placeholder="Tìm theo tên khách hàng..." value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => updateParam('status', event.target.value)}>
          <option value="">Tất cả trạng thái</option><option value="RUNNING">Đang hoạt động</option><option value="COMPLETED">Đã hoàn thành</option>
        </Select>
        <Select aria-label="Lọc theo chế độ" value={mode} onChange={(event) => updateParam('mode', event.target.value)}>
          <option value="">Tất cả chế độ</option><option value="CUSTOMER_FIRST">Khách hàng mở lời</option><option value="SALE_FIRST">Bạn mở lời</option>
        </Select>
        <Button type="submit" variant="secondary">Tìm kiếm</Button>
      </form>
    </Card>

    {loading ? <LoadingState label="Đang tải lịch sử luyện tập..." /> : error ? <Card className="mt-5 p-7 text-center"><p role="alert" className="text-sm font-semibold text-red-700">{error}</p><Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>Thử tải lại</Button></Card> : history.items.length === 0 ? <Card className="mt-5 border-dashed p-9 text-center">{filtered ? <SearchX className="mx-auto h-9 w-9 text-slate-400" /> : <History className="mx-auto h-9 w-9 text-slate-400" />}<h2 className="mt-4 text-lg font-extrabold text-slate-900">{filtered ? 'Không có phiên phù hợp' : 'Bạn chưa có lịch sử luyện tập'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{filtered ? 'Hãy thay đổi từ khóa hoặc bộ lọc để xem các phiên khác.' : 'Bắt đầu một phiên luyện tập để dữ liệu thực xuất hiện tại đây.'}</p><Button className="mt-5" onClick={filtered ? clearFilters : () => navigate('/customers')}>{filtered ? 'Xóa bộ lọc' : 'Bắt đầu luyện tập'}</Button></Card> : <>
      <div className="mt-5 space-y-3">{history.items.map((session) => {
        const running = session.status === 'RUNNING'
        const outcome = session.dealOutcome ? labelOutcome(session.dealOutcome) : session.trainingStatus ? labelTrainingStatus(session.trainingStatus) : 'Chưa có kết quả'
        return <Card key={session.id} className="grid gap-4 p-4 transition hover:border-blue-200 hover:shadow-md sm:p-5 lg:grid-cols-[1.2fr_1fr_0.8fr_auto] lg:items-center">
          <div><div className="flex items-center gap-2"><h2 className="font-extrabold text-slate-900">{session.persona.displayName}</h2><Badge className={running ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}>{running ? 'Đang hoạt động' : 'Đã hoàn thành'}</Badge></div><p className="mt-1 text-sm text-slate-500">{session.persona.role} · {session.persona.customerType}</p></div>
          <div><p className="text-sm font-bold text-slate-700">{labelMode(session.mode)}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />Cập nhật {formatActivity(session.updatedAt)}</p></div>
          <div><p className="flex items-center gap-1.5 text-sm font-bold text-slate-700">{running ? <Clock3 className="h-4 w-4 text-blue-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{session.turnCount} lượt của bạn</p><p className="mt-1 text-xs text-slate-500">{outcome}</p></div>
          <Button variant={running ? 'primary' : 'secondary'} onClick={() => navigate(running ? `/practice/${session.id}` : `/history/${session.id}`)}>{running ? 'Tiếp tục luyện tập' : 'Xem lại'}</Button>
        </Card>
      })}</div>
      <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row"><p className="text-sm text-slate-500">{history.total} phiên · Trang {history.page}/{Math.max(history.totalPages, 1)}</p><div className="flex gap-2"><Button variant="secondary" disabled={history.page <= 1} icon={<ChevronLeft className="h-4 w-4" />} onClick={() => goToPage(history.page - 1)}>Trước</Button><Button variant="secondary" disabled={history.page >= history.totalPages} onClick={() => goToPage(history.page + 1)}>Sau<ChevronRight className="h-4 w-4" /></Button></div></div>
    </>}
  </>
}
