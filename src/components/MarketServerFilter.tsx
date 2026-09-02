import { useMarketServer, SERVER_FILTER_OPTIONS } from '../context/MarketServerContext'

// 市场服务器筛选控件：一键切换 全部市场 / 仅看B服 / 不看B服
export default function MarketServerFilter() {
  const { filter, setFilter } = useMarketServer()

  return (
    <div className="server-filter">
      <span className="server-filter-label">服务器</span>
      <div className="server-filter-tabs">
        {SERVER_FILTER_OPTIONS.map(o => (
          <button
            key={o.value}
            className={`filter-tab server-filter-tab ${filter === o.value ? 'active' : ''}`}
            onClick={() => setFilter(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
