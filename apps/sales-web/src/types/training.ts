export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type TrainingMode = 'CUSTOMER_FIRST' | 'SALE_FIRST'
export type MessageSender = 'CUSTOMER' | 'SALE'
export type RuntimeState = 'NEEDS_DISCOVERY' | 'PRODUCT_DISCUSSION' | 'PRICE_DISCUSSION' | 'CLOSING'

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
  personaId: string
  scenario: TrainingScenario
  mode: TrainingMode
  status: 'READY' | 'IN_PROGRESS' | 'COMPLETED'
  startedAt: string
}

export interface ChatMessage {
  id: string
  sender: MessageSender
  content: string
  timestamp: string
}

export interface RuntimeInsight {
  state: RuntimeState
  completedTopics: string[]
  missingTopics: string[]
  totalTopics: number
  dealState: 'IN_PROGRESS' | 'CUSTOMER_INTERESTED'
}

export interface SessionResult {
  sessionId: string
  outcome: 'CUSTOMER_INTERESTED'
  turnCount: number
  durationLabel: string
  completedTopics: string[]
  missingTopics: string[]
  signals: string[]
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
