import { Archive, Plus, Save, Send, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, LoadingState } from '../components/ui/Feedback'
import { Input, Select } from '../components/ui/FormControls'
import { Surface } from '../components/ui/Surface'
import { trainingContentService } from '../services/trainingContentService'
import type { ManagedScenarioDetail, ManagedScenarioSummary, ScenarioFields } from '../types/trainingContent'

const emptyScenario: ScenarioFields = { title: '', description: '', difficulty: 'MEDIUM', category: '', customerNeed: '', priorities: [], trainingObjective: '', tags: [], openingExamples: [] }
const split = (value: string) => value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)
const versionLabel = (status: 'DRAFT' | 'PUBLISHED') => status === 'DRAFT' ? 'Bản nháp' : 'Đã xuất bản'

export function ScenarioManagementPage() {
  const [items, setItems] = useState<ManagedScenarioSummary[] | null>(null); const [error, setError] = useState('')
  useEffect(() => { trainingContentService.scenarios().then(setItems).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Không thể tải tình huống.')) }, [])
  if (!items && !error) return <LoadingState label="Đang tải tình huống..." />
  if (!items) return <ErrorState title="Không thể tải tình huống" description={error} />
  return <div className="mx-auto max-w-6xl space-y-6 pb-8"><PageHeader eyebrow="Quản lý nội dung" title="Quản lý tình huống" description="Tình huống độc lập, có thể liên kết với nhiều Persona và được ghim theo phiên bản trong chương trình." action={<Link to="/manage/scenarios/new"><Button icon={<Plus className="h-4 w-4" />}>Tạo tình huống</Button></Link>} />
    <Surface className="overflow-hidden border border-border shadow-subtle"><div className="divide-y divide-border">{items.map((item) => <Link className="grid gap-3 p-4 transition-colors hover:bg-surface-subtle/50 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center sm:px-5" key={item.id} to={`/manage/scenarios/${encodeURIComponent(item.id)}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-bold text-ink">{item.title}</h2><Badge>{item.archivedAt ? 'Đã lưu trữ' : item.draft ? `Bản nháp v${item.draft.version}` : `Đã xuất bản v${item.latestPublished?.version ?? '-'}`}</Badge></div><p className="mt-1 truncate text-xs text-ink-muted">{item.id}</p></div><p className="text-sm text-ink-secondary sm:text-right">Liên kết <span className="font-bold tabular-nums text-ink">{item.linkedPersonaCount}</span> Persona</p></Link>)}</div></Surface>
  </div>
}

export function ScenarioEditorPage() {
  const { scenarioId, versionId } = useParams(); const navigate = useNavigate(); const isNew = !scenarioId
  const [detail, setDetail] = useState<ManagedScenarioDetail | null>(null); const [fields, setFields] = useState<ScenarioFields>(emptyScenario)
  const [loading, setLoading] = useState(!isNew); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const apply = (value: ManagedScenarioDetail) => { setDetail(value); setFields(value.currentVersion) }
  useEffect(() => { if (scenarioId) trainingContentService.scenario(scenarioId, versionId).then(apply).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Không thể tải tình huống.')).finally(() => setLoading(false)) }, [scenarioId, versionId])
  const editable = isNew || detail?.currentVersion.status === 'DRAFT'
  const update = <K extends keyof ScenarioFields>(key: K, value: ScenarioFields[K]) => setFields((current) => ({ ...current, [key]: value }))
  const run = async (operation: () => Promise<ManagedScenarioDetail | void>) => { setSaving(true); setError(''); try { const result = await operation(); if (result) apply(result) } catch (e) { setError(e instanceof Error ? e.message : 'Không thể lưu tình huống.') } finally { setSaving(false) } }
  const save = () => run(async () => { if (isNew) { const created = await trainingContentService.createScenario(fields); navigate(`/manage/scenarios/${encodeURIComponent(created.id)}`, { replace: true }); return created } return trainingContentService.updateScenario(detail!.id, detail!.currentVersion.id, fields, detail!.currentVersion.updatedAt) })
  if (loading) return <LoadingState label="Đang tải tình huống..." />
  return <div className="mx-auto max-w-5xl space-y-6"><PageHeader eyebrow="Biên soạn tình huống" title={isNew ? 'Tạo tình huống' : detail?.title ?? 'Tình huống'} description="Giao diện chỉ quản lý các trường nội dung an toàn; cấu hình thực thi nội bộ được hệ thống tạo tự động." action={detail && <Badge>{detail.archivedAt ? 'Đã lưu trữ' : `${versionLabel(detail.currentVersion.status)} · v${detail.currentVersion.version}`}</Badge>} />
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <Card className="grid gap-4 p-5 md:grid-cols-2"><Field label="Tên tình huống"><Input value={fields.title} disabled={!editable} onChange={(e) => update('title', e.target.value)} /></Field><Field label="Danh mục"><Input value={fields.category} disabled={!editable} onChange={(e) => update('category', e.target.value)} /></Field><Field label="Độ khó"><Select value={fields.difficulty} disabled={!editable} onChange={(e) => update('difficulty', e.target.value as ScenarioFields['difficulty'])}><option>EASY</option><option>MEDIUM</option><option>HARD</option></Select></Field><Area label="Mô tả" value={fields.description} disabled={!editable} onChange={(v) => update('description', v)} /><Area label="Nhu cầu khách hàng" value={fields.customerNeed} disabled={!editable} onChange={(v) => update('customerNeed', v)} /><Area label="Mục tiêu đào tạo" value={fields.trainingObjective} disabled={!editable} onChange={(v) => update('trainingObjective', v)} />{(['priorities','tags','openingExamples'] as const).map((key) => <Area key={key} label={labels[key]} value={fields[key].join('\n')} disabled={!editable} onChange={(v) => update(key, split(v))} />)}</Card>
    <div className="flex flex-wrap gap-2">{editable && <Button disabled={saving} icon={<Save className="h-4 w-4" />} onClick={() => void save()}>Lưu bản nháp</Button>}{detail?.currentVersion.status === 'DRAFT' && <Button disabled={saving} icon={<Send className="h-4 w-4" />} onClick={() => void run(() => trainingContentService.publishScenario(detail.id, detail.currentVersion.id, detail.currentVersion.updatedAt))}>Xuất bản</Button>}{detail?.latestPublished && !detail.draft && !detail.archivedAt && <Button variant="secondary" onClick={() => void run(() => trainingContentService.newScenarioVersion(detail.id))}>Tạo phiên bản mới</Button>}{detail?.draft && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => void run(async () => { await trainingContentService.deleteScenarioDraft(detail.id, detail.currentVersion.id); navigate('/manage/scenarios') })}>Xóa bản nháp</Button>}{detail?.latestPublished && !detail.draft && !detail.archivedAt && <Button variant="ghost" icon={<Archive className="h-4 w-4" />} onClick={() => void run(async () => { await trainingContentService.archiveScenario(detail.id); navigate('/manage/scenarios') })}>Lưu trữ</Button>}</div>
    {detail && <Card className="p-5"><h2 className="font-bold text-ink">Persona liên kết</h2><div className="mt-3 flex flex-wrap gap-2">{detail.personaLinks.length ? detail.personaLinks.map((link) => <Badge key={link.personaId}>{link.displayName}{link.isDefault ? ' · Mặc định' : ''}</Badge>) : <p className="text-sm text-ink-muted">Chưa liên kết Persona.</p>}</div></Card>}
    {detail && <Card className="p-5"><h2 className="font-bold text-ink">Lịch sử phiên bản</h2><div className="mt-3 flex flex-wrap gap-2">{detail.versions.map((version) => <Link key={version.id} to={`/manage/scenarios/${encodeURIComponent(detail.id)}/versions/${version.id}`}><Badge>v{version.version} · {version.status}</Badge></Link>)}</div></Card>}
  </div>
}

const labels = { priorities: 'Ưu tiên', tags: 'Thẻ tương thích', openingExamples: 'Ví dụ mở lời' }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-sm font-semibold text-ink">{label}{children}</label> }
function Area({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) { return <Field label={label}><textarea rows={4} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm disabled:bg-surface-subtle" /></Field> }
