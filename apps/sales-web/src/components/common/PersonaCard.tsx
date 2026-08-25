import { ArrowRight, Eye } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Badge, DifficultyBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import type { PublicPersona } from '../../types/training'

export function PersonaCard({
  persona,
  onPractice,
  onView,
}: {
  persona: PublicPersona
  onPractice: () => void
  onView?: () => void
}) {
  return (
    <Card className="flex h-full flex-col p-5 transition-colors duration-150 hover:border-brand-border hover:bg-brand-subtle/30">
      <div className="flex items-start justify-between gap-3">
        <Avatar initials={persona.initials} color={persona.color} size="md" />
        <DifficultyBadge value={persona.difficulty} />
      </div>
      <div className="mt-3.5">
        <h3 className="text-base font-bold text-ink">{persona.displayName}</h3>
        <p className="mt-0.5 text-xs font-semibold text-brand">{persona.role}</p>
        <p className="text-xs text-ink-muted">{persona.customerType}</p>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-secondary">
        {persona.summary}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {persona.interests.slice(0, 3).map((interest) => (
          <Badge key={interest}>{interest}</Badge>
        ))}
      </div>
      <div className="mt-auto mt-5 flex gap-2 border-t border-border pt-4">
        {onView && (
          <Button
            aria-label={`Xem chi tiết ${persona.displayName}`}
            variant="secondary"
            className="px-3 shrink-0"
            icon={<Eye className="h-4 w-4" />}
            onClick={onView}
          />
        )}
        <Button
          className="flex-1"
          icon={<ArrowRight className="h-4 w-4" />}
          onClick={onPractice}
        >
          Luyện tập
        </Button>
      </div>
    </Card>
  )
}
