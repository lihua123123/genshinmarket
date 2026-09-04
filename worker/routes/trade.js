// worker/routes/trade.js
import { Hono } from 'hono'
import { all, first, run, lastRowId } from '../db.js'
import { parseTags, normalizeTags, isBServer } from '../util.js'
import { currentUser } from '../auth-util.js'

const trade = new Hono()

// 发起交易（发起方同一时间只能有一笔进行中交易）
// 安全：发起方 = 当前登录用户本人（忽略客户端传入的 initiator_id），
//       并校验双方确实拥有各自提供的道具、同类别、且对方道具为已挂"余货"
trade.post('/initiate', async c => {
  const env = c.env
  const me = await currentUser(env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const { target_id, initiator_item_id, target_item_id } = await c.req.json()
  const initiator_id = me.id
  if (!target_id || !initiator_item_id || !target_item_id) {
    return c.json({ error: '交易参数不完整' }, 400)
  }
  const targetId = Number(target_id)
  if (targetId === initiator_id) return c.json({ error: '不能与自己交易' }, 400)

  const targetUser = await first(env, 'SELECT id, game_uid FROM users WHERE id = ?', targetId)
  if (!targetUser) return c.json({ error: '交易对象不存在' }, 404)

  // 不同服务器（B服/官方）之间无法交易
  if (isBServer(me.game_uid) !== isBServer(targetUser.game_uid)) {
    return c.json({ error: 'B服与官方玩家无法互相交易' }, 400)
  }

  const initItem = await first(env, 'SELECT * FROM items WHERE id = ?', initiator_item_id)
  const tgtItem = await first(env, 'SELECT * FROM items WHERE id = ?', target_item_id)
  if (!initItem || !tgtItem) return c.json({ error: '交易道具不存在' }, 404)
  if (initItem.user_id !== initiator_id) {
    return c.json({ error: '不能拿他人的道具发起交易' }, 403)
  }
  if (tgtItem.user_id !== targetId) {
    return c.json({ error: '交易对象不拥有该道具' }, 403)
  }
  if (initItem.category !== tgtItem.category) {
    return c.json({ error: '仅支持同类别交易' }, 400)
  }
  // 对方只能给出其挂出"余货"的可交易道具
  if (!parseTags(tgtItem.tags).includes('余货') || tgtItem.quantity <= 1) {
    return c.json({ error: '对方该道具未挂出余货，无法交易' }, 400)
  }

  // 发起方若有任何 pending 交易则拒绝
  const existing = await first(
    env,
    "SELECT * FROM trades WHERE status = 'pending' AND (initiator_id = ? OR target_id = ?)",
    initiator_id,
    initiator_id
  )
  if (existing) {
    return c.json({ error: '已有进行中的交易，请先完成或取消后再发起下一次交易' }, 400)
  }
  const r = await run(
    env,
    'INSERT INTO trades (initiator_id, target_id, initiator_item_id, target_item_id, status, created_at) VALUES (?,?,?,?,?,?)',
    initiator_id,
    targetId,
    initiator_item_id,
    target_item_id,
    'pending',
    new Date().toISOString()
  )
  const t = await first(env, 'SELECT * FROM trades WHERE id = ?', lastRowId(r))
  return c.json(t, 201)
})

// 完成交易：发起方付出物品 -1；对方物品转移到发起方并 +1
// 安全：仅交易任一方可完成；服务端再次校验双方道具归属
trade.post('/:id/complete', async c => {
  const env = c.env
  const me = await currentUser(env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const id = Number(c.req.param('id'))
  const t = await first(env, 'SELECT * FROM trades WHERE id = ?', id)
  if (!t) return c.json({ error: '交易不存在' }, 404)
  if (t.initiator_id !== me.id && t.target_id !== me.id) {
    return c.json({ error: '无权操作该交易' }, 403)
  }
  if (t.status !== 'pending') return c.json({ error: '交易已结束' }, 400)

  const now = new Date().toISOString()
  // 读取双方物品当前值
  const initItem = t.initiator_item_id
    ? await first(env, 'SELECT * FROM items WHERE id = ?', t.initiator_item_id)
    : null
  const targetItem = t.target_item_id
    ? await first(env, 'SELECT * FROM items WHERE id = ?', t.target_item_id)
    : null

  // 防篡改：物品归属必须与交易双方一致
  if (initItem && initItem.user_id !== t.initiator_id) {
    return c.json({ error: '道具归属异常，交易已中止' }, 409)
  }
  if (targetItem && targetItem.user_id !== t.target_id) {
    return c.json({ error: '道具归属异常，交易已中止' }, 409)
  }

  const stmts = []
  if (initItem) {
    const newQty = Math.max(0, initItem.quantity - 1)
    stmts.push(
      env.DB.prepare('UPDATE items SET quantity = ?, tags = ?, updated_at = ? WHERE id = ?').bind(
        newQty,
        JSON.stringify(normalizeTags(parseTags(initItem.tags), newQty)),
        now,
        initItem.id
      )
    )
  }
  if (targetItem) {
    const newQty = targetItem.quantity + 1
    stmts.push(
      env.DB.prepare('UPDATE items SET user_id = ?, quantity = ?, tags = ?, updated_at = ? WHERE id = ?').bind(
        t.initiator_id,
        newQty,
        JSON.stringify(normalizeTags(parseTags(targetItem.tags), newQty)),
        now,
        targetItem.id
      )
    )
  }
  stmts.push(env.DB.prepare("UPDATE trades SET status = 'completed', completed_at = ? WHERE id = ?").bind(now, id))
  await env.DB.batch(stmts)

  return c.json(await first(env, 'SELECT * FROM trades WHERE id = ?', id))
})

// 取消交易
// 安全：仅交易任一方可取消
trade.post('/:id/cancel', async c => {
  const env = c.env
  const me = await currentUser(env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const id = Number(c.req.param('id'))
  const t = await first(env, 'SELECT * FROM trades WHERE id = ?', id)
  if (!t) return c.json({ error: '交易不存在' }, 404)
  if (t.initiator_id !== me.id && t.target_id !== me.id) {
    return c.json({ error: '无权操作该交易' }, 403)
  }
  if (t.status !== 'pending') return c.json({ error: '交易已结束' }, 400)
  await run(
    env,
    "UPDATE trades SET status = 'cancelled', completed_at = ? WHERE id = ?",
    new Date().toISOString(),
    id
  )
  return c.json(await first(env, 'SELECT * FROM trades WHERE id = ?', id))
})

// 获取当前登录用户的交易记录（含双方与物品信息）
// 安全：仅返回本人相关交易
trade.get('/mine', async c => {
  const env = c.env
  const me = await currentUser(env, c)
  if (!me) return c.json({ error: '未登录或登录已过期' }, 401)
  const userId = me.id
  const trades = await all(
    env,
    'SELECT * FROM trades WHERE initiator_id = ? OR target_id = ? ORDER BY created_at DESC',
    userId,
    userId
  )
  const result = []
  for (const t of trades) {
    const initiator = await first(env, 'SELECT * FROM users WHERE id = ?', t.initiator_id)
    const target = await first(env, 'SELECT * FROM users WHERE id = ?', t.target_id)
    const initiatorItem = t.initiator_item_id
      ? await first(env, 'SELECT * FROM items WHERE id = ?', t.initiator_item_id)
      : null
    const targetItem = t.target_item_id
      ? await first(env, 'SELECT * FROM items WHERE id = ?', t.target_item_id)
      : null
    result.push({
      ...t,
      initiator: initiator ? { id: initiator.id, game_name: initiator.game_name, group_name: initiator.group_name, game_uid: initiator.game_uid } : null,
      target: target ? { id: target.id, game_name: target.game_name, group_name: target.group_name, game_uid: target.game_uid } : null,
      initiator_item: initiatorItem ? { id: initiatorItem.id, category: initiatorItem.category, item_name: initiatorItem.item_name, quantity: initiatorItem.quantity } : null,
      target_item: targetItem ? { id: targetItem.id, category: targetItem.category, item_name: targetItem.item_name, quantity: targetItem.quantity } : null
    })
  }
  return c.json(result)
})

export default trade
