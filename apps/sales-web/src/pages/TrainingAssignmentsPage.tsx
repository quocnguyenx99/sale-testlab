import { ClipboardList, Plus, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { AssignmentProgress } from '../components/training/AssignmentProgress'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
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
    setLoading(true); setError('')
    try { setAssignments(await trainingAssignmentService.listManaged()) }
    catch (reason) { setError(message(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function cancel(assignment: ManagedTrainingAssignment) {
    if (!window.confirm(`Hủy phân công “${assignment.program.name}” cho ${assignment.assignedTo.displayName}?`)) return
    setCancelling(assignment.id); setError('')
    try {
      const next = await trainingAssignmentService.cancel(assignment.id)
      setAssignments((current) => current.map((value) => value.id === next.id ? next : value))
    } catch (reason) { setError(message(reason)) }
    finally { setCancelling(null) }
  }

  if (loading) return <LoadingState label="Đang tải danh sách phân công..." />
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <PageHeader eyebrow="Training assignments" title="Phân công đào tạo" description="Giao chương trình đã xuất bản và theo dõi tiến độ tổng hợp của nhân viên SALE." action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/training-assignments/new')}>Phân công chương trình</Button>} />
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {error && assignments.length === 0 ? <ErrorState title="Không thể tải phân công đào tạo" description={error} action={<Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Thử lại</Button>} /> : assignments.length === 0 ? (
        <EmptyState title="Chưa có phân công đào tạo" description="Chọn một chương trình đã xuất bản và giao cho nhân viên SALE đang hoạt động." action={<Button onClick={() => navigate('/training-assignments/new')}>Tạo phân công đầu tiên</Button>} />
      ) : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assignments.map((assignment) => (
        <Card key={assignment.id} className="flex flex-col justify-between p-5">
          <div>
            <div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><ClipboardList className="h-5 w-5" /></div><Badge className={assignmentStateClass(assignment.state)}>{assignmentStateLabel(assignment.state)}</Badge></div>
            <h2 className="mt-4 text-base font-bold text-ink">{assignment.program.name}</h2>
            <p className="mt-1 text-sm font-semibold text-ink-secondary">{assignment.assignedTo.displayName}</p>
            <p className="text-xs text-ink-muted">{assignment.assignedTo.email}</p>
            <div className="mt-4"><AssignmentProgress completed={assignment.completedItems} total={assignment.totalItems} percent={assignment.progressPercent} /></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-ink-muted">Ngày giao</dt><dd className="mt-1 font-semibold text-ink">{formatAssignmentDate(assignment.assignedAt)}</dd></div><div><dt className="text-ink-muted">Hạn hoàn thành</dt><dd className={`mt-1 font-semibold ${assignment.isOverdue ? 'text-red-700' : 'text-ink'}`}>{formatAssignmentDate(assignment.dueAt)}</dd></div></dl>
          </div>
          <div className="mt-5 flex gap-2 border-t border-border pt-4"><Button className="flex-1" variant="secondary" onClick={() => navigate(`/training-assignments/${assignment.id}`)}>Xem chi tiết</Button>{(assignment.state === 'ASSIGNED' || assignment.state === 'IN_PROGRESS') && <Button aria-label={`Hủy phân công ${assignment.program.name}`} variant="ghost" disabled={cancelling === assignment.id} onClick={() => void cancel(assignment)}><XCircle className="h-4 w-4" /></Button>}</div>
        </Card>
      ))}</div>}
    </div>
  )
}

function message(reason: unknown): string { return reason instanceof Error ? reason.message : 'Không thể xử lý phân công đào tạo.' }
