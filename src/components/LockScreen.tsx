import { useState } from 'react'
import { api } from '../utils/api'

// 锁屏解锁页面：密码由服务端（Cloudflare Secret）校验，前端不保存密码。
// 校验通过后把解锁状态保存在 sessionStorage。
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)

  const handleUnlock = async () => {
    if (!password.trim() || checking) return
    setChecking(true)
    try {
      await api.unlock(password)
      sessionStorage.setItem('unlocked', 'true')
      onUnlock()
    } catch {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 600)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="lock-screen">
      <div className={`lock-card ${shake ? 'shake' : ''}`}>
        <div className="lock-icon">🔒</div>
        <h1>艾莲的原神道具交易市场</h1>
        <p className="lock-hint">密码提示：网页的创建者是谁？</p>
        <input
          type="password"
          value={password}
          onChange={e => {
            setPassword(e.target.value)
            setError(false)
          }}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          placeholder="请输入密码"
          disabled={checking}
          className={`input ${error ? 'input-error' : ''}`}
        />
        <button
          className="btn btn-primary btn-block"
          onClick={handleUnlock}
          disabled={checking}
        >
          {checking ? '校验中...' : '解锁'}
        </button>
        {error && <p className="error-text">密码错误，请重试</p>}
      </div>
    </div>
  )
}
