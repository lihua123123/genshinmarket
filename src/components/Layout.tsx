import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// 整体布局：顶部导航栏 + 内容区；导航栏内置多用户切换
export default function Layout({ children }: { children: ReactNode }) {
  const { currentUser, users, setCurrentUser, logout } = useAuth()

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="nav-brand">🎮 原神交易市场</div>
        <div className="nav-links">
          <NavLink to="/my" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            我的道具
          </NavLink>
          <NavLink
            to="/market"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            市场
          </NavLink>
          <NavLink
            to="/trades"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            当前交易
          </NavLink>
        </div>
        <div className="nav-user">
          {currentUser && (
            <>
              <select
                className="user-switch"
                value={currentUser.id}
                onChange={e => {
                  const u = users.find(x => x.id === Number(e.target.value))
                  if (u) setCurrentUser(u)
                }}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.game_name}（{u.group_name}）
                  </option>
                ))}
              </select>
              <button className="logout-btn" onClick={logout}>
                退出
              </button>
            </>
          )}
        </div>
      </nav>
      <main className="content">{children}</main>
    </div>
  )
}
