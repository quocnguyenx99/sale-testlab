import { ArrowLeft, CheckCircle2, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { AssignmentProgress } from '../components/training/AssignmentProgress'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
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
    setLoading(true); setError('')
    try { setAssignment(await trainingAssignmentService.getOwn(assignmentId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải bài tập.') }
    finally { setLoading(false) }
  }, [assignmentId])
  useEffect(() => { void load() }, [load])

  async function start(itemId: string, activeSessionId: string | null) {
    if (activeSessionId) { navigate(`/practice/${activeSessionId}`); return }
    setStarting(itemId); setError('')
    try {
      const session = await trainingAssignmentService.startItem(assignmentId, itemId)
      navigate(`/practice/${session.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể bắt đầu nội dung luyện tập.') }
    finally { setStarting(null) }
  }

  if (loading) return <LoadingState label="Đang tải bài tập..." />
  if (!assignment) return <ErrorState title="Không thể tải bài tập" description={error || 'Bài tập không tồn tại.'} action={<Button onClick={() => navigate('/my-training-assignments')}>Về danh sách</Button>} />
  return <div className="mx-auto max-w-5xl space-y-6 pb-8">
    <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-brand" onClick={() => navigate('/my-training-assignments')}><ArrowLeft className="h-3.5 w-3.5" /> Bài tập được giao</button>
    <PageHeader eyebrow="Assigned training" title={assignment.program.name} description={assignment.program.description || 'Hoàn thành các nội dung theo đúng thứ tự phù hợp với kế hoạch luyện tập của bạn.'} action={<Badge className={assignmentStateClass(assignment.state)}>{assignmentStateLabel(assignment.state)}</Badge>} />
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-ink">Tiến độ chương trình</h2><p className="mt-1 text-xs text-ink-muted">Hạn hoàn thành: {formatAssignmentDate(assignment.dueAt)}</p></div><Button aria-label="Làm mới tiến độ" size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div><div className="mt-4"><AssignmentProgress completed={assignment.completedItems} total={assignment.totalItems} percent={assignment.progressPercent} /></div></Card>
    <div className="space-y-3">{assignment.items.map((item) => <Card key={item.id} className="p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-xs font-bold text-brand">{item.sortOrder}</span><h2 className="truncate text-sm font-bold text-ink">{item.personaLabel ?? item.personaId}</h2></div><p className="mt-2 text-xs text-ink-secondary">{item.scenarioLabel ?? item.scenarioId}</p><p className="mt-1 text-xs text-ink-muted">{trainingModeLabel(item.mode)} · {assignmentItemStateLabel(item.state)}</p></div><div className="shrink-0">{item.state === 'COMPLETED' ? <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Hoàn thành</span> : assignment.state === 'CANCELLED' ? <span className="text-xs font-semibold text-ink-muted">Không thể bắt đầu do phân công đã hủy</span> : <Button icon={<Play className="h-4 w-4" />} disabled={starting === item.id} onClick={() => void start(item.id, item.activeSessionId)}>{item.activeSessionId ? 'Tiếp tục luyện tập' : starting === item.id ? 'Đang bắt đầu...' : 'Bắt đầu luyện tập'}</Button>}</div></div></Card>)}</div>
  </div>
}
