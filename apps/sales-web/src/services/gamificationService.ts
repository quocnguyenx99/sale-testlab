import { notifyApiAccess } from '../app/apiAccessNotifier'
import type { LeaderboardData, PersonalGamification } from '../types/gamification'

interface ApiErrorBody { error?: { code?: string; message?: string } }

async function request<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('Không thể kết nối tới dịch vụ Gamification.')
  }
  const body = await response.json() as T & ApiErrorBody
  if (!response.ok) {
    notifyApiAccess(response.status)
    throw new Error(body.error?.message ?? 'Không thể tải dữ liệu Gamification.')
  }
  return body
}

export const gamificationService = {
  async getPersonal(): Promise<PersonalGamification> {
    return (await request<{ gamification: PersonalGamification }>('/api/v3/gamification/me')).gamification
  },
  async getLeaderboard(page = 1, pageSize = 25): Promise<LeaderboardData> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    return (await request<{ leaderboard: LeaderboardData }>(`/api/v3/leaderboard?${params.toString()}`)).leaderboard
  },
}
