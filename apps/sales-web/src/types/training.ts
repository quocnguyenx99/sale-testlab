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
  completedAt: string | null
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

export interface EvaluationCriterion {
  key: string
  label: string
  score: number | null
  weight: number
  effectiveWeight: number
  source: 'DETERMINISTIC' | 'LLM' | 'HYBRID'
  applicability: 'APPLICABLE' | 'NOT_APPLICABLE'
  summary: string
  evidenceTurnSequences: number[]
}

export interface SessionEvaluation {
  id: string
  evaluatorVersion: string
  status: 'COMPLETED' | 'FAILED'
  overallScore: number | null
  criteria: EvaluationCriterion[]
  strengths: string[]
  improvementAreas: string[]
  evaluatedAt: string | null
}

export interface EvaluationResponse {
  state: 'NOT_EVALUATED' | 'COMPLETED' | 'FAILED'
  evaluation: SessionEvaluation | null
}

export interface SendMessageResponse {
  saleMessage: ChatMessage
  customerMessage: ChatMessage
  runtimeInsight: RuntimeInsight
  sessionStatus: TrainingSession['status']
}

export interface RecentSession {
  id: string
  persona: Pick<PublicPersona, 'id' | 'displayName' | 'role' | 'customerType'>
  mode: TrainingMode
  status: TrainingSession['status']
  createdAt: string
  updatedAt: string
  completedAt: string | null
  turnCount: number
  dealOutcome: string | null
  trainingStatus: string | null
}

export interface HistoryQuery {
  page?: number
  pageSize?: number
  status?: TrainingSession['status']
  mode?: TrainingMode
  search?: string
}

export interface HistoryPage {
  items: RecentSession[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
