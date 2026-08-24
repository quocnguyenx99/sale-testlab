import { Award, ChevronLeft, ChevronRight, Medal, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
import { gamificationService } from '../services/gamificationService'
import type { LeaderboardData } from '../types/gamification'

export function LeaderboardPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    let active = true
    setLoading(true)
    setError(false)
    gamificationService.getLeaderboard(page)
      .then((value) => { if (active) setData(value) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page])

  useEffect(() => load(), [load])

  const header = <PageHeader eyebrow="Gamification" title="Bảng xếp hạng" description="Ghi nhận nỗ lực luyện tập của đội ngũ SALE trong tháng hiện tại." />
  if (loading) return <div className="mx-auto max-w-5xl space-y-6 pb-8">{header}<LoadingState label="Đang tải bảng xếp hạng..." /></div>
  if (error || !data) return <div className="mx-auto max-w-5xl space-y-6 pb-8">{header}<ErrorState title="Không thể tải bảng xếp hạng" description="Vui lòng thử lại sau." action={<Button variant="secondary" onClick={load}>Thử lại</Button>} /></div>

  const monthLabel = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: data.period.timezone }).format(new Date(data.period.startAt))
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {header}
      <Card className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Trophy className="h-5 w-5" /></div><div><p className="text-sm font-bold text-ink capitalize">{monthLabel}</p><p className="text-xs text-ink-muted">Múi giờ {data.period.timezone} · {data.totalParticipants} người tham gia</p></div></div>
        {data.currentUser && <p className="text-sm text-ink-secondary">Hạng của bạn: <span className="font-bold text-brand">#{data.currentUser.rank}</span></p>}
      </Card>

      {data.rows.length === 0 ? <EmptyState title="Chưa có xếp hạng trong tháng này" description="Bảng xếp hạng sẽ xuất hiện khi SALE hoàn thành phiên đủ điều kiện và nhận XP." /> : (
        <div className="space-y-3" aria-label="Danh sách xếp hạng">
          {data.rows.map((row) => <Card key={`${row.rank}-${row.displayName}`} className={`p-4 sm:p-5 ${row.isCurrentUser ? 'border-brand-border bg-brand-soft/30' : ''}`}>
            <div className="flex items-center gap-3 sm:gap-5">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold ${row.rank <= 3 ? 'bg-amber-50 text-amber-700' : 'bg-surface-subtle text-ink-secondary'}`}>{row.rank <= 3 ? <Medal className="h-5 w-5" /> : `#${row.rank}`}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-bold text-ink">{row.displayName}</h2>{row.isCurrentUser && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">Bạn</span>}</div><p className="mt-1 text-xs text-ink-muted">Level {row.level} · {row.creditedSessions} phiên được ghi nhận</p></div>
              <div className="shrink-0 text-right"><p className="text-lg font-bold tabular-nums text-ink">{row.currentMonthXp}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">XP tháng</p></div>
            </div>
          </Card>)}
        </div>
      )}

      {data.totalPages > 1 && <div className="flex items-center justify-center gap-3"><Button aria-label="Trang trước" variant="secondary" disabled={page <= 1} icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setPage((value) => value - 1)}>Trước</Button><span className="text-xs font-semibold text-ink-secondary">Trang {page}/{data.totalPages}</span><Button aria-label="Trang sau" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Sau<ChevronRight className="h-4 w-4" /></Button></div>}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted"><Award className="h-3.5 w-3.5" />XP phản ánh mức độ luyện tập; điểm đánh giá kỹ năng vẫn được xem riêng trong Tiến độ.</p>
    </div>
  )
}
