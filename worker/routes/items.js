// worker/routes/items.js
import { Hono } from 'hono'
import { first, run, all, lastRowId } from '../db.js'
import { parseTags, normalizeTags } from '../util.js'

const items = new Hono()

// 添加道具（若已存在同类同名道具则合并累加数量）
items.post('/', async c => {
  const env = c.env
  const { user_id, category, item_name, quantity, tags, icon, color } = await c.req.json()
  if (!user_id || !category || !item_name) {
    return c.json({ error: '缺少必要字段' }, 400)
  }
  const cat = String(category).trim()
  const name = String(item_name).trim()
  const qty = Number(quantity) || 0
  const now = new Date().toISOString()

  // 查找是否已存在同类同名道具
  const existing = await first(
    env,
    'SELECT * FROM items WHERE user_id = ? AND category = ? AND item_name = ?',
    user_id,
    cat,
    name
  )

  if (existing) {
    // 合并：数量累加，标签取并集后规范化
    const mergedQty = existing.quantity + qty
    const mergedTags = Array.from(
      new Set([...(Array.isArray(tags) ? tags : []), ...parseTags(existing.tags)])
    )
    await run(
      env,
      'UPDATE items SET quantity = ?, tags = ?, updated_at = ? WHERE id = ?',
      mergedQty,
      JSON.stringify(normalizeTags(mergedTags, mergedQty)),
      now,
      existing.id
    )
    const item = await first(env, 'SELECT * FROM items WHERE id = ?', existing.id)
    return c.json({ ...item, tags: parseTags(item.tags) })
  }

  await run(
    env,
    'INSERT INTO items (user_id, category, item_name, quantity, tags, icon, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
    user_id,
    cat,
    name,
    qty,
    JSON.stringify(normalizeTags(Array.isArray(tags) ? tags : [], qty)),
    icon || null,
    color || null,
    now,
    now
  )
  // 查回刚插入的行
  const rows = await all(
    env,
    'SELECT * FROM items WHERE user_id = ? AND category = ? AND item_name = ? ORDER BY id DESC',
    user_id,
    cat,
    name
  )
  const item = rows[0]
  return c.json({ ...item, tags: parseTags(item.tags) }, 201)
})

// 获取用户所有道具
items.get('/:userId', async c => {
  const userId = Number(c.req.param('userId'))
  const rows = await all(
    c.env,
    'SELECT * FROM items WHERE user_id = ? ORDER BY category, item_name',
    userId
  )
  return c.json(rows.map(i => ({ ...i, tags: parseTags(i.tags) })))
})

// 更新道具（数量 / 标签）
items.put('/:id', async c => {
  const env = c.env
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const item = await first(env, 'SELECT * FROM items WHERE id = ?', id)
  if (!item) return c.json({ error: '道具不存在' }, 404)

  const quantity = body.quantity !== undefined ? Number(body.quantity) : item.quantity
  const tags = normalizeTags(
    body.tags !== undefined ? body.tags : parseTags(item.tags),
    quantity
  )
  await run(
    env,
    'UPDATE items SET quantity = ?, tags = ?, updated_at = ? WHERE id = ?',
    quantity,
    JSON.stringify(tags),
    new Date().toISOString(),
    id
  )
  const updated = await first(env, 'SELECT * FROM items WHERE id = ?', id)
  return c.json({ ...updated, tags: parseTags(updated.tags) })
})

// 删除道具
items.delete('/:id', async c => {
  await run(c.env, 'DELETE FROM items WHERE id = ?', Number(c.req.param('id')))
  return c.json({ success: true })
})

// CSV 批量导入：行格式 类别,道具名称,数量（去重合并，含与已有道具合并）
items.post('/import-csv', async c => {
  const env = c.env
  const { user_id, rows } = await c.req.json()
  if (!user_id || !Array.isArray(rows)) return c.json({ error: '参数错误' }, 400)

  // CSV 内部去重合并
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
  let added = 0
  // 用 D1 batch 保证原子性
  const batchStatements = []
  for (const v of map.values()) {
    const existing = await first(
      env,
      'SELECT * FROM items WHERE user_id = ? AND category = ? AND item_name = ?',
      user_id,
      v.category,
      v.item_name
    )
    if (existing) {
      const newQty = existing.quantity + v.quantity
      batchStatements.push(
        env.DB.prepare('UPDATE items SET quantity = ?, tags = ?, updated_at = ? WHERE id = ?').bind(
          newQty,
          JSON.stringify(normalizeTags(parseTags(existing.tags), newQty)),
          now,
          existing.id
        )
      )
    } else {
      batchStatements.push(
        env.DB.prepare(
          'INSERT INTO items (user_id, category, item_name, quantity, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
        ).bind(
          user_id,
          v.category,
          v.item_name,
          v.quantity,
          JSON.stringify(v.quantity > 0 ? [] : ['寻找']),
          now,
          now
        )
      )
      added++
    }
  }
  if (batchStatements.length) await env.DB.batch(batchStatements)
  return c.json({ added })
})

export default items
