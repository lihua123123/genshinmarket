import { Item, MarketCategory, MarketItem, MarketPlayer, Trade, User } from '../types'

// API 请求封装：统一处理 JSON 序列化、错误抛出
const BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || `请求失败 (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  // 认证
  register: (data: { group_name: string; game_name: string; game_uid: string }): Promise<User> =>
    request<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  current: (id: number): Promise<User> => request<User>(`/auth/current?id=${id}`),
  allUsers: (): Promise<User[]> => request<User[]>('/auth/users'),

  // 道具
  addItem: (data: { user_id: number; category: string; item_name: string; quantity: number }): Promise<Item> =>
    request<Item>('/items', { method: 'POST', body: JSON.stringify(data) }),
  getItems: (userId: number): Promise<Item[]> => request<Item[]>(`/items/${userId}`),
  updateItem: (id: number, data: { quantity?: number; tags?: string[] }): Promise<Item> =>
    request<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id: number): Promise<{ success: boolean }> =>
    request<{ success: boolean }>(`/items/${id}`, { method: 'DELETE' }),
  importCsv: (
    userId: number,
    rows: { category: string; item_name: string; quantity: number }[]
  ): Promise<{ added: number }> =>
    request<{ added: number }>('/items/import-csv', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, rows })
    }),

  // 市场
  marketCategories: (): Promise<MarketCategory[]> => request<MarketCategory[]>('/market/categories'),
  marketItems: (category: string): Promise<MarketItem[]> =>
    request<MarketItem[]>(`/market/items?category=${encodeURIComponent(category)}`),
  marketPlayers: (name: string): Promise<MarketPlayer[]> =>
    request<MarketPlayer[]>(`/market/item/${encodeURIComponent(name)}/players`),

  // 交易
  initiateTrade: (data: {
    initiator_id: number
    target_id: number
    initiator_item_id: number
    target_item_id: number
  }): Promise<Trade> => request<Trade>('/trade/initiate', { method: 'POST', body: JSON.stringify(data) }),
  completeTrade: (id: number): Promise<Trade> => request<Trade>(`/trade/${id}/complete`, { method: 'POST' }),
  cancelTrade: (id: number): Promise<Trade> => request<Trade>(`/trade/${id}/cancel`, { method: 'POST' }),
  userTrades: (userId: number): Promise<Trade[]> => request<Trade[]>(`/trade/user/${userId}`)
}
