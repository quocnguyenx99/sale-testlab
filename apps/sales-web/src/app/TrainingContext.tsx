/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { trainingService } from '../services/trainingService'
import type { ChatMessage, TrainingMode, TrainingSession } from '../types/training'

interface TrainingContextValue {
  session: TrainingSession | null
  messages: ChatMessage[]
  startSession: (personaId: string, mode: TrainingMode) => Promise<TrainingSession>
  loadSession: (sessionId: string) => Promise<TrainingSession>
  sendMessage: (sessionId: string, content: string) => Promise<void>
  stopSession: (sessionId: string) => Promise<TrainingSession>
}

const TrainingContext = createContext<TrainingContextValue | null>(null)

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const startSession = useCallback(async (personaId: string, mode: TrainingMode) => {
    const next = await trainingService.createSession(personaId, mode)
    setSession(next)
    setMessages(next.messages)
    return next
  }, [])

  const loadSession = useCallback(async (sessionId: string) => {
    const next = await trainingService.getSession(sessionId)
    setSession(next)
    setMessages(next.messages)
    return next
  }, [])

  const sendMessage = useCallback(async (sessionId: string, content: string) => {
    const optimisticId = `pending-${Date.now()}`
    const optimistic: ChatMessage = { id: optimisticId, sender: 'SALE', content, createdAt: new Date().toISOString() }
    setMessages((current) => [...current, optimistic])
    try {
      const response = await trainingService.sendMessage(sessionId, content)
      setMessages((current) => [...current.filter((message) => message.id !== optimisticId), response.saleMessage, response.customerMessage])
      setSession((current) => current ? {
        ...current,
        status: response.sessionStatus,
        runtimeInsight: response.runtimeInsight,
        messages: [...current.messages, response.saleMessage, response.customerMessage],
      } : current)
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId))
      throw error
    }
  }, [])

  const stopSession = useCallback(async (sessionId: string) => {
    const next = await trainingService.stopSession(sessionId)
    setSession(next)
    setMessages(next.messages)
    return next
  }, [])

  const value = useMemo<TrainingContextValue>(() => ({ session, messages, startSession, loadSession, sendMessage, stopSession }), [loadSession, messages, sendMessage, session, startSession, stopSession])
  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>
}

export function useTraining() {
  const context = useContext(TrainingContext)
  if (!context) throw new Error('useTraining must be used inside TrainingProvider')
  return context
}
