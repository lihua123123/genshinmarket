import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { User } from '../types'
import { api, setToken, getToken } from '../utils/api'

interface AuthContextValue {
  currentUser: User | null
  // 登录/注册成功后调用，写入令牌与用户
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const login = useCallback((token: string, user: User) => {
    setToken(token)
    setCurrentUser(user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* 忽略网络/服务端错误，本地照常登出 */
    }
    setToken(null)
    setCurrentUser(null)
  }, [])

  // 启动时若有本地令牌，用服务端 /me 恢复会话（严格单账号）
  useEffect(() => {
    if (!getToken()) return
    api
      .me()
      .then(user => setCurrentUser(user))
      .catch(() => {
        // 令牌无效/过期：清除本地令牌，回到登录页
        setToken(null)
        setCurrentUser(null)
      })
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
