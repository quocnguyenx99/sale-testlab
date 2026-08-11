import { mockPersonas } from '../mocks/personas'
import { recentSessions, assignedScenario } from '../mocks/sessions'
import { initialMessages, mockCustomerReply } from '../mocks/messages'
import { initialInsight, makeSessionResult } from '../mocks/results'
import type { PublicPersona, TrainingMode, TrainingSession } from '../types/training'

const delay = (milliseconds = 350) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export const trainingService = {
  async getPersonas(): Promise<PublicPersona[]> { await delay(); return mockPersonas },
  async getRecommendedPersonas(): Promise<PublicPersona[]> { await delay(250); return mockPersonas.slice(0, 3) },
  async getRecentSessions() { await delay(250); return recentSessions },
  getPersona(personaId?: string | null) { return mockPersonas.find((item) => item.id === personaId) ?? mockPersonas[0] },
  getAssignedScenario() { return assignedScenario },
  createSession(personaId: string, mode: TrainingMode): TrainingSession {
    return { id: `mock-session-${Date.now()}`, personaId, scenario: assignedScenario, mode, status: 'IN_PROGRESS', startedAt: new Date().toISOString() }
  },
  getInitialMessages(mode: TrainingMode) { return initialMessages(mode) },
  async getCustomerReply(message: string, order: number) { await delay(900); return mockCustomerReply(message, order) },
  getInitialInsight() { return initialInsight },
  getResult(sessionId: string, turnCount: number) { return makeSessionResult(sessionId, turnCount) },
}
