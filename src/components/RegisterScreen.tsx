import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import ConfirmDialog from './ConfirmDialog'

// 用户注册 / 登录页面（支持多用户切换）
export default function RegisterScreen() {
  const { setCurrentUser, users, refreshUsers } = useAuth()
  const [mode, setMode] = useState<'register' | 'login'>('register')

  // 注册字段
  const [groupName, setGroupName] = useState('')
  const [gameName, setGameName] = useState('')
  const [gameUid, setGameUid] = useState('')

  // 登录字段（通过选择已有用户登录）
  const [loginUid, setLoginUid] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = () => {
    if (!groupName.trim() || !gameName.trim() || !gameUid.trim()) {
      setError('所有字段均为必填项')
      return false
    }
    if (!/^\d{9,10}$/.test(gameUid.trim())) {
      setError('游戏UID需为9-10位纯数字')
      return false
    }
    return true
  }

  const handleSubmit = () => {
    setError('')
    if (!validate()) return
    // 提交前确认提示：创建后无法更改
    setConfirmOpen(true)
  }

  const confirmCreate = async () => {
    setConfirmOpen(false)
    setLoading(true)
    try {
      const user = await api.register({
        group_name: groupName.trim(),
        game_name: gameName.trim(),
        game_uid: gameUid.trim()
      })
      setCurrentUser(user)
      await refreshUsers()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setError('')
    if (!loginUid) {
      setError('请选择要登录的用户')
      return
    }
    const user = users.find(u => String(u.id) === loginUid)
    if (!user) {
      setError('用户不存在')
      return
    }
    setCurrentUser(user)
  }

  return (
    <div className="register-screen">
      <div className="register-card">
        <div className="register-title">🎮 欢迎来到交易市场</div>
        {mode === 'register' ? (
          <>
            <div className="form-group">
              <label>群内名字</label>
              <input
                className="input"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="请输入群内名字"
              />
            </div>
            <div className="form-group">
              <label>游戏内名字</label>
              <input
                className="input"
                value={gameName}
                onChange={e => setGameName(e.target.value)}
                placeholder="请输入游戏内名字"
              />
            </div>
            <div className="form-group">
              <label>游戏UID</label>
              <input
                className="input"
                value={gameUid}
                onChange={e => setGameUid(e.target.value)}
                placeholder="9-10位数字"
                inputMode="numeric"
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={loading}>
              {loading ? '创建中...' : '创建账号'}
            </button>
            <p className="switch-link">
              已有账号？<button className="link-btn" onClick={() => { setMode('login'); setError('') }}>直接登录</button>
            </p>
          </>
        ) : (
          <>
            <div className="form-group">
              <label>选择要登录的用户</label>
              {users.length === 0 ? (
                <p className="muted">暂无已注册用户，请先注册</p>
              ) : (
                <select className="input" value={loginUid} onChange={e => setLoginUid(e.target.value)}>
                  <option value="">请选择用户</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.game_name}（{u.group_name} · UID {u.game_uid}）
                    </option>
                  ))}
                </select>
              )}
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-block" onClick={handleLogin} disabled={users.length === 0}>
              登录
            </button>
            <p className="switch-link">
              还没有账号？<button className="link-btn" onClick={() => { setMode('register'); setError('') }}>去注册</button>
            </p>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        message="创建后暂时无法更改，确认创建？"
        onConfirm={confirmCreate}
        onCancel={() => setConfirmOpen(false)}
        confirmText="确认创建"
      />
    </div>
  )
}
