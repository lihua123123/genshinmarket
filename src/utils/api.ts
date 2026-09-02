import { Item, MarketCategory, MarketItem, MarketPlayer, ServerFilter, Trade, User } from '../types'

// API 请求封装：统一处理 JSON 序列化、错误抛出
// 安全：所有请求自动附带登录令牌（Authorization: Bearer <token>），
//       服务端据此识别"当前登录用户"，不再信任客户端自报的 user_id。
const BASE = '/api'
const TOKEN_KEY = 'auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { headers, ...options })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || `请求失败 (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  // 锁屏解锁（密码在服务端 Cloudflare Secret 校验，不进前端/仓库）
  unlock: (password: string): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>('/unlock', { method: 'POST', body: JSON.stringify({ password }) }),

  // 认证（注册/登录成功均返回 { token, user }）
  register: (data: {
    group_name: string
    game_name: string
    game_uid: string
    password: string
  }): Promise<{ token: string; user: User }> =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  login: (data: { game_uid: string; password: string }): Promise<{ token: string; user: User }> =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  me: (): Promise<User> => request<User>('/auth/me'),
  logout: (): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  // 获取某用户资料（需登录；用于交易对方展示）
  userProfile: (id: number): Promise<User> => request<User>(`/auth/user/${id}`),

  // 道具
  addItem: (data: { category: string; item_name: string; quantity: number }): Promise<Item> =>
    request<Item>('/items', { method: 'POST', body: JSON.stringify(data) }),
  // 取某用户道具：本人 id 返回完整私有库存；他人 id 只返回其"余货"可交易道具
  getItems: (userId: number): Promise<Item[]> => request<Item[]>(`/items/${userId}`),
  updateItem: (id: number, data: { quantity?: number; tags?: string[] }): Promise<Item> =>
    request<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id: number): Promise<{ success: boolean }> =>
    request<{ success: boolean }>(`/items/${id}`, { method: 'DELETE' }),
  importCsv: (rows: { category: string; item_name: string; quantity: number }[]): Promise<{ added: number }> =>
    request<{ added: number }>('/items/import-csv', {
      method: 'POST',
      body: JSON.stringify({ rows })
    }),

  // 市场（公开：仅展示"余货"；server 支持全部/仅B服/不看B服）
  marketCategories: (server: ServerFilter = 'all'): Promise<MarketCategory[]> =>
    request<MarketCategory[]>(`/market/categories?server=${server}`),
  marketItems: (category: string, server: ServerFilter = 'all'): Promise<MarketItem[]> =>
    request<MarketItem[]>(`/market/items?category=${encodeURIComponent(category)}&server=${server}`),
  marketPlayers: (name: string, server: ServerFilter = 'all'): Promise<MarketPlayer[]> =>
    request<MarketPlayer[]>(`/market/item/${encodeURIComponent(name)}/players?server=${server}`),

  // 交易
  initiateTrade: (data: {
    target_id: number
    initiator_item_id: number
    target_item_id: number
  }): Promise<Trade> => request<Trade>('/trade/initiate', { method: 'POST', body: JSON.stringify(data) }),
  completeTrade: (id: number): Promise<Trade> => request<Trade>(`/trade/${id}/complete`, { method: 'POST' }),
  cancelTrade: (id: number): Promise<Trade> => request<Trade>(`/trade/${id}/cancel`, { method: 'POST' }),
  // 当前登录用户的交易记录
  userTrades: (): Promise<Trade[]> => request<Trade[]>('/trade/mine')
}
