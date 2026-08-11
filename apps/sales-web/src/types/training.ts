export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type TrainingMode = 'CUSTOMER_FIRST' | 'SALE_FIRST'
export type MessageSender = 'CUSTOMER' | 'SALE'

export interface PublicPersona {
  id: string
  displayName: string
  initials: string
  role: string
  customerType: string
  difficulty: Difficulty
  summary: string
  interests: string[]
  scenarioContext: string
  defaultScenario: TrainingScenario
  color: string
}

export interface TrainingScenario {
  id: string
  title: string
  description: string
  difficulty: Difficulty
}

export interface TrainingSession {
  id: string
  persona: PublicPersona
  scenario: TrainingScenario
  mode: TrainingMode
  status: 'RUNNING' | 'COMPLETED'
  createdAt: string
  messages: ChatMessage[]
  runtimeInsight: RuntimeInsight | null
  result?: SessionResult
}

export interface ChatMessage {
  id: string
  sender: MessageSender
  content: string
  createdAt: string
}

export interface RuntimeInsight {
  runtimeState: string
  resolvedTopics: string[]
  missingTopics: string[]
  nextUnresolvedTopic: string | null
  dealOutcome: string
  trainingStatus: string
  topicProgress: { resolved: number; total: number }
  activeProduct: { model: string; code: string } | null
}

export interface SessionResult {
  outcome: string
  trainingStatus: string
  turnCount: number
  durationSeconds: number
  resolvedTopics: string[]
  missingTopics: string[]
  signals: string[]
}

export interface SendMessageResponse {
  saleMessage: ChatMessage
  customerMessage: ChatMessage
  runtimeInsight: RuntimeInsight
  sessionStatus: TrainingSession['status']
}

export interface RecentSession {
  id: string
  customer: string
  role: string
  scenario: string
  dateLabel: string
  outcomeLabel: string
  status: 'COMPLETED'
}
