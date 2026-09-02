import { useState, useEffect } from 'react'

const PASSWORD = '艾莲其实是爱恋的意思'

// 锁屏解锁页面：密码正确后进入，解锁状态保存在 sessionStorage
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  const handleUnlock = () => {
    if (password === PASSWORD) {
      sessionStorage.setItem('unlocked', 'true')
      onUnlock()
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 600)
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
          className={`input ${error ? 'input-error' : ''}`}
        />
        <button className="btn btn-primary btn-block" onClick={handleUnlock}>
          解锁
        </button>
        {error && <p className="error-text">密码错误，请重试</p>}
      </div>
    </div>
  )
}
