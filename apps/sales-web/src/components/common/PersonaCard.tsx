import { ArrowRight, Eye } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Badge, DifficultyBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import type { PublicPersona } from '../../types/training'

export function PersonaCard({ persona, onPractice, onView }: { persona: PublicPersona; onPractice: () => void; onView?: () => void }) {
  return <Card className="group flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-float">
    <div className="flex items-start justify-between gap-3"><Avatar initials={persona.initials} color={persona.color} /><DifficultyBadge value={persona.difficulty} /></div>
    <div className="mt-4"><h3 className="text-lg font-extrabold text-slate-900">{persona.displayName}</h3><p className="mt-0.5 text-sm font-semibold text-blue-700">{persona.role}</p><p className="text-xs text-slate-500">{persona.customerType}</p></div>
    <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{persona.summary}</p>
    <div className="mt-4 flex flex-wrap gap-1.5">{persona.interests.slice(0, 3).map((interest) => <Badge key={interest}>{interest}</Badge>)}</div>
    <div className="mt-auto flex gap-2 pt-5">{onView && <Button aria-label={`Xem chi tiết ${persona.displayName}`} variant="secondary" className="px-3" icon={<Eye className="h-4 w-4" />} onClick={onView} />}<Button className="flex-1" icon={<ArrowRight className="h-4 w-4" />} onClick={onPractice}>Luyện tập</Button></div>
  </Card>
}
