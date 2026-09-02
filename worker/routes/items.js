// worker/routes/items.js
import { Hono } from 'hono'
import { first, run, all, lastRowId } from '../db.js'
import { parseTags, normalizeTags } from '../util.js'
import { currentUser } from '../auth-util.js'

const items = new Hono()

// 是否带"余货"标签（他人可交易列表只展示余货）
function hasYuHuo(tags) {
  return tags.includes('余货')
}

// 添加道具（若已存在同类同名道具则合并累加数量）
// 安全：作用于当前登录用户本人，忽略并拒绝客户端传入的其他 user_id
items.post('/', async c => {
  const env = c.env
  const me = await currentUser(env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const { category, item_name, quantity, tags, icon, color } = await c.req.json()
  const user_id = me.id
  if (!category || !item_name) {
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

// 当前登录用户的全部道具（我的道具）
items.get('/mine', async c => {
  const me = await currentUser(c.env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const rows = await all(
    c.env,
    'SELECT * FROM items WHERE user_id = ? ORDER BY category, item_name',
    me.id
  )
  return c.json(rows.map(i => ({ ...i, tags: parseTags(i.tags) })))
})

// 获取某用户道具（鉴权感知）：
//   - 若目标 = 当前登录用户本人 → 返回本人完整私有库存
//   - 否则（他人的 id）→ 仅返回其挂出"余货"的可交易道具，保护其私有库存不被窥探
items.get('/:userId', async c => {
  const env = c.env
  const userId = Number(c.req.param('userId'))
  const me = await currentUser(env, c)
  const isSelf = me && userId === me.id
  const rows = await all(
    env,
    'SELECT * FROM items WHERE user_id = ? ORDER BY category, item_name',
    userId
  )
  const list = rows.map(i => ({ ...i, tags: parseTags(i.tags) }))
  if (isSelf) return c.json(list)
  // 他人：仅余货且数量>1 的可交易道具
  return c.json(list.filter(i => i.quantity > 1 && hasYuHuo(i.tags)))
})

// 更新道具（数量 / 标签）
// 安全：仅道具所属者本人可修改，否则 403
items.put('/:id', async c => {
  const env = c.env
  const me = await currentUser(env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const item = await first(env, 'SELECT * FROM items WHERE id = ?', id)
  if (!item) return c.json({ error: '道具不存在' }, 404)
  if (item.user_id !== me.id) return c.json({ error: '无权操作该道具' }, 403)

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
// 安全：仅道具所属者本人可删除，否则 403
items.delete('/:id', async c => {
  const env = c.env
  const me = await currentUser(env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const id = Number(c.req.param('id'))
  const item = await first(env, 'SELECT id, user_id FROM items WHERE id = ?', id)
  if (!item) return c.json({ error: '道具不存在' }, 404)
  if (item.user_id !== me.id) return c.json({ error: '无权操作该道具' }, 403)
  await run(env, 'DELETE FROM items WHERE id = ?', id)
  return c.json({ success: true })
})

// CSV 批量导入：行格式 类别,道具名称,数量（去重合并，含与已有道具合并）
// 安全：作用于当前登录用户本人
items.post('/import-csv', async c => {
  const env = c.env
  const me = await currentUser(env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const user_id = me.id
  const { rows } = await c.req.json()
  if (!Array.isArray(rows)) return c.json({ error: '参数错误' }, 400)

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
