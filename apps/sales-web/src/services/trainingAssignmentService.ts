import { notifyApiAccess } from '../app/apiAccessNotifier'
import type {
  CreateTrainingAssignmentInput,
  ManagedTrainingAssignment,
  OwnTrainingAssignment,
  StartAssignedItemResult,
  TrainingAssignee,
} from '../types/trainingAssignment'

interface ApiErrorBody { error?: { code?: string; message?: string } }

export class TrainingAssignmentApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message) }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new TrainingAssignmentApiError('NETWORK_ERROR', 'Không thể kết nối tới dịch vụ phân công đào tạo.', 0)
  }
  const body = await response.json() as T & ApiErrorBody
  if (!response.ok) {
    notifyApiAccess(response.status)
    throw new TrainingAssignmentApiError(
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'Yêu cầu phân công đào tạo không thành công.',
      response.status,
    )
  }
  return body
}

export const trainingAssignmentService = {
  async listManaged(): Promise<ManagedTrainingAssignment[]> {
    return (await request<{ assignments: ManagedTrainingAssignment[] }>('/api/v3/training-assignments')).assignments
  },
  async getManaged(id: string): Promise<ManagedTrainingAssignment> {
    return (await request<{ assignment: ManagedTrainingAssignment }>(`/api/v3/training-assignments/${encodeURIComponent(id)}`)).assignment
  },
  async create(input: CreateTrainingAssignmentInput): Promise<ManagedTrainingAssignment> {
    return (await request<{ assignment: ManagedTrainingAssignment }>('/api/v3/training-assignments', {
      method: 'POST', body: JSON.stringify(input),
    })).assignment
  },
  async cancel(id: string): Promise<ManagedTrainingAssignment> {
    return (await request<{ assignment: ManagedTrainingAssignment }>(`/api/v3/training-assignments/${encodeURIComponent(id)}/cancel`, {
      method: 'POST', body: '{}',
    })).assignment
  },
  async listAssignees(): Promise<TrainingAssignee[]> {
    return (await request<{ assignees: TrainingAssignee[] }>('/api/v3/training-assignees')).assignees
  },
  async listOwn(): Promise<OwnTrainingAssignment[]> {
    return (await request<{ assignments: OwnTrainingAssignment[] }>('/api/v3/my-training-assignments')).assignments
  },
  async getOwn(id: string): Promise<OwnTrainingAssignment> {
    return (await request<{ assignment: OwnTrainingAssignment }>(`/api/v3/my-training-assignments/${encodeURIComponent(id)}`)).assignment
  },
  async startItem(assignmentId: string, itemId: string): Promise<StartAssignedItemResult> {
    return (await request<{ session: StartAssignedItemResult }>(
      `/api/v3/my-training-assignments/${encodeURIComponent(assignmentId)}/items/${encodeURIComponent(itemId)}/start`,
      { method: 'POST', body: '{}' },
    )).session
  },
}
