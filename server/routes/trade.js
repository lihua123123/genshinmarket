import { Router } from 'express'
import db from '../database.js'

const router = Router()

function parseTags(t) {
  try {
    return JSON.parse(t || '[]')
  } catch {
    return []
  }
}

// 标签规则：数量为 0 自动补"寻找"标签
function normalizeTags(tags, quantity) {
  const set = new Set(tags)
  if (quantity <= 0) set.add('寻找')
  return Array.from(set)
}

// 发起交易
router.post('/initiate', (req, res) => {
  const { initiator_id, target_id, initiator_item_id, target_item_id } = req.body
  if (!initiator_id || !target_id || !initiator_item_id || !target_item_id) {
    return res.status(400).json({ error: '交易参数不完整' })
  }

  // 设计决策：发起方同一时间只能存在一笔进行中的交易（确认交易后关闭交易通道，完成后才能发起下一次）
  const existing = db
    .prepare(
      `SELECT * FROM trades WHERE status = 'pending' AND (initiator_id = ? OR target_id = ?)`
    )
    .get(initiator_id, initiator_id)
  if (existing) {
    return res.status(400).json({ error: '已有进行中的交易，请先完成或取消后再发起下一次交易' })
  }

  const info = db
    .prepare(
      'INSERT INTO trades (initiator_id, target_id, initiator_item_id, target_item_id, status, created_at) VALUES (?,?,?,?,?,?)'
    )
    .run(initiator_id, target_id, initiator_item_id, target_item_id, 'pending', new Date().toISOString())

  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(trade)
})

// 完成交易：扣除发起方付出的物品，并把对方提供的物品转移给发起方并 +1
router.post('/:id/complete', (req, res) => {
  const id = Number(req.params.id)
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id)
  if (!trade) return res.status(404).json({ error: '交易不存在' })
  if (trade.status !== 'pending') return res.status(400).json({ error: '交易已结束' })

  const now = new Date().toISOString()
  // node:sqlite 无 db.transaction，使用显式 BEGIN/COMMIT/ROLLBACK
  db.exec('BEGIN')
  try {
    // 发起方付出的物品：数量 -1
    const initItem = db.prepare('SELECT * FROM items WHERE id = ?').get(trade.initiator_item_id)
    if (initItem) {
      const newQty = Math.max(0, initItem.quantity - 1)
      db.prepare('UPDATE items SET quantity = ?, tags = ?, updated_at = ? WHERE id = ?').run(
        newQty,
        JSON.stringify(normalizeTags(parseTags(initItem.tags), newQty)),
        now,
        initItem.id
      )
    }
    // 对方提供的物品：转移到发起方名下并 +1（发起方收到 1 张牌）
    const targetItem = db.prepare('SELECT * FROM items WHERE id = ?').get(trade.target_item_id)
    if (targetItem) {
      const newQty = targetItem.quantity + 1
      db.prepare(
        'UPDATE items SET user_id = ?, quantity = ?, tags = ?, updated_at = ? WHERE id = ?'
      ).run(trade.initiator_id, newQty, JSON.stringify(normalizeTags(parseTags(targetItem.tags), newQty)), now, targetItem.id)
    }
    db.prepare("UPDATE trades SET status = 'completed', completed_at = ? WHERE id = ?").run(now, id)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(id)
  res.json(updated)
})

// 取消交易
router.post('/:id/cancel', (req, res) => {
  const id = Number(req.params.id)
  const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id)
  if (!trade) return res.status(404).json({ error: '交易不存在' })
  if (trade.status !== 'pending') return res.status(400).json({ error: '交易已结束' })
  db.prepare("UPDATE trades SET status = 'cancelled', completed_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    id
  )
  res.json(db.prepare('SELECT * FROM trades WHERE id = ?').get(id))
})

// 获取用户交易记录（含双方信息与物品信息）
router.get('/user/:userId', (req, res) => {
  const userId = Number(req.params.userId)
  const trades = db
    .prepare('SELECT * FROM trades WHERE initiator_id = ? OR target_id = ? ORDER BY created_at DESC')
    .all(userId, userId)

  const result = trades.map(t => {
    const initiator = db.prepare('SELECT * FROM users WHERE id = ?').get(t.initiator_id)
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(t.target_id)
    const initiatorItem = t.initiator_item_id
      ? db.prepare('SELECT * FROM items WHERE id = ?').get(t.initiator_item_id)
      : null
    const targetItem = t.target_item_id
      ? db.prepare('SELECT * FROM items WHERE id = ?').get(t.target_item_id)
      : null
    return {
      ...t,
      initiator: initiator
        ? { id: initiator.id, game_name: initiator.game_name, group_name: initiator.group_name, game_uid: initiator.game_uid }
        : null,
      target: target
        ? { id: target.id, game_name: target.game_name, group_name: target.group_name, game_uid: target.game_uid }
        : null,
      initiator_item: initiatorItem
        ? { id: initiatorItem.id, category: initiatorItem.category, item_name: initiatorItem.item_name, quantity: initiatorItem.quantity }
        : null,
      target_item: targetItem
        ? { id: targetItem.id, category: targetItem.category, item_name: targetItem.item_name, quantity: targetItem.quantity }
        : null
    }
  })
  res.json(result)
})

export default router
