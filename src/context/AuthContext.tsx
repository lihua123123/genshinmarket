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

  // 在线心跳：登录期间定期上报刷新“最近活跃时间”，使自己在市场玩家列表中显示为在线；
  // 关闭/离开页面后停止上报，服务端时间戳过期即自然变为离线
  useEffect(() => {
    if (!currentUser) return
    const beat = () => {
      api.heartbeat().catch(() => {
        /* 心跳失败忽略（网络抖动等），不影响本地状态 */
      })
    }
    beat() // 登录/恢复后立即上报一次
    const id = setInterval(beat, 60 * 1000) // 每分钟一次
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [currentUser])

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
