// worker/routes/auth.js
import { Hono } from 'hono'
import { first, run, all, lastRowId } from '../db.js'

const auth = new Hono()

// 注册用户（创建后不可更改）
auth.post('/register', async c => {
  const env = c.env
  const { group_name, game_name, game_uid } = await c.req.json()
  if (!group_name || !game_name || !game_uid) {
    return c.json({ error: '所有字段均为必填项' }, 400)
  }
  if (!/^\d{9,10}$/.test(String(game_uid).trim())) {
    return c.json({ error: '游戏UID需为9-10位纯数字' }, 400)
  }
  try {
    const r = await run(
      env,
      'INSERT INTO users (group_name, game_name, game_uid, created_at) VALUES (?,?,?,?)',
      String(group_name).trim(),
      String(game_name).trim(),
      String(game_uid).trim(),
      new Date().toISOString()
    )
    const user = await first(env, 'SELECT * FROM users WHERE id = ?', lastRowId(r))
    return c.json(user, 201)
  } catch (e) {
    // D1 唯一约束冲突：game_uid 已存在
    if (String(e?.message || e?.cause?.message || '').includes('UNIQUE')) {
      return c.json({ error: '该游戏UID已存在，请直接登录' }, 400)
    }
    throw e
  }
})

// 获取指定用户（按 id）
auth.get('/current', async c => {
  const env = c.env
  const id = Number(c.req.query('id'))
  if (!id) return c.json({ error: '缺少用户id' }, 400)
  const user = await first(env, 'SELECT * FROM users WHERE id = ?', id)
  if (!user) return c.json({ error: '用户不存在' }, 404)
  return c.json(user)
})

// 获取全部用户（多用户切换）
auth.get('/users', async c => {
  const users = await all(c.env, 'SELECT * FROM users ORDER BY id DESC')
  return c.json(users)
})

export default auth
