import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import { Trade, TradeStatus } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'

const STATUS_TEXT: Record<TradeStatus, string> = {
  pending: '进行中',
  completed: '已完成',
  cancelled: '已取消'
}

type Filter = 'all' | TradeStatus

// 当前交易页面：查询进行中的交易与历史交易记录，并可完成/取消进行中的交易
export default function TradeHistoryPage() {
  const { currentUser } = useAuth()
  const toast = useToast()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [completeId, setCompleteId] = useState<number | null>(null)
  const [cancelId, setCancelId] = useState<number | null>(null)

  const load = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      setTrades(await api.userTrades(currentUser.id))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setFilter('all')
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  if (!currentUser) return null

  const filtered = filter === 'all' ? trades : trades.filter(t => t.status === filter)

  const doComplete = async () => {
    if (!completeId) return
    setCompleteId(null)
    try {
      await api.completeTrade(completeId)
      toast.success('交易已完成')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const doCancel = async () => {
    if (!cancelId) return
    setCancelId(null)
    try {
      await api.cancelTrade(cancelId)
      toast.success('交易已取消')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const renderTrade = (t: Trade) => {
    const isInitiator = t.initiator_id === currentUser.id
    const other = isInitiator ? t.target : t.initiator
    // 以当前用户视角显示"我付出/我获得"
    const myGive = isInitiator ? t.initiator_item : t.target_item
    const myGet = isInitiator ? t.target_item : t.initiator_item
    return (
      <div className="trade-history-card" key={t.id}>
        <div className="trade-history-top">
          <span className={`trade-status status-${t.status}`}>{STATUS_TEXT[t.status]}</span>
          <span className="muted">{new Date(t.created_at).toLocaleString()}</span>
        </div>
        <div className="trade-history-body">
          <div className="history-other">
            <span className="muted">对方：</span>
            <strong>{other?.game_name ?? '未知'}</strong>
            <span className="muted">（{other?.group_name ?? ''}）</span>
            {other && (t.status === 'completed' || t.status === 'pending') && (
              <span className="uid-text-sm">UID: {other.game_uid}</span>
            )}
          </div>
          <div className="summary-row">
            <span>我付出：</span>
            <strong>{myGive?.item_name ?? '—'}</strong>
            <span className="muted">（{myGive?.category}）</span>
          </div>
          <div className="summary-row">
            <span>我获得：</span>
            <strong>{myGet?.item_name ?? '—'}</strong>
            <span className="muted">（{myGet?.category}）</span>
          </div>
        </div>
        {t.status === 'pending' && (
          <div className="trade-history-actions">
            <button className="btn btn-danger btn-small" onClick={() => setCancelId(t.id)}>
              取消交易
            </button>
            <button className="btn btn-primary btn-small" onClick={() => setCompleteId(t.id)}>
              完成交易
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="breadcrumb">
        <span className="crumb active">当前交易</span>
      </div>
      <h2>当前交易</h2>
      <p className="muted">查看进行中的交易与历史交易记录</p>

      <div className="filter-tabs">
        {(['all', 'pending', 'completed', 'cancelled'] as Filter[]).map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '全部' : STATUS_TEXT[f]}
            <span className="filter-count">
              {f === 'all' ? trades.length : trades.filter(t => t.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          {trades.length === 0 ? '暂无交易记录，去市场发起一笔交易吧' : '该分类下暂无交易'}
        </div>
      ) : (
        <div className="trade-history-list">{filtered.map(renderTrade)}</div>
      )}

      <ConfirmDialog
        open={completeId !== null}
        message="确认已完成游戏内交易？完成后将自动扣除/补齐物品数量并关闭交易通道。"
        onConfirm={doComplete}
        onCancel={() => setCompleteId(null)}
        confirmText="确认完成"
      />
      <ConfirmDialog
        open={cancelId !== null}
        message="确定取消这笔交易吗？"
        onConfirm={doCancel}
        onCancel={() => setCancelId(null)}
        confirmText="取消交易"
      />
    </div>
  )
}
