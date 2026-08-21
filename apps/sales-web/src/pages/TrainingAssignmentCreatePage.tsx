import { ArrowLeft, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { Input, Select } from '../components/ui/FormControls'
import { trainingAssignmentService } from '../services/trainingAssignmentService'
import { trainingProgramService } from '../services/trainingProgramService'
import type { TrainingAssignee } from '../types/trainingAssignment'
import type { TrainingProgram } from '../types/trainingProgram'

export function TrainingAssignmentCreatePage() {
  const navigate = useNavigate()
  const [assignees, setAssignees] = useState<TrainingAssignee[]>([])
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [assignedToUserId, setAssignedToUserId] = useState('')
  const [programId, setProgramId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([trainingAssignmentService.listAssignees(), trainingProgramService.list()])
      .then(([users, allPrograms]) => {
        if (!active) return
        const published = allPrograms.filter((program) => program.status === 'PUBLISHED')
        setAssignees(users); setPrograms(published)
        setAssignedToUserId(users[0]?.id ?? ''); setProgramId(published[0]?.id ?? '')
      })
      .catch((reason) => { if (active) setError(message(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving || !assignedToUserId || !programId) return
    setSaving(true); setError('')
    try {
      const assignment = await trainingAssignmentService.create({
        programId,
        assignedToUserId,
        dueAt: dueDate ? new Date(`${dueDate}T23:59:59.999Z`).toISOString() : null,
      })
      navigate(`/training-assignments/${assignment.id}`, { replace: true })
    } catch (reason) { setError(message(reason)) }
    finally { setSaving(false) }
  }

  if (loading) return <LoadingState label="Đang chuẩn bị biểu mẫu phân công..." />
  if (assignees.length === 0 || programs.length === 0) return <ErrorState title="Chưa thể tạo phân công" description={assignees.length === 0 ? 'Không có nhân viên SALE đang hoạt động.' : 'Không có chương trình đã xuất bản.'} action={<Button onClick={() => navigate('/training-assignments')}>Về danh sách</Button>} />
  return <div className="mx-auto max-w-3xl space-y-6 pb-8">
    <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-brand" onClick={() => navigate('/training-assignments')}><ArrowLeft className="h-3.5 w-3.5" /> Danh sách phân công</button>
    <PageHeader eyebrow="New assignment" title="Phân công chương trình" description="Chỉ chương trình đã xuất bản và nhân viên SALE đang hoạt động được hiển thị." />
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <Card className="p-5 sm:p-6"><form className="grid gap-5" onSubmit={(event) => void submit(event)}>
      <label className="grid gap-2 text-sm font-semibold text-ink">Nhân viên SALE<Select aria-label="Nhân viên SALE" value={assignedToUserId} onChange={(event) => setAssignedToUserId(event.target.value)}>{assignees.map((user) => <option key={user.id} value={user.id}>{user.displayName} — {user.email}</option>)}</Select></label>
      <label className="grid gap-2 text-sm font-semibold text-ink">Chương trình đã xuất bản<Select aria-label="Chương trình đã xuất bản" value={programId} onChange={(event) => setProgramId(event.target.value)}>{programs.map((program) => <option key={program.id} value={program.id}>{program.name} ({program.items.length} nội dung)</option>)}</Select></label>
      <label className="grid gap-2 text-sm font-semibold text-ink">Hạn hoàn thành (không bắt buộc)<Input aria-label="Hạn hoàn thành" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      <div className="flex justify-end"><Button type="submit" icon={<Send className="h-4 w-4" />} disabled={saving}>{saving ? 'Đang phân công...' : 'Phân công chương trình'}</Button></div>
    </form></Card>
  </div>
}

function message(reason: unknown): string { return reason instanceof Error ? reason.message : 'Không thể tạo phân công đào tạo.' }
