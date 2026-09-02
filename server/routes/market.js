import { Router } from 'express'
import db from '../database.js'

const router = Router()

// 判断物品是否带"余货"标签（市场只展示余货）
function hasYuHuo(item) {
  try {
    return JSON.parse(item.tags || '[]').includes('余货')
  } catch {
    return false
  }
}

// 余货量 = 数量 - 1（保留 1 张自用，多余的部分才是余货）
function yuHuoAmount(item) {
  return Math.max(0, item.quantity - 1)
}

// 第一层：获取所有"余货"类别及其总余货量
router.get('/categories', (req, res) => {
  const items = db.prepare('SELECT * FROM items').all().filter(hasYuHuo)
  const categoryMap = new Map()
  for (const it of items) {
    categoryMap.set(it.category, (categoryMap.get(it.category) || 0) + yuHuoAmount(it))
  }
  res.json(Array.from(categoryMap, ([category, total]) => ({ category, total })))
})

// 第二层：获取某类别下的物品及其总余货量
router.get('/items', (req, res) => {
  const category = req.query.category
  if (!category) return res.status(400).json({ error: '缺少类别参数' })
  const items = db
    .prepare('SELECT * FROM items WHERE category = ?')
    .all(category)
    .filter(hasYuHuo)
  const map = new Map()
  for (const it of items) {
    map.set(it.item_name, (map.get(it.item_name) || 0) + yuHuoAmount(it))
  }
  res.json(Array.from(map, ([item_name, total]) => ({ item_name, total })))
})

// 第三层：获取拥有某物品"余货"的玩家列表
router.get('/item/:name/players', (req, res) => {
  const name = req.params.name
  const items = db.prepare('SELECT * FROM items WHERE item_name = ?').all(name).filter(hasYuHuo)
  const players = items.map(it => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(it.user_id)
    return {
      item_id: it.id,
      user_id: it.user_id,
      game_name: user ? user.game_name : '未知',
      group_name: user ? user.group_name : '',
      quantity: yuHuoAmount(it),
      tags: JSON.parse(it.tags || '[]')
    }
  })
  res.json(players)
})

export default router
