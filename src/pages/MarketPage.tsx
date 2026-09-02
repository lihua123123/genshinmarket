import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { MarketCategory, MarketItem, ServerFilter } from '../types'
import Card from '../components/Card'
import MarketServerFilter from '../components/MarketServerFilter'
import { useMarketServer } from '../context/MarketServerContext'
import { useToast } from '../context/ToastContext'

// 市场页面：第一层（类别）与第二层（物品）的层级展示
// 支持按服务器（全部/仅B服/不看B服）过滤，筛选后重新拉取对应层级数据
export default function MarketPage() {
  const [categories, setCategories] = useState<MarketCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [items, setItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const toast = useToast()
  const { filter } = useMarketServer()

  const load = useCallback(
    async (cat: string | null, server: ServerFilter) => {
      setLoading(true)
      try {
        if (!cat) {
          setCategories(await api.marketCategories(server))
        } else {
          setItems(await api.marketItems(cat, server))
        }
      } catch (e: any) {
        toast.error(e.message)
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  // 首次加载 / 筛选变化时按当前层级重新拉取
  useEffect(() => {
    load(selectedCategory, filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const selectCategory = async (category: string) => {
    setSelectedCategory(category)
    await load(category, filter)
  }

  return (
    <div className="page">
      <div className="breadcrumb">
        <span
          className={`crumb ${!selectedCategory ? 'active' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          市场
        </span>
        {selectedCategory && (
          <>
            <span className="crumb-sep">/</span>
            <span className="crumb active">{selectedCategory}</span>
          </>
        )}
      </div>

      <div className="page-header-row">
        <h2>{!selectedCategory ? '道具类别' : selectedCategory}</h2>
        <MarketServerFilter />
      </div>
      <p className="muted">
        {!selectedCategory ? '选择类别查看该类别下的余货物品' : '该类别下的余货物品'}
        {filter !== 'all' && (
          <span className="filter-hint">
            {filter === 'b' ? ' · 已只显示 B 服市场' : ' · 已隐藏 B 服市场'}
          </span>
        )}
      </p>

      {!selectedCategory ? (
        loading ? (
          <div className="loading">加载中...</div>
        ) : categories.length === 0 ? (
          <div className="empty">市场暂无余货道具，先去"我的道具"标记余货吧</div>
        ) : (
          <div className="card-grid">
            {categories.map(c => (
              <Card key={c.category} onClick={() => selectCategory(c.category)} className="category-card">
                <h3>{c.category}</h3>
                <p className="muted">总余货 {c.total}</p>
                <span className="card-arrow">→</span>
              </Card>
            ))}
          </div>
        )
      ) : loading ? (
        <div className="loading">加载中...</div>
      ) : items.length === 0 ? (
        <div className="empty">该类别下暂无余货物品</div>
      ) : (
        <div className="card-grid">
          {items.map(it => (
            <Card
              key={it.item_name}
              onClick={() => navigate(`/market/item/${encodeURIComponent(it.item_name)}`)}
            >
              <h3>{it.item_name}</h3>
              <p className="muted">总余货量 {it.total}</p>
              <span className="card-arrow">→</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
