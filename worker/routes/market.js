// worker/routes/market.js
import { Hono } from 'hono'
import { all, first } from '../db.js'
import { parseTags } from '../util.js'

const market = new Hono()

// 是否带"余货"标签（市场只展示余货）
function hasYuHuo(tagsStr) {
  return parseTags(tagsStr).includes('余货')
}

// 余货量 = 数量 - 1（保留 1 张自用）
function yuHuoAmount(item) {
  return Math.max(0, item.quantity - 1)
}

// 第一层：所有"余货"类别及其总余货量
market.get('/categories', async c => {
  const rows = await all(c.env, 'SELECT * FROM items')
  const map = new Map()
  for (const it of rows) {
    if (!hasYuHuo(it.tags)) continue
    map.set(it.category, (map.get(it.category) || 0) + yuHuoAmount(it))
  }
  return c.json(Array.from(map, ([category, total]) => ({ category, total })))
})

// 第二层：某类别下的物品及其总余货量
market.get('/items', async c => {
  const category = c.req.query('category')
  if (!category) return c.json({ error: '缺少类别参数' }, 400)
  const rows = await all(c.env, 'SELECT * FROM items WHERE category = ?', category)
  const map = new Map()
  for (const it of rows) {
    if (!hasYuHuo(it.tags)) continue
    map.set(it.item_name, (map.get(it.item_name) || 0) + yuHuoAmount(it))
  }
  return c.json(Array.from(map, ([item_name, total]) => ({ item_name, total })))
})

// 第三层：拥有某物品"余货"的玩家列表
market.get('/item/:name/players', async c => {
  const env = c.env
  const name = c.req.param('name')
  const rows = await all(env, 'SELECT * FROM items WHERE item_name = ?', name)
  const players = []
  for (const it of rows) {
    if (!hasYuHuo(it.tags)) continue
    const user = await first(env, 'SELECT * FROM users WHERE id = ?', it.user_id)
    players.push({
      item_id: it.id,
      user_id: it.user_id,
      game_name: user ? user.game_name : '未知',
      group_name: user ? user.group_name : '',
      quantity: yuHuoAmount(it),
      tags: parseTags(it.tags)
    })
  }
  return c.json(players)
})

export default market
