import { Router } from 'express'
import db from '../database.js'

const router = Router()

// 注册用户（创建后不可修改注册信息）
router.post('/register', (req, res) => {
  const { group_name, game_name, game_uid } = req.body

  // 输入验证：三个字段均为必填
  if (!group_name || !game_name || !game_uid) {
    return res.status(400).json({ error: '所有字段均为必填项' })
  }
  // 游戏UID 需为 9-10 位纯数字
  if (!/^\d{9,10}$/.test(String(game_uid).trim())) {
    return res.status(400).json({ error: '游戏UID需为9-10位纯数字' })
  }

  try {
    const stmt = db.prepare(
      'INSERT INTO users (group_name, game_name, game_uid, created_at) VALUES (?, ?, ?, ?)'
    )
    const info = stmt.run(
      String(group_name).trim(),
      String(game_name).trim(),
      String(game_uid).trim(),
      new Date().toISOString()
    )
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json(user)
  } catch (e) {
    // game_uid 有 UNIQUE 约束，捕获重复注册
    // better-sqlite3 的 code 为 'SQLITE_CONSTRAINT_UNIQUE'；node:sqlite 的 errcode 为 2067
    const isUniqueViolation = e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.errcode === 2067
    if (isUniqueViolation) {
      return res.status(400).json({ error: '该游戏UID已存在，请直接登录' })
    }
    throw e
  }
})

// 获取指定用户（用于切换用户后刷新信息）
router.get('/current', (req, res) => {
  const id = Number(req.query.id)
  if (!id) return res.status(400).json({ error: '缺少用户id' })
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  if (!user) return res.status(404).json({ error: '用户不存在' })
  res.json(user)
})

// 获取全部用户（用于多用户切换下拉框）
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY id DESC').all()
  res.json(users)
})

export default router
