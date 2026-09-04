// worker/routes/admin.js
// 管理后台（需管理员登录，users.is_admin = 1）：
//   查看全部用户账号信息 + 重置用户密码。
//   任何非管理员（含普通登录用户）访问均返回 403。
// 安全说明：密码以 PBKDF2 哈希存储，本模块只做"重置为新密码"，
//           绝不提供查看/还原明文密码的能力。
import { Hono } from 'hono'
import { all, first, run } from '../db.js'
import { currentAdmin, hashPassword } from '../auth-util.js'

const admin = new Hono()

// 校验当前登录用户是否为管理员；否则返回 null（调用方返回 403）
async function requireAdmin(c) {
  const me = await currentAdmin(c.env, c)
  return me || null
}

// 用户列表：只暴露对外信息 + 账号状态，绝不返回 password_hash 本身
admin.get('/users', async c => {
  const me = await requireAdmin(c)
  if (!me) return c.json({ error: '无权访问后台' }, 403)
  const now = new Date().toISOString()
  const rows = await all(
    c.env,
    `SELECT u.id, u.group_name, u.game_name, u.game_uid, u.created_at, u.last_active_at,
            u.is_admin,
            (u.password_hash IS NOT NULL) AS has_password,
            (SELECT COUNT(*) FROM sessions s
               WHERE s.user_id = u.id AND s.expires_at > ?) AS active_sessions
     FROM users u
     ORDER BY u.id`,
    now
  )
  return c.json(rows)
})

// 重置某用户密码：仅管理员。
// 重设后清除该用户全部会话 → 其所有设备立即被强制退出，需用新密码重新登录。
admin.post('/user/:id/reset-password', async c => {
  const me = await requireAdmin(c)
  if (!me) return c.json({ error: '无权访问后台' }, 403)
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: '缺少用户id' }, 400)
  const { password } = await c.req.json()
  if (typeof password !== 'string' || password.length < 4) {
    return c.json({ error: '新密码至少4位' }, 400)
  }
  const target = await first(c.env, 'SELECT id FROM users WHERE id = ?', id)
  if (!target) return c.json({ error: '用户不存在' }, 404)
  const passwordHash = await hashPassword(password)
  await run(c.env, 'UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, id)
  await run(c.env, 'DELETE FROM sessions WHERE user_id = ?', id)
  return c.json({ ok: true })
})

export default admin
