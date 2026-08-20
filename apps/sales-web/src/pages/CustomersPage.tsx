import { Building2, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { PersonaCard } from '../components/common/PersonaCard'
import { Avatar } from '../components/ui/Avatar'
import { Badge, DifficultyBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/Feedback'
import { SearchInput, Select } from '../components/ui/FormControls'
import { Modal } from '../components/ui/Modal'
import { trainingService } from '../services/trainingService'
import type { Difficulty, PublicPersona } from '../types/training'

export function CustomersPage() {
  const navigate = useNavigate()
  const [personas, setPersonas] = useState<PublicPersona[]>([])
  const [selected, setSelected] = useState<PublicPersona | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | 'ALL'>('ALL')
  const [type, setType] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    trainingService
      .getPersonas()
      .then(setPersonas)
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể tải thư viện khách hàng.')
      )
      .finally(() => setLoading(false))
  }, [])

  const customerTypes = useMemo(
    () => [...new Set(personas.map((item) => item.customerType))],
    [personas]
  )

  const filtered = useMemo(() => {
    return personas.filter((persona) => {
      const term = search.trim().toLocaleLowerCase('vi')
      const matchesSearch =
        !term ||
        `${persona.displayName} ${persona.role} ${persona.customerType}`
          .toLocaleLowerCase('vi')
          .includes(term)
      const matchesDifficulty = difficulty === 'ALL' || persona.difficulty === difficulty
      const matchesType = type === 'ALL' || persona.customerType === type
      return matchesSearch && matchesDifficulty && matchesType
    })
  }, [difficulty, personas, search, type])

  const clearFilters = () => {
    setSearch('')
    setDifficulty('ALL')
    setType('ALL')
  }

  const practice = (persona: PublicPersona) => {
    navigate(`/practice/new?personaId=${persona.id}`)
  }

  const isFiltered = search.trim() !== '' || difficulty !== 'ALL' || type !== 'ALL'

  return (
    <>
      <PageHeader
        eyebrow="Khách hàng AI"
        title="Thư viện khách hàng AI"
        description="Lựa chọn kiểu khách hàng và luyện tập theo tình huống phù hợp với mục tiêu của bạn."
      />

      {/* Search & Filter Toolbar */}
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_180px_200px]">
        <SearchInput
          aria-label="Tìm khách hàng"
          placeholder="Tìm theo tên, vai trò..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Select
            aria-label="Lọc độ khó"
            className="pl-10"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as Difficulty | 'ALL')}
          >
            <option value="ALL">Tất cả độ khó</option>
            <option value="EASY">Dễ</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HARD">Khó</option>
          </Select>
        </div>
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Select
            aria-label="Lọc nhóm khách hàng"
            className="pl-10"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="ALL">Tất cả nhóm khách hàng</option>
            {customerTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Content States */}
      {loading ? (
        <LoadingState label="Đang tải thư viện khách hàng..." />
      ) : error ? (
        <ErrorState
          title="Không thể tải thư viện khách hàng"
          description={error}
          action={
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Thử tải lại
            </Button>
          }
        />
      ) : filtered.length ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-secondary tabular-nums">
              {filtered.length} khách hàng phù hợp
            </p>
            {isFiltered && (
              <button
                className="text-xs font-semibold text-brand hover:text-brand-hover transition-colors"
                onClick={clearFilters}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                onView={() => setSelected(persona)}
                onPractice={() => practice(persona)}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="Không tìm thấy khách hàng phù compliance"
          description="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc để xem thêm lựa chọn."
          action={
            isFiltered ? (
              <Button variant="secondary" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Persona Detail Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Chi tiết khách hàng"
        footer={
          selected && (
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Đóng
              </Button>
              <Button onClick={() => practice(selected)}>
                Luyện tập với {selected.displayName}
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            {/* Header info */}
            <div className="flex items-start gap-4">
              <Avatar initials={selected.initials} color={selected.color} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-ink truncate">{selected.displayName}</h3>
                  <DifficultyBadge value={selected.difficulty} />
                </div>
                <p className="text-xs font-semibold text-brand mt-0.5">{selected.role}</p>
                <p className="text-xs text-ink-muted">{selected.customerType}</p>
              </div>
            </div>

            {/* Summary */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Phong cách khách hàng
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                {selected.summary}
              </p>
            </div>

            {/* Public Scenario Context */}
            <div className="rounded-lg border border-border bg-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Bối cảnh tình huống
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                {selected.scenarioContext}
              </p>
            </div>

            {/* Public Interests */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
                Chủ đề quan tâm
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selected.interests.map((item) => (
                  <Badge key={item}>{item}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
