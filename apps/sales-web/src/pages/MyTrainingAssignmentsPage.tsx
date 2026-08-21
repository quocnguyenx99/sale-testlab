import { ArrowRight, ListChecks, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { AssignmentProgress } from '../components/training/AssignmentProgress'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
import { trainingAssignmentService } from '../services/trainingAssignmentService'
import type { OwnTrainingAssignment } from '../types/trainingAssignment'
import { assignmentStateClass, assignmentStateLabel, formatAssignmentDate } from '../utils/trainingAssignmentPresentation'

export function MyTrainingAssignmentsPage() {
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<OwnTrainingAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setAssignments(await trainingAssignmentService.listOwn()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải bài tập.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  if (loading) return <LoadingState label="Đang tải bài tập được giao..." />
  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <PageHeader eyebrow="My assignments" title="Bài tập được giao" description="Hoàn thành từng nội dung bằng chính luồng luyện tập hiện có. Không cần Evaluation hoặc Coach để ghi nhận hoàn thành." />
    {error ? <ErrorState title="Không thể tải bài tập được giao" description={error} action={<Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Thử lại</Button>} /> : assignments.length === 0 ? <EmptyState title="Bạn chưa có bài tập được giao" description="Các chương trình được quản lý phân công sẽ xuất hiện tại đây." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assignments.map((assignment) => <Card key={assignment.id} className="flex flex-col justify-between p-5"><div><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><ListChecks className="h-5 w-5" /></div><Badge className={assignmentStateClass(assignment.state)}>{assignmentStateLabel(assignment.state)}</Badge></div><h2 className="mt-4 text-base font-bold text-ink">{assignment.program.name}</h2><p className="mt-1 line-clamp-2 text-sm text-ink-secondary">{assignment.program.description || 'Chương trình luyện tập được giao.'}</p><div className="mt-4"><AssignmentProgress completed={assignment.completedItems} total={assignment.totalItems} percent={assignment.progressPercent} /></div><div className="mt-4 flex justify-between text-xs text-ink-muted"><span>Giao: {formatAssignmentDate(assignment.assignedAt)}</span><span className={assignment.isOverdue ? 'font-semibold text-red-700' : ''}>Hạn: {formatAssignmentDate(assignment.dueAt)}</span></div></div><Button className="mt-5 w-full" variant="secondary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate(`/my-training-assignments/${assignment.id}`)}>Xem bài tập</Button></Card>)}</div>}
  </div>
}
