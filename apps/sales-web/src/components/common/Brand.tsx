import { BrandMark } from './BrandMark'

export function Brand({ compact = false, adaptive = false }: { compact?: boolean; adaptive?: boolean }) {
  return (
    <div aria-label="TestLab — AI Sales Training" className="flex items-center gap-2.5" role="img">
      <BrandMark />
      {!compact && (
        <div className={`min-w-0 ${adaptive ? 'hidden xl:block' : ''}`}>
          <div className="text-sm font-bold leading-tight tracking-[-0.025em] text-ink">
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
