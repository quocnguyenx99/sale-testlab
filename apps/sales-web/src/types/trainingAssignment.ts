import type { TrainingMode, TrainingSession } from './training'
import type { TrainingProgramStatus } from './trainingProgram'

export type TrainingAssignmentState = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TrainingAssignmentItemState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

export interface TrainingAssignmentItem {
  id: string
  sortOrder: number
  personaId: string
  personaLabel: string | null
  scenarioId: string
  scenarioLabel: string | null
  mode: TrainingMode
  state: TrainingAssignmentItemState
}

interface TrainingAssignmentBase {
  id: string
  program: { id: string; name: string; description: string | null; status: TrainingProgramStatus }
  assignedAt: string
  dueAt: string | null
  cancelledAt: string | null
  state: TrainingAssignmentState
  isOverdue: boolean
  completedItems: number
  totalItems: number
  progressPercent: number
}

export interface ManagedTrainingAssignment extends TrainingAssignmentBase {
  assignedTo: { id: string; displayName: string; email: string }
  assignedBy: { id: string; displayName: string }
  items: TrainingAssignmentItem[]
}

export interface OwnTrainingAssignment extends TrainingAssignmentBase {
  items: Array<TrainingAssignmentItem & { activeSessionId: string | null }>
}

export interface TrainingAssignee {
  id: string
  displayName: string
  email: string
  role: 'SALE'
}

export interface CreateTrainingAssignmentInput {
  programId: string
  assignedToUserId: string
  dueAt: string | null
}

export type StartAssignedItemResult = TrainingSession
