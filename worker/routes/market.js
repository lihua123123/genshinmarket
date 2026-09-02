// worker/routes/market.js
import { Hono } from 'hono'
import { all } from '../db.js'
import { parseTags, isBServer } from '../util.js'

const market = new Hono()

// 是否带"余货"标签（市场只展示余货）
function hasYuHuo(tagsStr) {
  return parseTags(tagsStr).includes('余货')
}

// 余货量 = 数量 - 1（保留 1 张自用）
function yuHuoAmount(item) {
  return Math.max(0, item.quantity - 1)
}

// 服务端过滤参数：all（全部，默认）| b（仅B服）| nonb（不看B服）
// 返回该条 item 是否应纳入当前筛选结果
function matchServer(userId, usersById, server) {
  if (!server || server === 'all') return true
  const u = usersById.get(userId)
  const isB = isBServer(u && u.game_uid)
  if (server === 'b') return isB
  if (server === 'nonb') return !isB
  return true
}

// 加载全部用户为 id -> user 的映射，用于判定每条道具的归属服务器、展示昵称与在线状态
async function loadUsersById(env) {
  const users = await all(
    env,
    'SELECT id, game_name, group_name, game_uid, last_active_at FROM users'
  )
  return new Map(users.map(u => [u.id, u]))
}

// 第一层：所有"余货"类别及其总余货量（可按服务器过滤）
market.get('/categories', async c => {
  const server = c.req.query('server') || 'all'
  const rows = await all(c.env, 'SELECT * FROM items')
  const usersById = await loadUsersById(c.env)
  const map = new Map()
  for (const it of rows) {
    if (!hasYuHuo(it.tags)) continue
    if (!matchServer(it.user_id, usersById, server)) continue
    map.set(it.category, (map.get(it.category) || 0) + yuHuoAmount(it))
  }
  return c.json(Array.from(map, ([category, total]) => ({ category, total })))
})

// 第二层：某类别下的物品及其总余货量（可按服务器过滤）
market.get('/items', async c => {
  const category = c.req.query('category')
  if (!category) return c.json({ error: '缺少类别参数' }, 400)
  const server = c.req.query('server') || 'all'
  const rows = await all(c.env, 'SELECT * FROM items WHERE category = ?', category)
  const usersById = await loadUsersById(c.env)
  const map = new Map()
  for (const it of rows) {
    if (!hasYuHuo(it.tags)) continue
    if (!matchServer(it.user_id, usersById, server)) continue
    map.set(it.item_name, (map.get(it.item_name) || 0) + yuHuoAmount(it))
  }
  return c.json(Array.from(map, ([item_name, total]) => ({ item_name, total })))
})

// 第三层：拥有某物品"余货"的玩家列表（可按服务器过滤，并标注 is_b）
market.get('/item/:name/players', async c => {
  const env = c.env
  const name = c.req.param('name')
  const server = c.req.query('server') || 'all'
  const rows = await all(env, 'SELECT * FROM items WHERE item_name = ?', name)
  const usersById = await loadUsersById(env)
  const players = []
  for (const it of rows) {
    if (!hasYuHuo(it.tags)) continue
    if (!matchServer(it.user_id, usersById, server)) continue
    const user = usersById.get(it.user_id)
    players.push({
      item_id: it.id,
      user_id: it.user_id,
      game_name: user ? user.game_name : '未知',
      group_name: user ? user.group_name : '',
      is_b: isBServer(user && user.game_uid),
      quantity: yuHuoAmount(it),
      tags: parseTags(it.tags),
      // 在线状态依据：该玩家最近活跃时间，前端据此判定在线/离线时长
      last_active_at: user ? user.last_active_at : null
    })
  }
  return c.json(players)
})

export default market
