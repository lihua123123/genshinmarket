// 全局 TypeScript 类型定义

// 用户
export interface User {
  id: number
  group_name: string
  game_name: string
  game_uid: string
  created_at: string
}

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
  quantity: number
  tags: Tag[]
}
