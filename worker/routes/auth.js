// worker/routes/auth.js
import { Hono } from 'hono'
import { first, run, lastRowId } from '../db.js'
import { hashPassword, verifyPassword, createSession, currentUser, deleteSession } from '../auth-util.js'

const auth = new Hono()

// 只返回对外安全字段，绝不泄露 password_hash
const USER_COLS = 'id, group_name, game_name, game_uid, created_at'

// 注册（需设置登录密码；成功后自动登录并返回令牌）
auth.post('/register', async c => {
  const env = c.env
  const { group_name, game_name, game_uid, password } = await c.req.json()
  if (!group_name || !game_name || !game_uid || !password) {
    return c.json({ error: '所有字段均为必填项' }, 400)
  }
  if (!/^\d{9,10}$/.test(String(game_uid).trim())) {
    return c.json({ error: '游戏UID需为9-10位纯数字' }, 400)
  }
  if (String(password).length < 4) {
    return c.json({ error: '密码至少4位' }, 400)
  }
  try {
    const passwordHash = await hashPassword(String(password))
    const r = await run(
      env,
      'INSERT INTO users (group_name, game_name, game_uid, password_hash, created_at) VALUES (?,?,?,?,?)',
      String(group_name).trim(),
      String(game_name).trim(),
      String(game_uid).trim(),
      passwordHash,
      new Date().toISOString()
    )
    const id = lastRowId(r)
    const user = await first(env, `SELECT ${USER_COLS} FROM users WHERE id = ?`, id)
    const token = await createSession(env, id)
    return c.json({ token, user }, 201)
  } catch (e) {
    // D1 唯一约束冲突：game_uid 已存在
    if (String(e?.message || e?.cause?.message || '').includes('UNIQUE')) {
      return c.json({ error: '该游戏UID已存在，请直接登录' }, 400)
    }
    throw e
  }
})

// 登录：游戏UID + 密码，校验通过后签发会话令牌
auth.post('/login', async c => {
  const env = c.env
  const { game_uid, password } = await c.req.json()
  if (!game_uid || !password) {
    return c.json({ error: '请输入游戏UID和密码' }, 400)
  }
  const user = await first(env, 'SELECT * FROM users WHERE game_uid = ?', String(game_uid).trim())
  if (!user) return c.json({ error: '用户不存在或密码错误' }, 401)
  if (!user.password_hash) {
    // 迁移前创建的老账号未设置密码，需重新注册或由开发者重置
    return c.json({ error: '该账号尚未设置密码，请重新注册或联系开发者重置' }, 401)
  }
  const ok = await verifyPassword(String(password), user.password_hash)
  if (!ok) return c.json({ error: '用户不存在或密码错误' }, 401)
  const token = await createSession(env, user.id)
  const safe = {
    id: user.id,
    group_name: user.group_name,
    game_name: user.game_name,
    game_uid: user.game_uid,
    created_at: user.created_at
  }
  return c.json({ token, user: safe })
})

// 当前登录用户（恢复会话用）
auth.get('/me', async c => {
  const user = await currentUser(c.env, c)
  if (!user) return c.json({ error: '未登录或登录已过期' }, 401)
  return c.json(user)
})

// 登出（删除当前会话令牌）
auth.post('/logout', async c => {
  await deleteSession(c.env, c)
  return c.json({ ok: true })
})

// 获取单个用户资料（需登录）。用于交易对方展示；仅能通过已知 id 获取，
// 不再提供"枚举全部用户"的公开接口，防止无密码冒充他人。
auth.get('/user/:id', async c => {
  const me = await currentUser(c.env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: '缺少用户id' }, 400)
  const u = await first(c.env, `SELECT ${USER_COLS} FROM users WHERE id = ?`, id)
  if (!u) return c.json({ error: '用户不存在' }, 404)
  return c.json(u)
})

export default auth
