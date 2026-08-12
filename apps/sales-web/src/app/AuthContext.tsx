/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService, type PublicAuthUser } from '../services/authService'

interface AuthContextValue {
  user: PublicAuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicAuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { authService.me().then(setUser).finally(() => setLoading(false)) }, [])
  const login = useCallback(async (email: string, password: string) => setUser(await authService.login(email, password)), [])
  const logout = useCallback(async () => { await authService.logout(); setUser(null) }, [])
  const value = useMemo(() => ({ user, loading, login, logout }), [loading, login, logout, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
