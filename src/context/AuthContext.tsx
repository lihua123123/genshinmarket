import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '../types'
import { api } from '../utils/api'

interface AuthContextValue {
  currentUser: User | null
  setCurrentUser: (u: User | null) => void
  users: User[]
  refreshUsers: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])

  const setCurrentUser = (u: User | null) => {
    setCurrentUserState(u)
    // 持久化当前用户到 localStorage，刷新后恢复
    if (u) localStorage.setItem('current_user', JSON.stringify(u))
    else localStorage.removeItem('current_user')
  }

  const refreshUsers = async () => {
    try {
      setUsers(await api.allUsers())
    } catch {
      // 忽略刷新失败，避免影响主流程
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem('current_user')
    if (cached) {
      try {
        const u = JSON.parse(cached)
        // 用缓存 id 从服务端刷新用户信息，避免本地缓存过期（如数据库被重置）
        api
          .current(u.id)
          .then(fresh => {
            setCurrentUserState(fresh)
            localStorage.setItem('current_user', JSON.stringify(fresh))
          })
          .catch(() => {
            // 用户可能已被删除，保留缓存并在刷新列表后由用户重新选择
            setCurrentUserState(u)
          })
      } catch {
        /* ignore */
      }
    }
    refreshUsers()
  }, [])

  const logout = () => setCurrentUser(null)

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, users, refreshUsers, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
