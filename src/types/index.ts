// 全局 TypeScript 类型定义

// 用户
export interface User {
  id: number
  group_name: string
  game_name: string
  game_uid: string
  created_at: string
  // 管理员标记（1=管理员），仅管理员账号为 1，普通用户为 0
  is_admin?: number
}

// 后台管理：用户账号信息（供管理员查看；不含 password_hash）
export interface AdminUser {
  id: number
  group_name: string
  game_name: string
  game_uid: string
  created_at: string
  last_active_at: string | null
  is_admin: number
  has_password: number
  active_sessions: number
}

// 交易辅助：某用户"寻找"中的道具（只含类别与名称）
export interface WantedItem {
  category: string
  item_name: string
}

// 市场服务器筛选：all 全部 | b 仅B服 | nonb 不看B服
export type ServerFilter = 'all' | 'b' | 'nonb'

// 道具标签（"寻找"为自动标签，"余货"为手动标签）
export type Tag = '寻找' | '余货' | string

// 道具
export interface Item {
  id: number
  user_id: number
  category: string
  item_name: string
  quantity: number
  tags: Tag[]
  created_at: string
  updated_at: string
  // 预留字段：道具图标（图片URL/emoji）与颜色分级（CSS 颜色值或等级标识），后续补充
  icon?: string | null
  color?: string | null
}

// 交易状态
export type TradeStatus = 'pending' | 'completed' | 'cancelled'

// 交易
export interface Trade {
  id: number
  initiator_id: number
  target_id: number
  initiator_item_id: number | null
  target_item_id: number | null
  status: TradeStatus
  created_at: string
  completed_at: string | null
  // 以下为后端 enrich 后的附加字段
  initiator?: User | null
  target?: User | null
  initiator_item?: Item | null
  target_item?: Item | null
}

// 市场层级
export interface MarketCategory {
  category: string
  total: number
}

export interface MarketItem {
  item_name: string
  total: number
}

export interface MarketPlayer {
  item_id: number
  user_id: number
  game_name: string
  group_name: string
  is_b?: boolean
  quantity: number
  tags: Tag[]
  // 该玩家的最近活跃时间（ISO 字符串），用于判断在线状态/离线时长
  last_active_at?: string | null
}
