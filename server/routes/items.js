import { Router } from 'express'
import db from '../database.js'

const router = Router()

// 解析 tags JSON 字段（SQLite 中存的是 JSON 字符串）
function parseTags(tags) {
  try {
    return JSON.parse(tags || '[]')
  } catch {
    return []
  }
}

// 标签规则工具：
// - 数量为 0 的道具自动打上"寻找"标签
// - "余货"标签由用户手动添加（数量 > 1 时才允许）
function normalizeTags(tags, quantity) {
  const set = new Set(tags)
  if (quantity <= 0) set.add('寻找')
  return Array.from(set)
}

// 添加道具（若已存在同类同名道具，则合并累加数量，而非重复添加）
router.post('/', (req, res) => {
  const { user_id, category, item_name, quantity, tags } = req.body
  if (!user_id || !category || !item_name) {
    return res.status(400).json({ error: '缺少必要字段' })
  }
  const cat = String(category).trim()
  const name = String(item_name).trim()
  const qty = Number(quantity) || 0
  const now = new Date().toISOString()

  // 查找是否已存在同类同名道具
  const existing = db
    .prepare('SELECT * FROM items WHERE user_id = ? AND category = ? AND item_name = ?')
    .get(user_id, cat, name)

  if (existing) {
    // 合并：数量累加，标签取两者并集后按规则规范化
    const mergedQty = existing.quantity + qty
    const mergedTags = Array.from(
      new Set([...(Array.isArray(tags) ? tags : []), ...parseTags(existing.tags)])
    )
    const tagList = normalizeTags(mergedTags, mergedQty)
    db.prepare('UPDATE items SET quantity = ?, tags = ?, updated_at = ? WHERE id = ?').run(
      mergedQty,
      JSON.stringify(tagList),
      now,
      existing.id
    )
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(existing.id)
    item.tags = parseTags(item.tags)
    return res.json(item)
  }

  const tagList = normalizeTags(Array.isArray(tags) ? tags : [], qty)
  const icon = req.body.icon || null
  const color = req.body.color || null
  const info = db
    .prepare(
      'INSERT INTO items (user_id, category, item_name, quantity, tags, icon, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
    )
    .run(user_id, cat, name, qty, JSON.stringify(tagList), icon, color, now, now)

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid)
  item.tags = parseTags(item.tags)
  res.status(201).json(item)
})

// 获取用户所有道具
router.get('/:userId', (req, res) => {
  const userId = Number(req.params.userId)
  const items = db
    .prepare('SELECT * FROM items WHERE user_id = ? ORDER BY category, item_name')
    .all(userId)
  res.json(items.map(i => ({ ...i, tags: parseTags(i.tags) })))
})

// 更新道具（数量 / 标签）
router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id)
  if (!item) return res.status(404).json({ error: '道具不存在' })

  const quantity = req.body.quantity !== undefined ? Number(req.body.quantity) : item.quantity
  let tags = req.body.tags !== undefined ? req.body.tags : parseTags(item.tags)
  // 数量为 0 自动补"寻找"标签
  tags = normalizeTags(tags, quantity)

  db.prepare('UPDATE items SET quantity = ?, tags = ?, updated_at = ? WHERE id = ?').run(
    quantity,
    JSON.stringify(tags),
    new Date().toISOString(),
    id
  )
  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id)
  updated.tags = parseTags(updated.tags)
  res.json(updated)
})

// 删除道具
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(Number(req.params.id))
  res.json({ success: true })
})

// CSV 批量导入：每行格式为 "类别,道具名称,数量"
// 设计决策：导入时自动去重合并——同类同名道具数量累加，而非重复建卡
router.post('/import-csv', (req, res) => {
  const { user_id, rows } = req.body
  if (!user_id || !Array.isArray(rows)) {
    return res.status(400).json({ error: '参数错误' })
  }

  // 按 "类别::名称" 合并数量
  const map = new Map()
  for (const r of rows) {
    const category = String(r.category || '').trim()
    const name = String(r.item_name || '').trim()
    const qty = Number(r.quantity) || 0
    if (!category || !name) continue
    const key = `${category}::${name}`
    if (map.has(key)) map.get(key).quantity += qty
    else map.set(key, { category, item_name: name, quantity: qty })
  }

  const now = new Date().toISOString()
  const insert = db.prepare(
    'INSERT INTO items (user_id, category, item_name, quantity, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
  )
  const findExisting = db.prepare(
    'SELECT * FROM items WHERE user_id = ? AND category = ? AND item_name = ?'
  )
  const updateItem = db.prepare(
    'UPDATE items SET quantity = ?, tags = ?, updated_at = ? WHERE id = ?'
  )

  let added = 0
  // node:sqlite 无 db.transaction，使用显式 BEGIN/COMMIT/ROLLBACK
  db.exec('BEGIN')
  try {
    for (const v of map.values()) {
      // 若该用户已存在同类同名道具，则累加数量到已有条目（避免重复导入产生重复）
      const existing = findExisting.get(user_id, v.category, v.item_name)
      if (existing) {
        const newQty = existing.quantity + v.quantity
        updateItem.run(
          newQty,
          JSON.stringify(normalizeTags(parseTags(existing.tags), newQty)),
          now,
          existing.id
        )
      } else {
        insert.run(
          user_id,
          v.category,
          v.item_name,
          v.quantity,
          JSON.stringify(v.quantity > 0 ? [] : ['寻找']),
          now,
          now
        )
        added++
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  res.json({ added })
})

export default router
