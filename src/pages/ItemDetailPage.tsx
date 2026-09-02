import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { MarketPlayer } from '../types'
import Card from '../components/Card'
import MarketServerFilter from '../components/MarketServerFilter'
import PresenceBadge from '../components/PresenceBadge'
import { useMarketServer } from '../context/MarketServerContext'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

// 物品详情页面（市场第三层）：展示拥有该物品"余货"的玩家列表
export default function ItemDetailPage() {
  const { itemName } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { filter } = useMarketServer()
  const [players, setPlayers] = useState<MarketPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  // 每 30 秒刷新一次“当前时间”，让离线的分钟数随时间推进实时更新
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const decoded = itemName ? decodeURIComponent(itemName) : ''

  useEffect(() => {
    if (!decoded) return
    setLoading(true)
    api
      .marketPlayers(decoded, filter)
      .then(setPlayers)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded, filter])

  // 无法与自己交易：把当前用户自己挂出的余货单独展示（不提供交易按钮）
  const mine = players.filter(p => currentUser && p.user_id === currentUser.id)
  const others = players.filter(p => !currentUser || p.user_id !== currentUser.id)

  return (
    <div className="page">
      <div className="breadcrumb">
        <span className="crumb" onClick={() => navigate('/market')}>
          市场
        </span>
        <span className="crumb-sep">/</span>
        <span className="crumb active">{decoded}</span>
      </div>

      <div className="page-header-row">
        <h2>{decoded}</h2>
        <MarketServerFilter />
      </div>
      <p className="muted">
        拥有该物品"余货"的玩家列表（不能与自己交易）
        {filter !== 'all' && (
          <span className="filter-hint">
            {filter === 'b' ? ' · 已只显示 B 服市场' : ' · 已隐藏 B 服市场'}
          </span>
        )}
      </p>

      {mine.length > 0 && (
        <div className="mine-note">
          🫵 你自己挂出了 {mine.length} 条余货，不能与自己交易
        </div>
      )}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : others.length === 0 ? (
        <div className="empty">没有可交易的其他玩家（暂无人拥有该物品的余货）</div>
      ) : (
        <div className="card-grid">
          {others.map(p => (
            <Card key={p.item_id}>
              <h3 className="player-title">
                {p.game_name}
                {p.is_b && <span className="b-badge">B服</span>}
              </h3>
              <PresenceBadge lastActiveAt={p.last_active_at ?? null} now={now} />
              <p className="muted">{p.group_name}</p>
              <div className="item-qty">
                余货：<strong>{p.quantity}</strong>
              </div>
              <button
                className="btn btn-primary btn-block"
                onClick={() =>
                  navigate(
                    `/trade?itemName=${encodeURIComponent(decoded)}&targetId=${p.user_id}&itemId=${p.item_id}`
                  )
                }
              >
                发起交易
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
