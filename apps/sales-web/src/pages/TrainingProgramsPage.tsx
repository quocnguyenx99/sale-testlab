import { BookOpenCheck, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from '../components/ui/Feedback'
import { Surface } from '../components/ui/Surface'
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
    try {
      setPrograms(await trainingProgramService.list())
    } catch (reason) {
      setError(reason)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState label="Đang tải chương trình đào tạo..." />
  if (error instanceof TrainingProgramApiError && error.status === 403) {
    return <ForbiddenState action={<Button onClick={() => navigate('/dashboard')}>Về trang tổng quan</Button>} />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <PageHeader
        eyebrow="Quản lý đào tạo"
        title="Chương trình đào tạo"
        description="Xây dựng nội dung luyện tập nhất quán trước khi phân công cho đội ngũ SALE."
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
          description="Tạo bản nháp đầu tiên và thêm nội dung luyện tập từ thư viện khách hàng AI hiện có."
          action={<Button onClick={() => navigate('/training-programs/new')}>Tạo chương trình đầu tiên</Button>}
        />
      ) : (
        <Surface className="overflow-hidden border border-border shadow-subtle">
          <div className="hidden grid-cols-[minmax(0,1fr)_130px_140px_auto] gap-4 border-b border-border bg-surface-subtle/60 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted md:grid">
            <span>Chương trình</span><span>Nội dung</span><span>Cập nhật</span><span className="text-right">Thao tác</span>
          </div>
          <div className="divide-y divide-border">
            {programs.map((program) => (
              <article key={program.id} className="grid gap-4 p-4 transition-colors hover:bg-surface-subtle/40 sm:p-5 md:grid-cols-[minmax(0,1fr)_130px_140px_auto] md:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><BookOpenCheck className="h-5 w-5" aria-hidden="true" /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-ink">{program.name}</h2>
                      <Badge className={trainingProgramStatusClass(program.status)}>{trainingProgramStatusLabel(program.status)}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-secondary">{program.description || 'Chưa có mô tả.'}</p>
                  </div>
                </div>
                <p className="text-xs text-ink-secondary"><span className="font-bold tabular-nums text-ink">{program.items.length}</span> nội dung</p>
                <p className="text-xs text-ink-muted" title={program.updatedAt}>{formatTrainingProgramDate(program.updatedAt)}</p>
                <Button className="w-full md:w-auto" variant="secondary" onClick={() => navigate(`/training-programs/${program.id}`)}>{program.status === 'DRAFT' ? 'Mở và chỉnh sửa' : 'Xem chương trình'}</Button>
              </article>
            ))}
          </div>
        </Surface>
      )}
    </div>
  )
}
