import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import ConfirmDialog from './ConfirmDialog'

// 用户注册 / 登录页面
// 安全：不再列出全部用户供无密码切换，登录需输入"游戏UID + 密码"。
//       一个设备同时只登录一个账号（严格单账号）。
export default function RegisterScreen() {
  const { login } = useAuth()
  const [mode, setMode] = useState<'register' | 'login'>('register')

  // 注册字段
  const [groupName, setGroupName] = useState('')
  const [gameName, setGameName] = useState('')
  const [gameUid, setGameUid] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  // 登录字段
  const [loginUid, setLoginUid] = useState('')
  const [loginPwd, setLoginPwd] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = () => {
    if (!groupName.trim() || !gameName.trim() || !gameUid.trim() || !password) {
      setError('所有字段均为必填项')
      return false
    }
    if (!/^\d{9,10}$/.test(gameUid.trim())) {
      setError('游戏UID需为9-10位纯数字')
      return false
    }
    if (password.length < 4) {
      setError('密码至少4位')
      return false
    }
    if (password !== confirmPwd) {
      setError('两次输入的密码不一致')
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
      const { token, user } = await api.register({
        group_name: groupName.trim(),
        game_name: gameName.trim(),
        game_uid: gameUid.trim(),
        password
      })
      login(token, user)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setError('')
    if (!loginUid.trim() || !loginPwd) {
      setError('请输入游戏UID和密码')
      return
    }
    setLoading(true)
    try {
      const { token, user } = await api.login({
        game_uid: loginUid.trim(),
        password: loginPwd
      })
      login(token, user)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
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
            <div className="form-group">
              <label>设置密码</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="登录密码（至少4位）"
              />
            </div>
            <div className="form-group">
              <label>确认密码</label>
              <input
                className="input"
                type="password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="再次输入密码"
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
              <label>游戏UID</label>
              <input
                className="input"
                value={loginUid}
                onChange={e => setLoginUid(e.target.value)}
                placeholder="注册时填写的游戏UID"
                inputMode="numeric"
              />
            </div>
            <div className="form-group">
              <label>密码</label>
              <input
                className="input"
                type="password"
                value={loginPwd}
                onChange={e => setLoginPwd(e.target.value)}
                placeholder="请输入密码"
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-block" onClick={handleLogin} disabled={loading}>
              {loading ? '登录中...' : '登录'}
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
