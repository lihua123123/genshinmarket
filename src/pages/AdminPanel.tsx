import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../utils/api'
import { AdminUser } from '../types'
import Modal from '../components/Modal'

// B服判断：9位且以 5 开头（与后端 worker/util.js isBServer 一致）
function isBServer(uid: string): boolean {
  return /^5\d{8}$/.test(String(uid))
}
function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

// 后台管理：查看用户账号信息 + 重置用户密码（仅管理员可见/可用）
export default function AdminPanel() {
  const { currentUser } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  // 重置密码弹窗状态
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [pwd, setPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    if (!currentUser?.is_admin) return
    setLoading(true)
    try {
      setUsers(await api.adminUsers())
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  // 非管理员（理论上导航不会进入，防御性处理）
  if (!currentUser?.is_admin) {
    return (
      <div className="page">
        <div className="breadcrumb">
          <span className="crumb active">后台管理</span>
        </div>
        <h2>后台管理</h2>
        <p className="empty">无权访问后台：仅管理员账号可查看</p>
      </div>
    )
  }

  const openReset = (u: AdminUser) => {
    setResetTarget(u)
    setPwd('')
    setConfirmPwd('')
    setFormError('')
  }

  const doReset = async () => {
    if (!resetTarget) return
    setFormError('')
    if (pwd.length < 4) {
      setFormError('新密码至少4位')
      return
    }
    if (pwd !== confirmPwd) {
      setFormError('两次输入的密码不一致')
      return
    }
    setSubmitting(true)
    try {
      await api.adminResetPassword(resetTarget.id, pwd)
      toast.success(`已重置 ${resetTarget.game_name} 的密码`)
      setResetTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="breadcrumb">
        <span className="crumb active">后台管理</span>
      </div>
      <h2>后台管理</h2>
      <p className="muted">
        查看用户账号信息，并可重置用户密码。密码以哈希存储，无法查看明文；重置后该用户需用新密码重新登录。
      </p>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : users.length === 0 ? (
        <div className="empty">暂无用户</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>游戏UID</th>
                <th>游戏名</th>
                <th>群名</th>
                <th>服务器</th>
                <th>注册时间</th>
                <th>最近活跃</th>
                <th>已设密码</th>
                <th>在线会话</th>
                <th>管理员</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.game_uid}</td>
                  <td>{u.game_name}</td>
                  <td>{u.group_name}</td>
                  <td>{isBServer(u.game_uid) ? 'B服' : '官方'}</td>
                  <td>{fmtTime(u.created_at)}</td>
                  <td>{u.last_active_at ? fmtTime(u.last_active_at) : '从未上线'}</td>
                  <td>{u.has_password ? '是' : '未设'}</td>
                  <td>{u.active_sessions}</td>
                  <td>{u.is_admin ? '是' : '—'}</td>
                  <td>
                    <button className="btn btn-small" onClick={() => openReset(u)}>
                      重置密码
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={resetTarget !== null}
        title={`重置「${resetTarget?.game_name ?? ''}」的密码`}
        onClose={() => setResetTarget(null)}
      >
        <p className="muted reset-tip">
          重置后该用户全部会话将失效（被强制退出），需用新密码重新登录。
        </p>
        <div className="form-group">
          <label>新密码</label>
          <input
            className="input"
            type="password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            placeholder="至少4位"
          />
        </div>
        <div className="form-group">
          <label>确认新密码</label>
          <input
            className="input"
            type="password"
            value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            placeholder="再次输入"
          />
        </div>
        {formError && <div className="admin-error">{formError}</div>}
        <div className="confirm-actions">
          <button className="btn" onClick={() => setResetTarget(null)}>
            取消
          </button>
          <button className="btn btn-danger" disabled={submitting} onClick={doReset}>
            {submitting ? '提交中...' : '确认重置'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
