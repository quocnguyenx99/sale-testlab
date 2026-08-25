import { ClipboardList, Plus, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { AssignmentProgress } from '../components/training/AssignmentProgress'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
import { Surface } from '../components/ui/Surface'
import { trainingAssignmentService } from '../services/trainingAssignmentService'
import type { ManagedTrainingAssignment } from '../types/trainingAssignment'
import { assignmentStateClass, assignmentStateLabel, formatAssignmentDate } from '../utils/trainingAssignmentPresentation'

export function TrainingAssignmentsPage() {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<ManagedTrainingAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAssignments(await trainingAssignmentService.listManaged())
    } catch (reason) {
      setError(message(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function cancel(assignment: ManagedTrainingAssignment) {
    if (!window.confirm(`Hủy phân công “${assignment.program.name}” cho ${assignment.assignedTo.displayName}?`)) return
    setCancelling(assignment.id)
    setError('')
    try {
      const next = await trainingAssignmentService.cancel(assignment.id)
      setAssignments((current) => current.map((value) => value.id === next.id ? next : value))
    } catch (reason) {
      setError(message(reason))
    } finally {
      setCancelling(null)
    }
  }

  if (loading) return <LoadingState label="Đang tải danh sách phân công..." />

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <PageHeader
        eyebrow="Quản lý đào tạo"
        title="Phân công đào tạo"
        description="Giao chương trình đã xuất bản và theo dõi tiến độ tổng hợp của nhân viên SALE."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/training-assignments/new')}>Phân công chương trình</Button>}
      />

      {error && assignments.length > 0 && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</div>}

      {error && assignments.length === 0 ? (
        <ErrorState title="Không thể tải phân công đào tạo" description={error} action={<Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Thử lại</Button>} />
      ) : assignments.length === 0 ? (
        <EmptyState title="Chưa có phân công đào tạo" description="Chọn một chương trình đã xuất bản và giao cho nhân viên SALE đang hoạt động." action={<Button onClick={() => navigate('/training-assignments/new')}>Tạo phân công đầu tiên</Button>} />
      ) : (
        <Surface className="overflow-hidden border border-border">
          <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(180px,0.8fr)_auto] gap-4 border-b border-border bg-surface-subtle px-5 py-3 text-xs font-semibold text-ink-secondary lg:grid">
            <span>Chương trình / SALE</span><span>Tiến độ</span><span>Trạng thái / hạn</span><span className="text-right">Thao tác</span>
          </div>
          <div className="divide-y divide-border">
            {assignments.map((assignment) => (
              <article key={assignment.id} className="grid min-w-0 gap-4 p-4 hover:bg-surface-hover sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(180px,0.8fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><ClipboardList className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-ink">{assignment.program.name}</h2>
                    <p className="mt-1 truncate text-sm font-medium text-ink-secondary">{assignment.assignedTo.displayName}</p>
                    <p className="break-all text-xs text-ink-muted">{assignment.assignedTo.email}</p>
                  </div>
                </div>
                <AssignmentProgress completed={assignment.completedItems} total={assignment.totalItems} percent={assignment.progressPercent} />
                <div>
                  <Badge className={assignmentStateClass(assignment.state)}>{assignmentStateLabel(assignment.state)}</Badge>
                  <p className={`mt-2 text-xs ${assignment.isOverdue ? 'font-semibold text-danger' : 'text-ink-muted'}`}>Hạn: {formatAssignmentDate(assignment.dueAt)}</p>
                </div>
                <div className="flex min-w-0 gap-2 lg:justify-end">
                  <Button className="min-w-0 flex-1 lg:flex-none" variant="secondary" onClick={() => navigate(`/training-assignments/${assignment.id}`)}>Xem chi tiết</Button>
                  {(assignment.state === 'ASSIGNED' || assignment.state === 'IN_PROGRESS') && (
                    <Button className="shrink-0 px-3" aria-label={`Hủy phân công ${assignment.program.name}`} variant="ghost" disabled={cancelling === assignment.id} onClick={() => void cancel(assignment)}><XCircle className="h-4 w-4" /></Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Surface>
      )}
    </div>
  )
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Không thể xử lý phân công đào tạo.'
}
