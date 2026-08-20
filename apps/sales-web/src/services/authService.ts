import { notifyApiAccess } from '../app/apiAccessNotifier'
import type { UserRole } from '../app/authorizationPolicy'

export interface PublicAuthUser {
  id: string
  email: string
  displayName: string
  role: UserRole
}

interface ApiErrorBody { error?: { message?: string } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json() as T & ApiErrorBody
  if (!response.ok) {
    notifyApiAccess(response.status)
    throw new Error(body.error?.message ?? 'Yêu cầu xác thực không thành công.')
  }
  return body
}

export const authService = {
  async login(email: string, password: string): Promise<PublicAuthUser> {
    const body = await request<{ user: PublicAuthUser }>('/api/v3/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    })
    return body.user
  },
  async me(): Promise<PublicAuthUser | null> {
    try { return (await request<{ user: PublicAuthUser }>('/api/v3/auth/me')).user }
    catch { return null }
  },
  async logout(): Promise<void> {
    await request('/api/v3/auth/logout', { method: 'POST', body: '{}' })
  },
}
