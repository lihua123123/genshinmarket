import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { ServerFilter } from '../types'

// 市场"服务器"筛选：全部市场 / 仅B服 / 不看B服
// 通过 localStorage 持久化，跨市场各分级页面共享同一筛选状态。
const STORAGE_KEY = 'market_server_filter'

export const SERVER_FILTER_OPTIONS: { value: ServerFilter; label: string }[] = [
  { value: 'all', label: '全部市场' },
  { value: 'b', label: '仅看B服' },
  { value: 'nonb', label: '不看B服' }
]

function readStored(): ServerFilter {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'b' || v === 'nonb' ? v : 'all'
}

interface MarketServerContextValue {
  filter: ServerFilter
  setFilter: (f: ServerFilter) => void
}

const MarketServerContext = createContext<MarketServerContextValue | null>(null)

export function MarketServerProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<ServerFilter>(readStored)

  const setFilter = useCallback((f: ServerFilter) => {
    localStorage.setItem(STORAGE_KEY, f)
    setFilterState(f)
  }, [])

  return (
    <MarketServerContext.Provider value={{ filter, setFilter }}>
      {children}
    </MarketServerContext.Provider>
  )
}

export function useMarketServer() {
  const ctx = useContext(MarketServerContext)
  if (!ctx) throw new Error('useMarketServer must be used within MarketServerProvider')
  return ctx
}
