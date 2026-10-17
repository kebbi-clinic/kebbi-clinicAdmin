import { createContext, useContext, useState, type ReactNode } from 'react'
import { api, type User } from './api'
import { authApi } from './endpoints'

interface AuthCtx {
  user: User
  login: (username: string, password: string) => Promise<User>
  changePassword: (currentPassword: string, newPassword: string) => Promise<User>
  logout: () => void
}
const Ctx = createContext<AuthCtx>(null as never)

function storedUser(): User | null {
  try { return JSON.parse(localStorage.getItem('kc_admin_user') || 'null') } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (!api.hasToken()) return null
    /* An expired token is treated as logged out so the user is bounced to
       login immediately instead of hitting 401 on every request. */
    if (api.isTokenExpired(api.getToken()!)) {
      localStorage.removeItem('kc_admin_token')
      localStorage.removeItem('kc_admin_user')
      return null
    }
    const u = storedUser()
    if (!u || typeof u.role !== 'string' || typeof u.name !== 'string') {
      localStorage.removeItem('kc_admin_user')
      return null
    }
    return u
  })

  const login = async (username: string, password: string) => {
    const r = await authApi.login(username, password, 'admin')
    api.setToken(r.token)
    localStorage.setItem('kc_admin_user', JSON.stringify(r.user))
    setUser(r.user)
    return r.user
  }
  const changePassword = async (currentPassword: string, newPassword: string) => {
    const r = await authApi.changePassword(currentPassword, newPassword)
    api.setToken(r.token)
    localStorage.setItem('kc_admin_user', JSON.stringify(r.user))
    setUser(r.user)
    return r.user
  }
  const logout = () => { api.setToken(null); localStorage.removeItem('kc_admin_user'); setUser(null) }

  return <Ctx.Provider value={{ user: user as User, login, changePassword, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  return useContext(Ctx)
}
