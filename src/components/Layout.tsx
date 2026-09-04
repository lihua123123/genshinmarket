import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// 整体布局：顶部导航栏 + 内容区；右上角显示当前登录用户（严格单账号，无多用户切换）
export default function Layout({ children }: { children: ReactNode }) {
  const { currentUser, logout } = useAuth()

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
          {currentUser?.is_admin ? (
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              后台管理
            </NavLink>
          ) : null}
        </div>
        <div className="nav-user">
          {currentUser && (
            <>
              <span className="user-switch-text">
                {currentUser.game_name}（{currentUser.group_name}）
              </span>
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
