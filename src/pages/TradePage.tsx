import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../utils/api'
import { Item, User, Trade, TradeStatus, WantedItem } from '../types'
import Tag from '../components/Tag'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'

const STATUS_TEXT: Record<TradeStatus, string> = {
  pending: '进行中',
  completed: '已完成',
  cancelled: '已取消'
}

// B服判断：游戏 UID 为 9 位且以 5 开头（与后端 worker/util.js isBServer 一致）
function isB(uid?: string | null): boolean {
  return /^5\d{8}$/.test(String(uid || ''))
}

// 交易流程页面：
// 1. 选择双方物品（各限 1 张牌）
// 2. 确认交易后展示双方 UID，状态变为 pending
// 3. 完成交易后自动扣补物品数量并重新执行标签逻辑
export default function TradePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const toast = useToast()

  const targetId = Number(params.get('targetId'))
  const itemName = params.get('itemName') || ''
  const suggestedItemId = Number(params.get('itemId'))

  const [target, setTarget] = useState<User | null>(null)
  const [myItems, setMyItems] = useState<Item[]>([])
  const [targetItems, setTargetItems] = useState<Item[]>([])
  // 对方"寻找"中的牌（用于绿色高亮：我方有对方正需要的牌）
  const [targetWanted, setTargetWanted] = useState<WantedItem[]>([])
  const [mySelected, setMySelected] = useState<Item | null>(null)
  const [targetSelected, setTargetSelected] = useState<Item | null>(null)
  const [showUid, setShowUid] = useState(false)
  const [trade, setTrade] = useState<Trade | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    ;(async () => {
      try {
        const [u, my, tgt, wanted] = await Promise.all([
          api.userProfile(targetId),
          api.getItems(currentUser.id),
          api.getItems(targetId),
          api.wantedItems(targetId)
        ])
        setTarget(u)
        setMyItems(my)
        setTargetItems(tgt)
        setTargetWanted(wanted)
        // 默认选中市场建议的物品（对方提供的物品）
        if (suggestedItemId) {
          const sug = tgt.find(i => i.id === suggestedItemId)
          if (sug) setTargetSelected(sug)
        }
      } catch (e: any) {
        toast.error(e.message)
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirmInitiate = async () => {
    setConfirmOpen(false)
    if (!mySelected || !targetSelected) {
      toast.error('请选择双方交易的物品')
      return
    }
    if (mySelected.category !== targetSelected.category) {
      toast.error('仅支持同类别交易')
      return
    }
    try {
      const t = await api.initiateTrade({
        target_id: targetId,
        initiator_item_id: mySelected.id,
        target_item_id: targetSelected.id
      })
      setTrade(t)
      setShowUid(true)
      toast.success('交易已发起，请在游戏内完成交易')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const complete = async () => {
    setCompleteOpen(false)
    if (!trade) return
    try {
      await api.completeTrade(trade.id)
      toast.success('交易已完成，物品数量已自动更新')
      setTrade({ ...trade, status: 'completed', completed_at: new Date().toISOString() })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const cancel = async () => {
    setCancelOpen(false)
    if (!trade) return
    try {
      await api.cancelTrade(trade.id)
      toast.success('交易已取消')
      setTrade({ ...trade, status: 'cancelled' })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (loading) return <div className="page"><div className="loading">加载中...</div></div>
  if (!target || !currentUser) return <div className="page"><div className="empty">数据加载失败</div></div>

  // 防御性校验：不能与自己交易
  if (target.id === currentUser.id) {
    return (
      <div className="page">
        <div className="empty">
          ⚠️ 不能与自己交易
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate('/market')}>
              返回市场
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 防御性校验：不同服务器（B服/官方）之间无法交易
  const myB = isB(currentUser.game_uid)
  if (myB !== isB(target.game_uid)) {
    return (
      <div className="page">
        <div className="empty">
          ⚠️ 不同服务器无法交易（{myB ? 'B服' : '官方'} 与 {isB(target.game_uid) ? 'B服' : '官方'} 无法互相交易）
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => navigate('/market')}>
              返回市场
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 交易仅限同类别：根据已选物品确定类别，双方面板只展示同类别道具
  const activeCategory = mySelected?.category || targetSelected?.category || null
  const mySameCat = activeCategory ? myItems.filter(i => i.category === activeCategory) : myItems
  const targetSameCat = activeCategory
    ? targetItems.filter(i => i.category === activeCategory)
    : targetItems

  // 对方"寻找"的牌集合（key = category::name），我方命中则绿光提示
  const wantedKeys = new Set(targetWanted.map(w => `${w.category}::${w.item_name}`))

  const renderItemList = (
    list: Item[],
    selected: Item | null,
    onSelect: (i: Item) => void,
    matchWanted: boolean
  ) => (
    <div className="trade-item-list">
      {list.map(item => {
        const isWantedMatch = matchWanted && wantedKeys.has(`${item.category}::${item.item_name}`)
        return (
          <div
            key={item.id}
            className={`trade-item ${selected?.id === item.id ? 'selected' : ''} ${
              isWantedMatch ? 'wanted-match' : ''
            }`}
            onClick={() => onSelect(item)}
          >
            <div className="trade-item-name">
              {item.item_name}
              <div className="trade-item-sub">
                {item.category} · {item.quantity}
              </div>
            </div>
            <div className="trade-item-tags">
              {isWantedMatch && <span className="wanted-hint">对方需要</span>}
              {item.tags.map(t => (
                <Tag key={t} label={t} />
              ))}
            </div>
          </div>
        )
      })}
      {list.length === 0 && <div className="muted">暂无道具</div>}
    </div>
  )

  return (
    <div className="page">
      <div className="breadcrumb">
        <span className="crumb" onClick={() => navigate('/trades')}>
          当前交易
        </span>
        <span className="crumb-sep">/</span>
        <span className="crumb" onClick={() => navigate('/market')}>
          市场
        </span>
        <span className="crumb-sep">/</span>
        <span className="crumb" onClick={() => navigate(`/market/item/${encodeURIComponent(itemName)}`)}>
          {itemName || '物品'}
        </span>
        <span className="crumb-sep">/</span>
        <span className="crumb active">交易</span>
      </div>

      <h2>交易 {itemName ? `· ${itemName}` : ''}</h2>

      {/* 双方信息 */}
      <div className="trade-parties">
        <div className="party-card">
          <div className="party-role">发起方（我）</div>
          <div className="party-name">{currentUser.game_name}</div>
          <div className="muted">{currentUser.group_name}</div>
          {showUid && <div className="uid-text">UID: {currentUser.game_uid}</div>}
        </div>
        <div className="party-vs">⇄</div>
        <div className="party-card">
          <div className="party-role">对方</div>
          <div className="party-name">{target.game_name}</div>
          <div className="muted">{target.group_name}</div>
          {showUid && <div className="uid-text">UID: {target.game_uid}</div>}
        </div>
      </div>

      {/* 交易状态提示 */}
      {trade && (
        <div className={`trade-status status-${trade.status}`}>
          交易状态：{STATUS_TEXT[trade.status]}
        </div>
      )}

      {!trade ? (
        <>
          <div className="trade-layout">
            <div className="trade-panel">
              <h3>我提供的物品（选 1 张）</h3>
              <p className="muted">
                {activeCategory ? `仅限同类别「${activeCategory}」` : '从你的道具中选择要给出的 1 张牌'}
                {mySameCat.some(i => wantedKeys.has(`${i.category}::${i.item_name}`)) && (
                  <span className="wanted-legend"> · 🟢 绿光=对方正在寻找</span>
                )}
              </p>
              {renderItemList(mySameCat, mySelected, i => setMySelected(i), true)}
            </div>
            <div className="trade-panel">
              <h3>对方提供的物品（选 1 张）</h3>
              <p className="muted">
                {activeCategory ? `仅限同类别「${activeCategory}」` : '选择对方要给你的 1 张牌'}
              </p>
              {renderItemList(targetSameCat, targetSelected, i => setTargetSelected(i), false)}
            </div>
          </div>
          <div className="trade-confirm-row">
            <p className="muted">仅支持同类别交易 · 每次限 1 张牌</p>
            <button className="btn btn-primary" onClick={() => setConfirmOpen(true)}>
              确认交易
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="trade-summary">
            <div className="summary-row">
              <span>我付出：</span>
              <strong>{mySelected?.item_name ?? '—'}</strong>
            </div>
            <div className="summary-row">
              <span>我获得：</span>
              <strong>{targetSelected?.item_name ?? '—'}</strong>
            </div>
            {trade.status === 'pending' && (
              <p className="muted">
                已在游戏内完成交易后，点击"完成交易"自动扣除和补齐物品数量。
              </p>
            )}
          </div>

          {trade.status === 'pending' && (
            <div className="trade-confirm-row">
              <button className="btn btn-danger" onClick={() => setCancelOpen(true)}>
                取消交易
              </button>
              <button className="btn btn-primary" onClick={() => setCompleteOpen(true)}>
                完成交易
              </button>
            </div>
          )}
          {trade.status === 'completed' && (
            <div className="trade-confirm-row">
              <button className="btn btn-primary" onClick={() => navigate('/market')}>
                返回市场
              </button>
            </div>
          )}
        </>
      )}

      {/* 确认交易对话框 */}
      <ConfirmDialog
        open={confirmOpen}
        message={`确认发起交易？确认后将展示双方游戏UID，且双方之间交易通道关闭。`}
        onConfirm={confirmInitiate}
        onCancel={() => setConfirmOpen(false)}
        confirmText="确认交易"
      />
      {/* 完成交易对话框 */}
      <ConfirmDialog
        open={completeOpen}
        message={`确认已完成游戏内交易？完成后将自动扣除/补齐物品数量并关闭交易通道。`}
        onConfirm={complete}
        onCancel={() => setCompleteOpen(false)}
        confirmText="确认完成"
      />
      {/* 取消交易对话框 */}
      <ConfirmDialog
        open={cancelOpen}
        message="确定取消这笔交易吗？"
        onConfirm={cancel}
        onCancel={() => setCancelOpen(false)}
        confirmText="取消交易"
      />
    </div>
  )
}
