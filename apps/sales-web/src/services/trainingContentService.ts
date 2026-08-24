import { notifyApiAccess } from '../app/apiAccessNotifier'
import type { ManagedPersonaDetail, ManagedPersonaSummary, ManagedScenarioDetail, ManagedScenarioSummary, PersonaFields, ScenarioFields } from '../types/trainingContent'

interface ErrorBody { error?: { code?: string; message?: string } }
export class TrainingContentApiError extends Error { constructor(public readonly code: string, message: string, public readonly status: number) { super(message) } }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = await response.json() as T & ErrorBody
  if (!response.ok) { notifyApiAccess(response.status); throw new TrainingContentApiError(body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'Yêu cầu không thành công.', response.status) }
  return body
}

const personaBase = '/api/v3/manage/personas'
const scenarioBase = '/api/v3/manage/scenarios'
export const trainingContentService = {
  async personas() { return (await request<{ personas: ManagedPersonaSummary[] }>(personaBase)).personas },
  async scenarios() { return (await request<{ scenarios: ManagedScenarioSummary[] }>(scenarioBase)).scenarios },
  async persona(id: string, versionId?: string) { const q = versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''; return (await request<{ persona: ManagedPersonaDetail }>(`${personaBase}/${encodeURIComponent(id)}${q}`)).persona },
  async scenario(id: string, versionId?: string) { const q = versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''; return (await request<{ scenario: ManagedScenarioDetail }>(`${scenarioBase}/${encodeURIComponent(id)}${q}`)).scenario },
  async createPersona(fields: PersonaFields) { return (await request<{ persona: ManagedPersonaDetail }>(personaBase, { method: 'POST', body: JSON.stringify(fields) })).persona },
  async createScenario(fields: ScenarioFields) { return (await request<{ scenario: ManagedScenarioDetail }>(scenarioBase, { method: 'POST', body: JSON.stringify(fields) })).scenario },
  async updatePersona(id: string, versionId: string, fields: PersonaFields, expectedUpdatedAt: string) { return (await request<{ persona: ManagedPersonaDetail }>(`${personaBase}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`, { method: 'PUT', body: JSON.stringify({ ...fields, expectedUpdatedAt }) })).persona },
  async updateScenario(id: string, versionId: string, fields: ScenarioFields, expectedUpdatedAt: string) { return (await request<{ scenario: ManagedScenarioDetail }>(`${scenarioBase}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`, { method: 'PUT', body: JSON.stringify({ ...fields, expectedUpdatedAt }) })).scenario },
  async publishPersona(id: string, versionId: string, expectedUpdatedAt: string) { return (await request<{ persona: ManagedPersonaDetail }>(`${personaBase}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/publish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) })).persona },
  async publishScenario(id: string, versionId: string, expectedUpdatedAt: string) { return (await request<{ scenario: ManagedScenarioDetail }>(`${scenarioBase}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/publish`, { method: 'POST', body: JSON.stringify({ expectedUpdatedAt }) })).scenario },
  async newPersonaVersion(id: string) { return (await request<{ persona: ManagedPersonaDetail }>(`${personaBase}/${encodeURIComponent(id)}/versions`, { method: 'POST', body: '{}' })).persona },
  async newScenarioVersion(id: string) { return (await request<{ scenario: ManagedScenarioDetail }>(`${scenarioBase}/${encodeURIComponent(id)}/versions`, { method: 'POST', body: '{}' })).scenario },
  async deletePersonaDraft(id: string, versionId: string) { await request(`${personaBase}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`, { method: 'DELETE' }) },
  async deleteScenarioDraft(id: string, versionId: string) { await request(`${scenarioBase}/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`, { method: 'DELETE' }) },
  async archivePersona(id: string) { await request(`${personaBase}/${encodeURIComponent(id)}/archive`, { method: 'POST', body: '{}' }) },
  async archiveScenario(id: string) { await request(`${scenarioBase}/${encodeURIComponent(id)}/archive`, { method: 'POST', body: '{}' }) },
  async linkScenarios(id: string, links: Array<{ scenarioId: string; isDefault: boolean }>) { return (await request<{ persona: ManagedPersonaDetail }>(`${personaBase}/${encodeURIComponent(id)}/scenarios`, { method: 'PUT', body: JSON.stringify({ links }) })).persona },
}
