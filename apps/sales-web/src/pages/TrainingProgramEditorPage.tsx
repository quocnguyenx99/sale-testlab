import { Archive, ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { Input, Select } from '../components/ui/FormControls'
import { TrainingProgramApiError, trainingProgramService } from '../services/trainingProgramService'
import { trainingService } from '../services/trainingService'
import type { PublicPersona, TrainingMode } from '../types/training'
import type { TrainingProgram } from '../types/trainingProgram'
import { isTrainingProgramEditable, trainingProgramStatusClass, trainingProgramStatusLabel } from '../utils/trainingProgramPresentation'

interface DraftItem {
  key: string
  personaId: string
  scenarioId: string
  mode: TrainingMode
}

export function TrainingProgramEditorPage() {
  const navigate = useNavigate()
  const { programId } = useParams()
  const isNew = !programId
  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [personas, setPersonas] = useState<PublicPersona[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([trainingService.getPersonas(), programId ? trainingProgramService.get(programId) : Promise.resolve(null)])
      .then(([availablePersonas, loaded]) => {
        if (!active) return
        setPersonas(availablePersonas)
        if (loaded) applyProgram(loaded)
      })
      .catch((reason: unknown) => { if (active) setError(message(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [programId])

  const editable = isNew || (program ? isTrainingProgramEditable(program.status) : false)
  const personaById = useMemo(() => new Map(personas.map((persona) => [persona.id, persona])), [personas])

  function applyProgram(next: TrainingProgram) {
    setProgram(next)
    setName(next.name)
    setDescription(next.description ?? '')
    setItems(next.items.map((item) => ({ key: item.id, personaId: item.personaId, scenarioId: item.scenarioId, mode: item.mode })))
  }

  function addItem() {
    const persona = personas[0]
    if (!persona) return
    setItems((current) => [...current, {
      key: crypto.randomUUID(), personaId: persona.id, scenarioId: persona.defaultScenario.id, mode: 'SALE_FIRST',
    }])
  }

  function updateItem(index: number, changes: Partial<DraftItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item))
  }

  function selectPersona(index: number, personaId: string) {
    const persona = personaById.get(personaId)
    if (persona) updateItem(index, { personaId, scenarioId: persona.defaultScenario.id })
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    setItems((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError('')
    const input = {
      name,
      description: description.trim() || null,
      items: items.map((item, index) => ({
        personaId: item.personaId, scenarioId: item.scenarioId, mode: item.mode, sortOrder: index + 1,
      })),
    }
    try {
      const saved = program ? await trainingProgramService.update(program.id, input) : await trainingProgramService.create(input)
      applyProgram(saved)
      if (isNew) navigate(`/training-programs/${saved.id}`, { replace: true })
    } catch (reason) { setError(message(reason)) }
    finally { setSaving(false) }
  }

  async function publish() {
    if (!program || saving) return
    setSaving(true); setError('')
    try { applyProgram(await trainingProgramService.publish(program.id)) }
    catch (reason) { setError(message(reason)) }
    finally { setSaving(false) }
  }

  async function archiveProgram() {
    if (!program || saving) return
    setSaving(true); setError('')
    try { applyProgram(await trainingProgramService.archive(program.id)) }
    catch (reason) { setError(message(reason)) }
    finally { setSaving(false) }
  }

  async function deleteProgram() {
    if (!program || saving) return
    setSaving(true); setError('')
    try { await trainingProgramService.deleteDraft(program.id); navigate('/training-programs', { replace: true }) }
    catch (reason) { setError(message(reason)); setSaving(false); setConfirmDelete(false) }
  }

  if (loading) return <LoadingState label="Đang tải chương trình đào tạo..." />
  if (programId && !program) {
    return <ErrorState title="Không thể tải chương trình" description={error || 'Chương trình không tồn tại.'} action={<Button onClick={() => navigate('/training-programs')}>Về danh sách</Button>} />
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-brand" onClick={() => navigate('/training-programs')}>
        <ArrowLeft className="h-3.5 w-3.5" /> Danh sách chương trình
      </button>
      <PageHeader
        eyebrow="Training program"
        title={isNew ? 'Tạo chương trình đào tạo' : program?.name ?? 'Chương trình đào tạo'}
        description={editable ? 'Biên soạn chuỗi nội dung luyện tập từ Persona và tình huống hiện có.' : 'Nội dung đã khóa để bảo toàn cấu hình đã xuất bản.'}
        action={program ? <Badge className={trainingProgramStatusClass(program.status)}>{trainingProgramStatusLabel(program.status)}</Badge> : undefined}
      />

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <Card className="p-5 sm:p-6">
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Tên chương trình
            <Input aria-label="Tên chương trình" value={name} maxLength={160} disabled={!editable} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Mô tả
            <textarea
              aria-label="Mô tả"
              value={description}
              maxLength={2000}
              disabled={!editable}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-surface-subtle disabled:opacity-70"
            />
          </label>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-ink">Nội dung luyện tập</h2>
            <p className="mt-1 text-xs text-ink-secondary">Tình huống được lấy trực tiếp từ Persona để luôn tương thích với Practice Setup.</p>
          </div>
          {editable && <Button variant="secondary" icon={<Plus className="h-4 w-4" />} disabled={personas.length === 0} onClick={addItem}>Thêm nội dung</Button>}
        </div>

        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-subtle/50 p-6 text-center text-sm text-ink-muted">
              Chưa có nội dung luyện tập. Chương trình cần ít nhất một nội dung để xuất bản.
            </div>
          ) : items.map((item, index) => {
            const persona = personaById.get(item.personaId)
            return (
              <div key={item.key} className="rounded-xl border border-border bg-surface-subtle/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand">Nội dung {index + 1}</span>
                  {editable && <div className="flex gap-1">
                    <Button aria-label={`Di chuyển nội dung ${index + 1} lên`} size="sm" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button aria-label={`Di chuyển nội dung ${index + 1} xuống`} size="sm" variant="ghost" disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button aria-label={`Xóa nội dung ${index + 1}`} size="sm" variant="ghost" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </div>}
                </div>
                <div className="mt-3 grid gap-4 lg:grid-cols-3">
                  <label className="grid gap-1.5 text-xs font-semibold text-ink-secondary">
                    Persona
                    {editable ? <Select aria-label={`Persona nội dung ${index + 1}`} value={item.personaId} onChange={(event) => selectPersona(index, event.target.value)}>
                      {personas.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}
                    </Select> : <p className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink">{persona?.displayName ?? item.personaId}</p>}
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-ink-secondary">
                    Tình huống
                    <p className="min-h-10 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink">{persona?.defaultScenario.title ?? item.scenarioId}</p>
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-ink-secondary">
                    Chế độ
                    {editable ? <Select aria-label={`Chế độ nội dung ${index + 1}`} value={item.mode} onChange={(event) => updateItem(index, { mode: event.target.value as TrainingMode })}>
                      <option value="SALE_FIRST">Bạn mở lời</option>
                      <option value="CUSTOMER_FIRST">Khách hàng mở lời</option>
                    </Select> : <p className="rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink">{item.mode === 'SALE_FIRST' ? 'Bạn mở lời' : 'Khách hàng mở lời'}</p>}
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <div>
          {program?.status === 'DRAFT' && (!confirmDelete ? (
            <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>Xóa bản nháp</Button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2">
              <span className="px-2 text-xs font-semibold text-red-700">Xác nhận xóa?</span>
              <Button size="sm" variant="danger" disabled={saving} onClick={() => void deleteProgram()}>Xóa</Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>Hủy</Button>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {editable && <Button variant="secondary" icon={<Save className="h-4 w-4" />} disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? 'Đang lưu...' : 'Lưu bản nháp'}</Button>}
          {program?.status === 'DRAFT' && <Button icon={<Send className="h-4 w-4" />} disabled={saving || program.items.length === 0} onClick={() => void publish()}>Xuất bản</Button>}
          {program?.status === 'PUBLISHED' && <Button icon={<Archive className="h-4 w-4" />} disabled={saving} onClick={() => void archiveProgram()}>Lưu trữ</Button>}
        </div>
      </div>
    </div>
  )
}

function message(reason: unknown): string {
  if (reason instanceof TrainingProgramApiError || reason instanceof Error) return reason.message
  return 'Không thể xử lý chương trình đào tạo.'
}
