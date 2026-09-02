// worker/util.js
// 标签处理工具（沿用原业务逻辑）

// 解析 tags JSON 字段
export function parseTags(tags) {
  try {
    return JSON.parse(tags || '[]')
  } catch {
    return []
  }
}

// 标签规则：
//   - 数量为 0 的道具自动打上"寻找"标签
//   - "余货"标签由用户手动添加（数量 > 1 时）
export function normalizeTags(tags, quantity) {
  const set = new Set(tags || [])
  if (quantity <= 0) set.add('寻找')
  return Array.from(set)
}

// 是否 B 服玩家：游戏 UID 为 9 位且以 5 开头（Bilibili 服）
export function isBServer(game_uid) {
  return /^5\d{8}$/.test(String(game_uid || ''))
}
