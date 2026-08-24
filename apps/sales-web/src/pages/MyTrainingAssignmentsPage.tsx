import { ArrowRight, CalendarClock, CheckCircle2, ListChecks, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { AssignmentProgress } from '../components/training/AssignmentProgress'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
import { Surface } from '../components/ui/Surface'
import { trainingAssignmentService } from '../services/trainingAssignmentService'
import type { OwnTrainingAssignment } from '../types/trainingAssignment'
import { assignmentStateClass, assignmentStateLabel, formatAssignmentDate } from '../utils/trainingAssignmentPresentation'

const statePriority: Record<OwnTrainingAssignment['state'], number> = {
  IN_PROGRESS: 0,
  ASSIGNED: 1,
  COMPLETED: 2,
  CANCELLED: 3,
}

export function MyTrainingAssignmentsPage() {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<OwnTrainingAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAssignments(await trainingAssignmentService.listOwn())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải bài tập.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const orderedAssignments = useMemo(() => [...assignments].sort((left, right) => {
    if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1
    const stateDifference = statePriority[left.state] - statePriority[right.state]
    if (stateDifference !== 0) return stateDifference
    return (left.dueAt ?? '9999').localeCompare(right.dueAt ?? '9999')
  }), [assignments])

  if (loading) return <LoadingState label="Đang tải bài tập được giao..." />

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <PageHeader
        eyebrow="Kế hoạch luyện tập"
        title="Bài tập được giao"
        description="Ưu tiên bài quá hạn hoặc đang thực hiện, sau đó tiếp tục từng nội dung theo lộ trình của chương trình."
      />

      {error ? (
        <ErrorState
          title="Không thể tải bài tập được giao"
          description={error}
          action={<Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Thử lại</Button>}
        />
      ) : orderedAssignments.length === 0 ? (
        <EmptyState
          title="Bạn chưa có bài tập được giao"
          description="Các chương trình do quản lý phân công sẽ xuất hiện tại đây cùng hạn hoàn thành và bước luyện tập tiếp theo."
        />
      ) : (
        <section aria-labelledby="assignment-list-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="assignment-list-title" className="text-base font-bold text-ink">Việc cần hoàn thành</h2>
              <p className="mt-1 text-xs text-ink-secondary">{orderedAssignments.length} chương trình đang hiển thị theo mức độ ưu tiên.</p>
            </div>
            <Button aria-label="Làm mới bài tập" size="sm" variant="ghost" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Surface className="overflow-hidden border border-border">
            <div className="divide-y divide-border">
              {orderedAssignments.map((assignment) => {
                const done = assignment.state === 'COMPLETED'
                const nextLabel = assignment.state === 'IN_PROGRESS'
                  ? 'Tiếp tục bài tập'
                  : assignment.state === 'ASSIGNED'
                    ? 'Xem bài tập'
                    : 'Xem bài tập'

                return (
                  <article key={assignment.id} className="grid gap-4 p-4 transition-colors hover:bg-surface-hover sm:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.9fr)_auto] lg:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${done ? 'bg-success-soft text-success' : 'bg-brand-soft text-brand'}`}>
                        {done ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <ListChecks className="h-5 w-5" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold text-ink">{assignment.program.name}</h3>
                          <Badge className={assignmentStateClass(assignment.state)}>{assignmentStateLabel(assignment.state)}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-[22px] text-ink-secondary">
                          {assignment.program.description || 'Chương trình luyện tập được giao.'}
                        </p>
                        <p className={`mt-2 inline-flex items-center gap-1.5 text-xs ${assignment.isOverdue ? 'font-semibold text-danger' : 'text-ink-muted'}`}>
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                          {assignment.isOverdue ? 'Đã quá hạn' : 'Hạn hoàn thành'}: {formatAssignmentDate(assignment.dueAt)}
                        </p>
                      </div>
                    </div>

                    <AssignmentProgress completed={assignment.completedItems} total={assignment.totalItems} percent={assignment.progressPercent} />

                    <Button
                      className="w-full lg:w-auto"
                      variant={assignment.isOverdue || assignment.state === 'IN_PROGRESS' ? 'primary' : 'secondary'}
                      icon={<ArrowRight className="h-4 w-4" />}
                      onClick={() => navigate(`/my-training-assignments/${assignment.id}`)}
                    >
                      {nextLabel}
                    </Button>
                  </article>
                )
              })}
            </div>
          </Surface>
        </section>
      )}
    </div>
  )
}
