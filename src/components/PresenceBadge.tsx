import { presenceInfo } from '../utils/presence'

interface PresenceBadgeProps {
  // 该玩家的最近活跃时间（ISO 字符串，可为 null）
  lastActiveAt: string | null
  // 当前时间戳，由父级统一驱动以便离线分钟数实时变化
  now: number
}

// 玩家在线状态徽标：绿点"在线" / 灰点"离线 X 分钟 / 24h+"
export default function PresenceBadge({ lastActiveAt, now }: PresenceBadgeProps) {
  const { online, text } = presenceInfo(lastActiveAt, now)
  return (
    <div className={`presence ${online ? 'presence-online' : 'presence-offline'}`}>
      <span className="presence-dot" />
      <span>{text}</span>
    </div>
  )
}
