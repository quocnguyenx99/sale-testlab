export function Brand({ compact = false, adaptive = false }: { compact?: boolean; adaptive?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand text-xs font-bold tracking-[-0.04em] text-white shadow-brand">
        TL
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border border-white/70 bg-white" aria-hidden="true" />
      </div>
      {!compact && (
        <div className={`min-w-0 ${adaptive ? 'hidden xl:block' : ''}`}>
          <div className="text-sm font-bold leading-tight tracking-[-0.02em] text-ink">
            AI Sales TestLab
          </div>
          <div className="mt-0.5 text-xs font-semibold leading-[18px] text-brand">
            Sales training
          </div>
        </div>
      )}
    </div>
  )
}
