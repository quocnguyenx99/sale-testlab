import {
  ArrowLeft,
  BarChart3,
  Info,
  Send,
  Square,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTraining } from '../app/TrainingContext'
import { Avatar } from '../components/ui/Avatar'
import { DifficultyBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { Modal } from '../components/ui/Modal'
import { MessageBubble } from '../features/practice/MessageBubble'
import { RuntimeInsightPanel } from '../features/practice/RuntimeInsightPanel'
import { labelMode } from '../utils/trainingLabels'

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
    if (!sessionId || session?.id === sessionId) {
      setLoading(false)
      return
    }
    setLoading(true)
    loadSession(sessionId)
      .then(() => setError(''))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể khôi phục phiên luyện tập.')
      )
      .finally(() => setLoading(false))
  }, [loadSession, session?.id, sessionId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, responding])

  async function submitMessage() {
    const content = draft.trim()
    if (!content || responding || !session) return
    setDraft('')
    setResponding(true)
    setError('')
    try {
      await sendMessage(session.id, content)
    } catch (reason) {
      setDraft(content)
      setError(
        reason instanceof Error ? reason.message : 'Khách hàng AI chưa thể phản hồi. Vui lòng thử lại.'
      )
    } finally {
      setResponding(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submitMessage()
    }
  }

  async function endSession() {
    if (!session || stopping) return
    setStopping(true)
    setError('')
    try {
      await stopSession(session.id)
      navigate(`/practice/${session.id}/result`)
    } catch (reason) {
      setConfirmEnd(false)
      setError(reason instanceof Error ? reason.message : 'Không thể kết thúc phiên. Vui lòng thử lại.')
      setStopping(false)
    }
  }

  if (loading) {
    return <LoadingState label="Đang khôi phục phiên luyện tập..." />
  }

  if (!session || session.id !== sessionId) {
    return (
      <div className="mx-auto max-w-lg mt-8">
        <ErrorState
          title="Không thể tải phiên luyện tập"
          description={error || 'Phiên không tồn tại hoặc bạn không có quyền truy cập.'}
          action={<Button onClick={() => navigate('/customers')}>Chọn khách hàng khác</Button>}
        />
      </div>
    )
  }

  if (session.status === 'COMPLETED') {
    return (
      <div className="mx-auto max-w-lg mt-8">
        <Card className="p-6 sm:p-8 text-center">
          <h1 className="text-xl font-bold text-ink">Phiên đã hoàn thành</h1>
          <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
            Phiên này không thể nhận thêm tin nhắn. Bạn có thể xem kết quả tổng kết đã được ghi nhận.
          </p>
          <Button
            className="mt-5"
            onClick={() => navigate(`/practice/${session.id}/result`, { replace: true })}
          >
            Xem kết quả
          </Button>
        </Card>
      </div>
    )
  }

  const { persona, scenario, mode, runtimeInsight } = session
  const isRunning = session.status === 'RUNNING'

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] flex-col bg-canvas sm:-mx-6 sm:-my-8 lg:-mx-8 lg:-my-8 lg:min-h-screen">
      {/* Training Workspace Header */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="Quay lại thiết lập"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink transition duration-150"
            onClick={() => navigate(`/practice/new?personaId=${persona.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Avatar initials={persona.initials} color={persona.color} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{persona.displayName}</p>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isRunning ? 'bg-emerald-500' : 'bg-ink-muted'
                }`}
              />
              <span className="truncate text-xs text-ink-muted">
                {isRunning ? 'Phiên đang diễn ra' : 'Phiên đã hoàn thành'}
              </span>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex"
            disabled={!runtimeInsight}
            icon={<BarChart3 className="h-4 w-4" />}
            onClick={() => setInsightOpen(true)}
          >
            Thông tin phiên
          </Button>
          <button
            aria-label="Thông tin phiên"
            disabled={!runtimeInsight}
            className="rounded-lg border border-border p-2 text-brand disabled:opacity-40 sm:hidden transition duration-150"
            onClick={() => setInsightOpen(true)}
          >
            <BarChart3 className="h-4 w-4" />
          </button>

          <Button
            variant="secondary"
            size="sm"
            className="hidden border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 sm:inline-flex"
            icon={<Square className="h-3.5 w-3.5" />}
            onClick={() => setConfirmEnd(true)}
          >
            Kết thúc phiên
          </Button>
          <button
            aria-label="Kết thúc phiên"
            className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 sm:hidden transition duration-150"
            onClick={() => setConfirmEnd(true)}
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_1fr]">
        {/* Desktop Sidebar: Persona & Scenario Context */}
        <aside className="hidden border-r border-border bg-surface p-5 lg:block overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Khách hàng AI
          </p>
          <div className="mt-3 flex items-start gap-3">
            <Avatar initials={persona.initials} color={persona.color} size="md" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink truncate">{persona.displayName}</h2>
              <p className="text-xs font-semibold text-brand">{persona.role}</p>
              <p className="text-xs text-ink-muted">{persona.customerType}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-ink-muted font-medium">Độ khó:</span>
            <DifficultyBadge value={persona.difficulty} />
          </div>

          <div className="my-5 border-t border-border" />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Tình huống luyện tập
            </p>
            <p className="mt-1 text-xs font-bold text-ink">{scenario.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{scenario.description}</p>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-surface-subtle p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
              <Info className="h-3.5 w-3.5 text-brand" />
              Chế độ luyện tập
            </div>
            <p className="mt-1 text-xs font-bold text-brand">{labelMode(mode)}</p>
          </div>
        </aside>

        {/* Conversation Thread & Composer Column */}
        <section className="flex min-h-0 flex-col bg-canvas">
          {/* Mobile Scenario Strip */}
          <div className="border-b border-border bg-surface px-4 py-2 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-xs text-ink-secondary">
                <span className="font-semibold text-ink">Tình huống:</span> {scenario.title}
              </p>
              <span className="shrink-0 text-[10px] font-bold text-brand uppercase">
                {labelMode(mode)}
              </span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl space-y-4">
              {/* SALE_FIRST initial greeting prompt */}
              {messages.length === 0 && (
                <div className="mx-auto mt-8 max-w-md rounded-xl border border-dashed border-border bg-surface p-6 text-center shadow-subtle">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 font-bold text-sm text-ink">Bạn là người mở đầu</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                    Hãy chào {persona.displayName} và bắt đầu khám phá nhu cầu của khách hàng.
                  </p>
                </div>
              )}

              {/* Message Bubbles */}
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {/* Customer Responding Indicator */}
              {responding && (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-border bg-surface px-4 py-2.5 shadow-subtle">
                    <div className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:300ms]" />
                      </span>
                      Khách hàng đang phản hồi...
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 leading-relaxed"
                >
                  {error} Nội dung vẫn còn trong ô soạn để bạn thử lại.
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>

          {/* Sticky Composer */}
          <div className="sticky bottom-0 border-t border-border bg-surface px-3 py-3 sm:px-6 sm:py-3.5">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-surface p-2 shadow-subtle focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15 transition-all">
                <textarea
                  aria-label="Tin nhắn cho khách hàng"
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-muted leading-relaxed"
                  disabled={!isRunning || responding}
                  rows={1}
                  placeholder={isRunning ? 'Nhập tin nhắn cho khách hàng...' : 'Phiên đã hoàn thành'}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Button
                  aria-label="Gửi tin nhắn"
                  size="sm"
                  className="h-10 w-10 shrink-0 px-0 rounded-lg"
                  disabled={!draft.trim() || responding || !isRunning}
                  onClick={() => void submitMessage()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1.5 hidden text-center text-[10px] text-ink-muted sm:block">
                Enter để gửi · Shift + Enter để xuống dòng
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Runtime Insight Drawer */}
      {insightOpen && runtimeInsight && (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Đóng thông tin phiên"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={() => setInsightOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Thông tin phiên"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-6 shadow-float sm:inset-y-0 sm:left-auto sm:w-[380px] sm:rounded-none sm:border-l sm:border-t-0"
          >
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Tiến trình hội thoại
                </p>
                <h3 className="mt-0.5 text-base font-bold text-ink">Thông tin phiên</h3>
              </div>
              <button
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-subtle hover:text-ink transition duration-150"
                onClick={() => setInsightOpen(false)}
              >
                <ArrowLeft className="h-4 w-4 rotate-180 sm:rotate-0" />
              </button>
            </div>
            <RuntimeInsightPanel insight={runtimeInsight} />
          </aside>
        </div>
      )}

      {/* Confirm Stop Session Modal */}
      <Modal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="Kết thúc phiên luyện tập?"
        footer={
          <>
            <Button variant="secondary" disabled={stopping} onClick={() => setConfirmEnd(false)}>
              Tiếp tục luyện tập
            </Button>
            <Button variant="danger" disabled={stopping} onClick={() => void endSession()}>
              {stopping ? 'Đang tổng hợp...' : 'Kết thúc phiên'}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <Info className="h-5 w-5" />
          </div>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Phiên sẽ được đánh dấu hoàn thành và dữ liệu tổng kết hiện có sẽ được chuyển sang trang
            kết quả.
          </p>
        </div>
      </Modal>
    </div>
  )
}
