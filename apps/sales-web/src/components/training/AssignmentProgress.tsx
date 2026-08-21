export function AssignmentProgress({ completed, total, percent }: { completed: number; total: number; percent: number }) {
  return (
    <div aria-label={`Tiến độ ${completed} trên ${total}`}>
      <div className="mb-1.5 flex items-center justify-between text-xs text-ink-secondary">
        <span>{completed}/{total} nội dung</span>
        <span className="font-bold text-ink">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
