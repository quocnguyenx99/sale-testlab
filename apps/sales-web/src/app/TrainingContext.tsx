/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { trainingService } from '../services/trainingService'
import type { ChatMessage, TrainingMode, TrainingSession } from '../types/training'

interface TrainingContextValue {
  session: TrainingSession | null
  messages: ChatMessage[]
  startSession: (personaId: string, mode: TrainingMode) => TrainingSession
  addMessage: (message: ChatMessage) => void
  resetConversation: () => void
}

const TrainingContext = createContext<TrainingContextValue | null>(null)

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const value = useMemo<TrainingContextValue>(() => ({
    session,
    messages,
    startSession(personaId, mode) {
      const next = trainingService.createSession(personaId, mode)
      setSession(next)
      setMessages(trainingService.getInitialMessages(mode))
      return next
    },
    addMessage(message) { setMessages((current) => [...current, message]) },
    resetConversation() {
      if (session) setMessages(trainingService.getInitialMessages(session.mode))
    },
  }), [messages, session])

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>
}

export function useTraining() {
  const context = useContext(TrainingContext)
  if (!context) throw new Error('useTraining must be used inside TrainingProvider')
  return context
}
