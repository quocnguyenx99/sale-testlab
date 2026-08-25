import { ArrowLeft, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { AssignmentProgress } from '../components/training/AssignmentProgress'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { Surface } from '../components/ui/Surface'
import { trainingAssignmentService } from '../services/trainingAssignmentService'
import type { ManagedTrainingAssignment } from '../types/trainingAssignment'
import { assignmentItemStateLabel, assignmentStateClass, assignmentStateLabel, formatAssignmentDate, trainingModeLabel } from '../utils/trainingAssignmentPresentation'

export function TrainingAssignmentDetailPage() {
  const navigate = useNavigate()
  const { assignmentId = '' } = useParams()
  const [assignment, setAssignment] = useState<ManagedTrainingAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setAssignment(await trainingAssignmentService.getManaged(assignmentId)) }
    catch (reason) { setError(message(reason)) }
    finally { setLoading(false) }
  }, [assignmentId])
  useEffect(() => { void load() }, [load])

  async function cancel() {
    if (!assignment || saving || !window.confirm('Xác nhận hủy phân công này?')) return
    setSaving(true); setError('')
    try { setAssignment(await trainingAssignmentService.cancel(assignment.id)) }
    catch (reason) { setError(message(reason)) }
    finally { setSaving(false) }
  }

  if (loading) return <LoadingState label="Đang tải chi tiết phân công..." />
  if (!assignment) return <ErrorState title="Không thể tải phân công" description={error || 'Phân công không tồn tại.'} action={<Button onClick={() => navigate('/training-assignments')}>Về danh sách</Button>} />
  return <div className="mx-auto max-w-5xl space-y-6 pb-8">
    <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-brand" onClick={() => navigate('/training-assignments')}><ArrowLeft className="h-3.5 w-3.5" /> Danh sách phân công</button>
    <PageHeader eyebrow="Chi tiết phân công" title={assignment.program.name} description={`Phân công cho ${assignment.assignedTo.displayName}. Chỉ hiển thị metadata tiến độ, không hiển thị hội thoại riêng tư.`} action={<Badge className={assignmentStateClass(assignment.state)}>{assignmentStateLabel(assignment.state)}</Badge>} />
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Surface className="border border-border p-5 shadow-subtle sm:p-6"><h2 className="text-base font-bold text-ink">Thông tin phân công</h2><dl className="mt-4 grid gap-4 text-sm"><Info label="Nhân viên" value={`${assignment.assignedTo.displayName} · ${assignment.assignedTo.email}`} /><Info label="Người giao" value={assignment.assignedBy.displayName} /><Info label="Ngày giao" value={formatAssignmentDate(assignment.assignedAt)} /><Info label="Hạn hoàn thành" value={formatAssignmentDate(assignment.dueAt)} warning={assignment.isOverdue} /></dl><div className="mt-5 border-t border-border pt-5"><AssignmentProgress completed={assignment.completedItems} total={assignment.totalItems} percent={assignment.progressPercent} /></div></Surface>
      <Surface className="overflow-hidden border border-border shadow-subtle"><div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-6"><div><h2 className="text-base font-bold text-ink">Nội dung chương trình</h2><p className="mt-1 text-xs text-ink-muted">Trạng thái được suy ra từ các phiên của nhân viên.</p></div><Button aria-label="Làm mới tiến độ" size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div><div className="divide-y divide-border border-t border-border">{assignment.items.map((item) => <article key={item.id} className="p-4 transition-colors hover:bg-surface-subtle/40 sm:px-6"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-ink">{item.sortOrder}. {item.personaLabel ?? item.personaId}</p><span className="text-xs font-semibold text-brand">{assignmentItemStateLabel(item.state)}</span></div><p className="mt-1 text-xs text-ink-secondary">{item.scenarioLabel ?? item.scenarioId}</p><p className="mt-2 text-xs text-ink-muted">{trainingModeLabel(item.mode)}</p></article>)}</div></Surface>
    </div>
    {(assignment.state === 'ASSIGNED' || assignment.state === 'IN_PROGRESS') && <div className="flex justify-end"><Button variant="danger" icon={<XCircle className="h-4 w-4" />} disabled={saving} onClick={() => void cancel()}>{saving ? 'Đang hủy...' : 'Hủy phân công'}</Button></div>}
  </div>
}

function Info({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</dt><dd className={`mt-1 font-semibold ${warning ? 'text-red-700' : 'text-ink'}`}>{value}</dd></div> }
function message(reason: unknown): string { return reason instanceof Error ? reason.message : 'Không thể xử lý phân công đào tạo.' }
