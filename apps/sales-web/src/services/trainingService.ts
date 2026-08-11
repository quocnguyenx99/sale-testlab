import { recentSessions } from '../mocks/sessions'
import type { PublicPersona, SendMessageResponse, TrainingMode, TrainingSession } from '../types/training'

interface ApiErrorBody { error?: { code?: string; message?: string } }

export class TrainingServiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new TrainingServiceError('NETWORK_ERROR', 'Không thể kết nối tới dịch vụ luyện tập.', 0)
  }
  const body = await response.json() as T & ApiErrorBody
  if (!response.ok) {
    throw new TrainingServiceError(body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? 'Yêu cầu không thành công.', response.status)
  }
  return body
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase()
}

function colorFromId(id: string) {
  const palette = ['#2f6fed', '#7257d9', '#138b78', '#d16f32', '#3b647d', '#c15078']
  const hash = Array.from(id).reduce((value, char) => value + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

function decoratePersona(persona: Omit<PublicPersona, 'initials' | 'color'> & Partial<Pick<PublicPersona, 'initials' | 'color'>>): PublicPersona {
  return { ...persona, initials: persona.initials ?? initials(persona.displayName), color: persona.color ?? colorFromId(persona.id) }
}

function decorateSession(session: TrainingSession): TrainingSession {
  return { ...session, persona: decoratePersona(session.persona) }
}

export const trainingService = {
  async getPersonas(): Promise<PublicPersona[]> {
    const data = await request<{ personas: PublicPersona[] }>('/api/v3/personas')
    return data.personas.map(decoratePersona)
  },
  async getRecommendedPersonas(): Promise<PublicPersona[]> {
    return (await this.getPersonas()).slice(0, 3)
  },
  async getPersona(personaId: string): Promise<PublicPersona> {
    const data = await request<{ persona: PublicPersona }>(`/api/v3/personas/${encodeURIComponent(personaId)}`)
    return decoratePersona(data.persona)
  },
  async getRecentSessions() { return recentSessions },
  async createSession(personaId: string, mode: TrainingMode): Promise<TrainingSession> {
    const data = await request<{ session: TrainingSession }>('/api/v3/sessions', { method: 'POST', body: JSON.stringify({ personaId, mode }) })
    return decorateSession(data.session)
  },
  async getSession(sessionId: string): Promise<TrainingSession> {
    const data = await request<{ session: TrainingSession }>(`/api/v3/sessions/${encodeURIComponent(sessionId)}`)
    return decorateSession(data.session)
  },
  async sendMessage(sessionId: string, message: string): Promise<SendMessageResponse> {
    return request(`/api/v3/sessions/${encodeURIComponent(sessionId)}/messages`, { method: 'POST', body: JSON.stringify({ message }) })
  },
  async stopSession(sessionId: string): Promise<TrainingSession> {
    const data = await request<{ session: TrainingSession }>(`/api/v3/sessions/${encodeURIComponent(sessionId)}/stop`, { method: 'POST', body: '{}' })
    return decorateSession(data.session)
  },
}
