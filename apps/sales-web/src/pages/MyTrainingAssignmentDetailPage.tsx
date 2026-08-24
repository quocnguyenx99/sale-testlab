import { ArrowLeft, CheckCircle2, Circle, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { AssignmentProgress } from '../components/training/AssignmentProgress'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { Surface } from '../components/ui/Surface'
import { trainingAssignmentService } from '../services/trainingAssignmentService'
import type { OwnTrainingAssignment } from '../types/trainingAssignment'
import { assignmentItemStateLabel, assignmentStateClass, assignmentStateLabel, formatAssignmentDate, trainingModeLabel } from '../utils/trainingAssignmentPresentation'

export function MyTrainingAssignmentDetailPage() {
  const navigate = useNavigate()
  const { assignmentId = '' } = useParams()
  const [assignment, setAssignment] = useState<OwnTrainingAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAssignment(await trainingAssignmentService.getOwn(assignmentId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải bài tập.')
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => { void load() }, [load])

  async function start(itemId: string, activeSessionId: string | null) {
    if (activeSessionId) {
      navigate(`/practice/${activeSessionId}`)
      return
    }
    setStarting(itemId)
    setError('')
    try {
      const session = await trainingAssignmentService.startItem(assignmentId, itemId)
      navigate(`/practice/${session.id}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể bắt đầu nội dung luyện tập.')
    } finally {
      setStarting(null)
    }
  }

  if (loading) return <LoadingState label="Đang tải bài tập..." />
  if (!assignment) {
    return <ErrorState title="Không thể tải bài tập" description={error || 'Bài tập không tồn tại.'} action={<Button onClick={() => navigate('/my-training-assignments')}>Về danh sách</Button>} />
  }

  const nextItem = assignment.items.find((item) => item.state !== 'COMPLETED')

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <button className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:text-brand" onClick={() => navigate('/my-training-assignments')}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Bài tập được giao
      </button>

      <PageHeader
        eyebrow="Lộ trình luyện tập"
        title={assignment.program.name}
        description={assignment.program.description || 'Hoàn thành các nội dung theo thứ tự phù hợp với kế hoạch luyện tập của bạn.'}
        action={<Badge className={assignmentStateClass(assignment.state)}>{assignmentStateLabel(assignment.state)}</Badge>}
      />

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>}

      <Surface className="mb-6 border border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink">Tiến độ chương trình</h2>
            <p className={`mt-1 text-xs ${assignment.isOverdue ? 'font-semibold text-danger' : 'text-ink-muted'}`}>
              {assignment.isOverdue ? 'Đã quá hạn' : 'Hạn hoàn thành'}: {formatAssignmentDate(assignment.dueAt)}
            </p>
          </div>
          <Button aria-label="Làm mới tiến độ" size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        <div className="mt-4"><AssignmentProgress completed={assignment.completedItems} total={assignment.totalItems} percent={assignment.progressPercent} /></div>
      </Surface>

      <section aria-labelledby="learning-path-title">
        <div className="mb-4">
          <h2 id="learning-path-title" className="text-base font-bold text-ink">Các bước luyện tập</h2>
          <p className="mt-1 text-xs text-ink-secondary">Mỗi bước sử dụng đúng Persona, tình huống và chế độ đã được chương trình thiết lập.</p>
        </div>
        <Surface className="overflow-hidden border border-border">
          <ol className="divide-y divide-border">
            {assignment.items.map((item) => {
              const completed = item.state === 'COMPLETED'
              const isNext = nextItem?.id === item.id
              return (
                <li key={item.id} className={`grid gap-4 p-4 sm:p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center ${isNext ? 'bg-brand-subtle' : ''}`}>
                  <div className={`grid h-9 w-9 place-items-center rounded-lg ${completed ? 'bg-success-soft text-success' : isNext ? 'bg-brand text-white' : 'bg-surface-subtle text-ink-muted'}`}>
                    {completed ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <span className="text-sm font-bold">{item.sortOrder}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-ink">{item.personaLabel ?? item.personaId}</h3>
                      {isNext && <span className="text-xs font-semibold text-brand">Bước tiếp theo</span>}
                    </div>
                    <p className="mt-1 text-sm text-ink-secondary">{item.scenarioLabel ?? item.scenarioId}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted"><Circle className="h-2.5 w-2.5" aria-hidden="true" />{trainingModeLabel(item.mode)} · {assignmentItemStateLabel(item.state)}</p>
                  </div>
                  <div>
                    {completed ? (
                      <span className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Hoàn thành</span>
                    ) : assignment.state === 'CANCELLED' ? (
                      <span className="text-xs font-semibold text-ink-muted">Phân công đã hủy</span>
                    ) : (
                      <Button icon={<Play className="h-4 w-4" />} disabled={starting === item.id} onClick={() => void start(item.id, item.activeSessionId)}>
                        {item.activeSessionId ? 'Tiếp tục luyện tập' : starting === item.id ? 'Đang bắt đầu...' : 'Bắt đầu luyện tập'}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </Surface>
      </section>
    </div>
  )
}
