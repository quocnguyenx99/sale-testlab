import { ArrowLeft, Bot, Check, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTraining } from '../app/TrainingContext'
import { PageHeader } from '../components/common/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { DifficultyBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/FormControls'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { trainingService } from '../services/trainingService'
import type { PublicPersona, TrainingMode } from '../types/training'

const modes = [
  {
    value: 'CUSTOMER_FIRST' as const,
    title: 'Khách hàng mở lời',
    label: 'KHÁCH HÀNG MỞ LỜI',
    description: 'Khách hàng AI bắt đầu cuộc trò chuyện trước theo bối cảnh.',
    icon: Bot,
  },
  {
    value: 'SALE_FIRST' as const,
    title: 'Bạn chủ động mở lời',
    label: 'BẠN MỞ LỜI',
    description: 'Bạn là người bắt đầu và dẫn dắt cuộc trò chuyện.',
    icon: MessageCircle,
  },
]

export function SessionSetupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { startSession } = useTraining()
  const personaId = params.get('personaId') ?? ''
  const [persona, setPersona] = useState<PublicPersona | null>(null)
  const [mode, setMode] = useState<TrainingMode>('CUSTOMER_FIRST')
  const [scenarioId, setScenarioId] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!personaId) {
      navigate('/customers', { replace: true })
      return
    }
    trainingService
      .getPersona(personaId)
      .then((value) => { setPersona(value); setScenarioId((value.scenarios?.find((item) => item.isDefault) ?? value.defaultScenario).id) })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không thể tải thông tin khách hàng.')
      )
  }, [navigate, personaId])

  async function start() {
    if (!persona || starting) return
    setStarting(true)
    setError('')
    try {
      const session = await startSession(persona.id, mode, scenarioId || persona.defaultScenario.id)
      navigate(`/practice/${session.id}`)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Không thể bắt đầu phiên luyện tập lúc này.'
      )
      setStarting(false)
    }
  }

  if (!persona && !error) {
    return <LoadingState label="Đang tải thông tin khách hàng..." />
  }

  if (!persona) {
    return (
      <div className="mx-auto max-w-lg mt-8">
        <ErrorState
          title="Không thể chuẩn bị phiên"
          description={error}
          action={<Button onClick={() => navigate('/customers')}>Quay lại thư viện</Button>}
        />
      </div>
    )
  }

  const scenario = persona.scenarios?.find((item) => item.id === scenarioId) ?? persona.defaultScenario

  return (
    <>
      <button
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-brand transition-colors"
        onClick={() => navigate('/customers')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Thư viện khách hàng
      </button>

      <PageHeader
        eyebrow="Thiết lập phiên"
        title="Thiết lập phiên luyện tập"
        description="Kiểm tra bối cảnh và chọn cách bắt đầu trước khi bước vào hội thoại."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
        {/* Left Column: Selected Persona Summary */}
        <Card className="p-6 h-fit">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Khách hàng đã chọn
            </p>
            <button
              className="text-xs font-semibold text-brand hover:text-brand-hover transition-colors"
              onClick={() => navigate('/customers')}
            >
              Đổi khách hàng
            </button>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <Avatar initials={persona.initials} color={persona.color} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink truncate">{persona.displayName}</h2>
                <DifficultyBadge value={persona.difficulty} />
              </div>
              <p className="text-xs font-semibold text-brand mt-0.5">{persona.role}</p>
              <p className="text-xs text-ink-muted">{persona.customerType}</p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Phong cách giao tiếp
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{persona.summary}</p>
          </div>
        </Card>

        {/* Right Column: Training Setup & Mode Selection */}
        <div className="space-y-5">
          {/* Scenario Context */}
          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Tình huống luyện tập
                </p>
                <h3 className="text-base font-bold text-ink">{scenario.title}</h3>
              </div>
            </div>

            {(persona.scenarios?.length ?? 0) > 1 && (
              <label className="mt-4 grid gap-2 text-xs font-semibold text-ink-secondary">
                Chọn tình huống
                <Select aria-label="Chọn tình huống" value={scenario.id} onChange={(event) => setScenarioId(event.target.value)}>
                  {persona.scenarios?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </Select>
              </label>
            )}

            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
              {scenario.description}
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/50 px-3 py-2 text-xs font-medium text-emerald-800">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              Hồ sơ khách hàng đã được ẩn danh an toàn trước khi sử dụng.
            </div>
          </Card>

          {/* Mode Selection */}
          <Card className="p-6">
            <h3 className="text-base font-bold text-ink">Ai sẽ mở đầu cuộc trò chuyện?</h3>
            <p className="mt-1 text-xs text-ink-secondary">
              Chọn cách bắt đầu phù hợp với mục tiêu luyện tập của bạn.
            </p>

            <div role="radiogroup" aria-label="Ai sẽ mở đầu cuộc trò chuyện?" className="mt-4 grid gap-3 sm:grid-cols-2">
              {modes.map(({ value, title, label, description, icon: Icon }) => {
                const active = mode === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(value)}
                    onKeyDown={(event) => {
                      if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault()
                        setMode(value)
                      }
                    }}
                    className={`relative rounded-xl border p-4 text-left transition-all duration-150 ${
                      active
                        ? 'border-brand bg-brand-soft/50 ring-2 ring-brand/15'
                        : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover'
                    }`}
                  >
                    <div
                      className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${
                        active ? 'bg-brand text-white' : 'bg-surface-subtle text-ink-secondary'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="font-bold text-sm text-ink">{title}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-brand">{label}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                      {description}
                    </p>
                    {active && (
                      <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700"
              >
                {error}
              </div>
            )}

            <div className="mt-6 flex sm:justify-end">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={starting}
                onClick={() => void start()}
              >
                {starting ? 'Đang tạo phiên...' : 'Bắt đầu phiên luyện tập'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
