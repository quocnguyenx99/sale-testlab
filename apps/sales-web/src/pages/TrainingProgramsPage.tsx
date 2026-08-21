import { BookOpenCheck, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from '../components/ui/Feedback'
import { TrainingProgramApiError, trainingProgramService } from '../services/trainingProgramService'
import type { TrainingProgram } from '../types/trainingProgram'
import { formatTrainingProgramDate, trainingProgramStatusClass, trainingProgramStatusLabel } from '../utils/trainingProgramPresentation'

export function TrainingProgramsPage() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setPrograms(await trainingProgramService.list()) }
    catch (reason) { setError(reason) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState label="Đang tải chương trình đào tạo..." />
  if (error instanceof TrainingProgramApiError && error.status === 403) {
    return <ForbiddenState action={<Button onClick={() => navigate('/dashboard')}>Về trang tổng quan</Button>} />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <PageHeader
        eyebrow="Training programs"
        title="Chương trình đào tạo"
        description="Xây dựng nội dung luyện tập nhất quán trước khi phân công ở giai đoạn tiếp theo."
        action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/training-programs/new')}>Tạo chương trình</Button>}
      />

      {error ? (
        <ErrorState
          title="Không thể tải chương trình đào tạo"
          description={error instanceof Error ? error.message : undefined}
          action={<Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Thử lại</Button>}
        />
      ) : programs.length === 0 ? (
        <EmptyState
          title="Chưa có chương trình đào tạo"
          description="Tạo bản nháp đầu tiên và thêm các nội dung luyện tập từ thư viện khách hàng AI hiện có."
          action={<Button onClick={() => navigate('/training-programs/new')}>Tạo chương trình đầu tiên</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} className="flex min-h-60 flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <Badge className={trainingProgramStatusClass(program.status)}>{trainingProgramStatusLabel(program.status)}</Badge>
                </div>
                <h2 className="mt-4 text-base font-bold text-ink">{program.name}</h2>
                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-secondary">
                  {program.description || 'Chưa có mô tả.'}
                </p>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>{program.items.length} nội dung</span>
                  <span title={program.updatedAt}>{formatTrainingProgramDate(program.updatedAt)}</span>
                </div>
                <Button className="mt-3 w-full" variant="secondary" onClick={() => navigate(`/training-programs/${program.id}`)}>
                  {program.status === 'DRAFT' ? 'Mở và chỉnh sửa' : 'Xem chương trình'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
