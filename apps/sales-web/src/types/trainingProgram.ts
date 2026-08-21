import type { TrainingMode } from './training'

export type TrainingProgramStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface TrainingProgramItem {
  id: string
  personaId: string
  personaLabel: string | null
  scenarioId: string
  scenarioLabel: string | null
  mode: TrainingMode
  sortOrder: number
}

export interface TrainingProgram {
  id: string
  name: string
  description: string | null
  status: TrainingProgramStatus
  createdBy: { id: string; displayName: string }
  createdAt: string
  updatedAt: string
  items: TrainingProgramItem[]
}

export interface TrainingProgramWriteInput {
  name: string
  description: string | null
  items: Array<Pick<TrainingProgramItem, 'personaId' | 'scenarioId' | 'mode' | 'sortOrder'>>
}
