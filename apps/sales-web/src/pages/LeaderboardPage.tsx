import { Award, ChevronLeft, ChevronRight, Medal, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
import { Surface } from '../components/ui/Surface'
import { gamificationService } from '../services/gamificationService'
import type { LeaderboardData } from '../types/gamification'

function RankMark({ rank }: { rank: number }) {
  const isTopThree = rank <= 3
  return (
    <div
      aria-label={`Hạng ${rank}`}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold ${
        isTopThree ? 'bg-amber-50 text-amber-700' : 'bg-surface-subtle text-ink-secondary'
      }`}
    >
      {isTopThree ? <Medal className="h-[18px] w-[18px]" /> : rank}
    </div>
  )
}

export function LeaderboardPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    let active = true
    setLoading(true)
    setError(false)
    gamificationService
      .getLeaderboard(page)
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [page])

  useEffect(() => load(), [load])

  const header = (
    <PageHeader
      eyebrow="Thi đua luyện tập"
      title="Bảng xếp hạng"
      description="Ghi nhận nhịp độ luyện tập của đội ngũ SALE trong tháng hiện tại. Điểm kỹ năng vẫn được theo dõi riêng trong Tiến độ."
    />
  )

  if (loading) {
    return <div className="mx-auto max-w-5xl space-y-6 pb-8">{header}<LoadingState label="Đang tải bảng xếp hạng..." /></div>
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-8">
        {header}
        <ErrorState title="Không thể tải bảng xếp hạng" description="Vui lòng thử lại sau." action={<Button variant="secondary" onClick={load}>Thử lại</Button>} />
      </div>
    )
  }

  const monthLabel = new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
    timeZone: data.period.timezone,
  }).format(new Date(data.period.startAt))

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {header}
      <Surface className="flex flex-col justify-between gap-3 border border-border px-4 py-4 shadow-subtle sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><Trophy className="h-[18px] w-[18px]" /></div>
          <div>
            <p className="text-sm font-bold capitalize text-ink">{monthLabel}</p>
            <p className="mt-0.5 text-xs text-ink-muted">Múi giờ {data.period.timezone} · {data.totalParticipants} người tham gia</p>
          </div>
        </div>
        {data.currentUser && <p className="text-sm text-ink-secondary">Hạng của bạn: <span className="font-bold tabular-nums text-brand">#{data.currentUser.rank}</span></p>}
      </Surface>

      {data.rows.length === 0 ? (
        <EmptyState title="Chưa có xếp hạng trong tháng này" description="Bảng xếp hạng sẽ xuất hiện khi SALE hoàn thành phiên đủ điều kiện và nhận XP." />
      ) : (
        <Surface className="overflow-hidden border border-border shadow-subtle" aria-label="Danh sách xếp hạng">
          <div className="hidden grid-cols-[56px_minmax(0,1fr)_130px_120px] gap-4 border-b border-border bg-surface-subtle/60 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted md:grid">
            <span>Hạng</span><span>Thành viên</span><span>Phiên ghi nhận</span><span className="text-right">XP tháng</span>
          </div>
          <div className="divide-y divide-border">
            {data.rows.map((row) => (
              <article
                key={`${row.rank}-${row.displayName}`}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition-colors md:grid-cols-[56px_minmax(0,1fr)_130px_120px] md:gap-4 md:px-5 ${row.isCurrentUser ? 'bg-brand-soft/50' : 'hover:bg-surface-subtle/40'}`}
              >
                <RankMark rank={row.rank} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-sm font-bold text-ink">{row.displayName}</h2>
                    {row.isCurrentUser && <span className="shrink-0 rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-white">Bạn</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted md:hidden">Level {row.level} · {row.creditedSessions} phiên được ghi nhận</p>
                  <p className="mt-0.5 hidden text-xs text-ink-muted md:block">Level {row.level}</p>
                </div>
                <p className="hidden text-sm tabular-nums text-ink-secondary md:block">{row.creditedSessions}</p>
                <div className="text-right">
                  <p className="text-base font-bold tabular-nums text-ink">{row.currentMonthXp}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted md:hidden">XP tháng</p>
                </div>
              </article>
            ))}
          </div>
        </Surface>
      )}

      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button aria-label="Trang trước" variant="secondary" disabled={page <= 1} icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setPage((value) => value - 1)}>Trước</Button>
          <span className="text-xs font-semibold text-ink-secondary">Trang {page}/{data.totalPages}</span>
          <Button aria-label="Trang sau" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Sau<ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted"><Award className="h-3.5 w-3.5" />XP phản ánh mức độ luyện tập; điểm đánh giá kỹ năng vẫn được xem riêng trong Tiến độ.</p>
    </div>
  )
}
