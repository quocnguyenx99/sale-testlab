import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  History,
  PlayCircle,
  RotateCcw,
  SearchX,
} from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { SearchInput, Select } from '../components/ui/FormControls'
import { trainingService } from '../services/trainingService'
import type { HistoryPage as HistoryPageData, RecentSession, TrainingMode } from '../types/training'
import { labelMode, labelOutcome, labelTrainingStatus } from '../utils/trainingLabels'

const EMPTY_PAGE: HistoryPageData = { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }

function positivePage(value: string | null) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function formatActivity(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function getColorFromId(id: string) {
  const palette = ['#2f6fed', '#7257d9', '#138b78', '#d16f32', '#3b647d', '#c15078']
  const hash = Array.from(id).reduce((value, char) => value + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

export function HistoryPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const queryKey = params.toString()
  const page = positivePage(params.get('page'))
  const status =
    params.get('status') === 'RUNNING' || params.get('status') === 'COMPLETED'
      ? params.get('status')!
      : ''
  const mode =
    params.get('mode') === 'CUSTOMER_FIRST' || params.get('mode') === 'SALE_FIRST'
      ? params.get('mode')!
      : ''
  const search = params.get('search') ?? ''
  const [searchDraft, setSearchDraft] = useState(search)
  const [history, setHistory] = useState<HistoryPageData>(EMPTY_PAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setSearchDraft(search)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    trainingService
      .getHistory({
        page,
        pageSize: 10,
        ...(status ? { status: status as 'RUNNING' | 'COMPLETED' } : {}),
        ...(mode ? { mode: mode as TrainingMode } : {}),
        ...(search ? { search } : {}),
      })
      .then((result) => {
        if (active) setHistory(result)
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : 'Không thể tải lịch sử luyện tập.'
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [mode, page, queryKey, search, status])

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
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
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setParams(next)
  }

  const isFiltered = Boolean(status || mode || search)

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      {/* Header */}
      <PageHeader
        eyebrow="Training history"
        title="Lịch sử luyện tập"
        description="Tìm lại các phiên đã lưu, tiếp tục phiên đang chạy hoặc xem lại toàn bộ hội thoại đã hoàn thành."
        action={
          <Button
            icon={<PlayCircle className="h-4 w-4" />}
            onClick={() => navigate('/customers')}
          >
            Bắt đầu luyện tập
          </Button>
        }
      />

      {/* Filter & Search Controls */}
      <Card className="p-4 sm:p-5">
        <form
          className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_200px_200px_auto]"
          onSubmit={submitSearch}
        >
          <SearchInput
            aria-label="Tìm theo tên khách hàng"
            placeholder="Tìm theo tên khách hàng..."
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <Select
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(event) => updateParam('status', event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="RUNNING">Đang hoạt động</option>
            <option value="COMPLETED">Đã hoàn thành</option>
          </Select>
          <Select
            aria-label="Lọc theo chế độ"
            value={mode}
            onChange={(event) => updateParam('mode', event.target.value)}
          >
            <option value="">Tất cả chế độ</option>
            <option value="CUSTOMER_FIRST">Khách hàng mở lời</option>
            <option value="SALE_FIRST">Bạn mở lời</option>
          </Select>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
              Tìm kiếm
            </Button>
            {isFiltered && (
              <Button
                type="button"
                variant="ghost"
                className="text-xs text-ink-muted hover:text-ink shrink-0"
                onClick={clearFilters}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Content Area */}
      {loading ? (
        <LoadingState label="Đang tải lịch sử luyện tập..." />
      ) : error ? (
        <ErrorState
          title="Không thể tải lịch sử"
          description={error}
          action={
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Thử tải lại
            </Button>
          }
        />
      ) : history.items.length === 0 ? (
        <Card className="border-dashed p-8 sm:p-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-subtle text-ink-muted">
            {isFiltered ? <SearchX className="h-6 w-6" /> : <History className="h-6 w-6" />}
          </div>
          <h2 className="mt-4 text-base font-bold text-ink sm:text-lg">
            {isFiltered ? 'Không tìm thấy phiên phù hợp' : 'Bạn chưa có lịch sử luyện tập'}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs sm:text-sm leading-relaxed text-ink-secondary">
            {isFiltered
              ? 'Hãy thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc để xem các phiên khác.'
              : 'Bắt đầu một phiên luyện tập mới để rèn luyện kỹ năng và lưu lại lịch sử hội thoại.'}
          </p>
          <div className="mt-5">
            {isFiltered ? (
              <Button onClick={clearFilters}>Xóa bộ lọc</Button>
            ) : (
              <Button
                icon={<PlayCircle className="h-4 w-4" />}
                onClick={() => navigate('/customers')}
              >
                Bắt đầu luyện tập
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* Session List */}
          <div className="space-y-3">
            {history.items.map((session) => (
              <SessionItem key={session.id} session={session} onNavigate={navigate} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 pt-3 sm:flex-row">
            <p className="text-xs text-ink-muted">
              Tổng số <span className="font-semibold text-ink">{history.total}</span> phiên · Trang{' '}
              <span className="font-semibold text-ink">{history.page}</span> /{' '}
              <span className="font-semibold text-ink">{Math.max(history.totalPages, 1)}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={history.page <= 1}
                icon={<ChevronLeft className="h-4 w-4" />}
                onClick={() => goToPage(history.page - 1)}
              >
                Trước
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={history.page >= history.totalPages}
                onClick={() => goToPage(history.page + 1)}
              >
                Sau
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SessionItem({
  session,
  onNavigate,
}: {
  session: RecentSession
  onNavigate: (path: string) => void
}) {
  const isRunning = session.status === 'RUNNING'
  const outcomeText = session.dealOutcome
    ? labelOutcome(session.dealOutcome)
    : session.trainingStatus
      ? labelTrainingStatus(session.trainingStatus)
      : 'Chưa có kết quả'

  const initials = getInitials(session.persona.displayName)
  const color = getColorFromId(session.persona.id)

  return (
    <Card className="p-4 sm:p-5 transition duration-150 hover:border-border-strong hover:shadow-subtle">
      {/* Desktop Grid Layout */}
      <div className="hidden lg:grid lg:grid-cols-[1.3fr_1fr_0.9fr_auto] lg:items-center lg:gap-4">
        {/* Column 1: Persona Info */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={initials} color={color} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold text-ink">
                {session.persona.displayName}
              </h3>
              <Badge
                className={
                  isRunning
                    ? 'border-blue-200 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold'
                }
              >
                <span
                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    isRunning ? 'bg-blue-600 animate-pulse' : 'bg-emerald-600'
                  }`}
                />
                {isRunning ? 'Đang hoạt động' : 'Đã hoàn thành'}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              <span className="font-medium text-brand">{session.persona.role}</span>
              {' · '}
              {session.persona.customerType}
            </p>
          </div>
        </div>

        {/* Column 2: Mode & Date */}
        <div>
          <p className="text-xs font-semibold text-ink">{labelMode(session.mode)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            Cập nhật {formatActivity(session.updatedAt)}
          </p>
        </div>

        {/* Column 3: Metrics & Outcome */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            {isRunning ? (
              <Clock3 className="h-3.5 w-3.5 text-brand shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            )}
            {session.turnCount} lượt của bạn
          </p>
          <p className="mt-1 truncate text-xs text-ink-muted">{outcomeText}</p>
        </div>

        {/* Column 4: Action Controls */}
        <div className="flex items-center gap-2 justify-end">
          {isRunning ? (
            <Button
              size="sm"
              icon={<PlayCircle className="h-4 w-4" />}
              onClick={() => onNavigate(`/practice/${session.id}`)}
            >
              Tiếp tục luyện tập
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Eye className="h-3.5 w-3.5" />}
                onClick={() => onNavigate(`/history/${session.id}`)}
              >
                Xem lại
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-ink-secondary hover:text-brand"
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                onClick={() => onNavigate(`/practice/${session.id}/result`)}
              >
                Kết quả
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile / Tablet Card Layout */}
      <div className="space-y-3 lg:hidden">
        {/* Top row: Avatar + Name + Status */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar initials={initials} color={color} size="sm" />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-ink">
                {session.persona.displayName}
              </h3>
              <p className="truncate text-xs text-ink-muted">
                <span className="font-medium text-brand">{session.persona.role}</span>
              </p>
            </div>
          </div>
          <Badge
            className={
              isRunning
                ? 'border-blue-200 bg-blue-50 text-blue-700 font-semibold shrink-0'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold shrink-0'
            }
          >
            <span
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                isRunning ? 'bg-blue-600' : 'bg-emerald-600'
              }`}
            />
            {isRunning ? 'Đang hoạt động' : 'Đã hoàn thành'}
          </Badge>
        </div>

        {/* Middle row: Metadata tags */}
        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-ink-secondary border-y border-border py-2">
          <span>{labelMode(session.mode)}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3 text-ink-muted" />
            {session.turnCount} lượt
          </span>
          <span>·</span>
          <span className="truncate text-ink-muted">{outcomeText}</span>
        </div>

        {/* Date & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <CalendarDays className="h-3 w-3" />
            {formatActivity(session.updatedAt)}
          </p>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button
                size="sm"
                className="w-full sm:w-auto"
                icon={<PlayCircle className="h-4 w-4" />}
                onClick={() => onNavigate(`/practice/${session.id}`)}
              >
                Tiếp tục luyện tập
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  icon={<Eye className="h-3.5 w-3.5" />}
                  onClick={() => onNavigate(`/history/${session.id}`)}
                >
                  Xem lại
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 sm:flex-none text-xs text-ink-secondary hover:text-brand"
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                  onClick={() => onNavigate(`/practice/${session.id}/result`)}
                >
                  Kết quả
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
