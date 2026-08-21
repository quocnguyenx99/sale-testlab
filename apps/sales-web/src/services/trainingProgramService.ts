import { notifyApiAccess } from '../app/apiAccessNotifier'
import type { TrainingProgram, TrainingProgramWriteInput } from '../types/trainingProgram'

interface ApiErrorBody { error?: { code?: string; message?: string } }

export class TrainingProgramApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message)
  }
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
    throw new TrainingProgramApiError('NETWORK_ERROR', 'Không thể kết nối tới dịch vụ chương trình đào tạo.', 0)
  }
  const body = await response.json() as T & ApiErrorBody
  if (!response.ok) {
    notifyApiAccess(response.status)
    throw new TrainingProgramApiError(
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'Yêu cầu chương trình đào tạo không thành công.',
      response.status,
    )
  }
  return body
}

export const trainingProgramService = {
  async list(): Promise<TrainingProgram[]> {
    return (await request<{ programs: TrainingProgram[] }>('/api/v3/training-programs')).programs
  },
  async get(id: string): Promise<TrainingProgram> {
    return (await request<{ program: TrainingProgram }>(`/api/v3/training-programs/${encodeURIComponent(id)}`)).program
  },
  async create(input: TrainingProgramWriteInput): Promise<TrainingProgram> {
    return (await request<{ program: TrainingProgram }>('/api/v3/training-programs', {
      method: 'POST', body: JSON.stringify(input),
    })).program
  },
  async update(id: string, input: TrainingProgramWriteInput): Promise<TrainingProgram> {
    return (await request<{ program: TrainingProgram }>(`/api/v3/training-programs/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify(input),
    })).program
  },
  async publish(id: string): Promise<TrainingProgram> {
    return (await request<{ program: TrainingProgram }>(`/api/v3/training-programs/${encodeURIComponent(id)}/publish`, {
      method: 'POST', body: '{}',
    })).program
  },
  async archive(id: string): Promise<TrainingProgram> {
    return (await request<{ program: TrainingProgram }>(`/api/v3/training-programs/${encodeURIComponent(id)}/archive`, {
      method: 'POST', body: '{}',
    })).program
  },
  async deleteDraft(id: string): Promise<void> {
    await request(`/api/v3/training-programs/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}
