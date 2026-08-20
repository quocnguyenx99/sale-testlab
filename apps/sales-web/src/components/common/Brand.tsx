import { Sparkles } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-subtle shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-tight text-ink leading-tight">
            AI Sales TestLab
          </div>
          <div className="text-[10px] font-semibold tracking-wider uppercase text-brand">
            V3 Training
          </div>
        </div>
      )}
    </div>
  )
}
