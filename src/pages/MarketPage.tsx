import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { MarketCategory, MarketItem } from '../types'
import Card from '../components/Card'
import { useToast } from '../context/ToastContext'

// 市场页面：第一层（类别）与第二层（物品）的层级展示
export default function MarketPage() {
  const [categories, setCategories] = useState<MarketCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [items, setItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    api
      .marketCategories()
      .then(setCategories)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const selectCategory = async (category: string) => {
    setSelectedCategory(category)
    setLoading(true)
    try {
      setItems(await api.marketItems(category))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
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

      {!selectedCategory ? (
        <>
          <h2>道具类别</h2>
          <p className="muted">选择类别查看该类别下的余货物品</p>
          {loading ? (
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
          )}
        </>
      ) : (
        <>
          <h2>{selectedCategory}</h2>
          <p className="muted">该类别下的余货物品</p>
          {loading ? (
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
        </>
      )}
    </div>
  )
}
