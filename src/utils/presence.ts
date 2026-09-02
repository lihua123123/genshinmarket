// 在线状态展示工具
// 在线判定：最近活跃时间在 ONLINE_WINDOW_MS 内视为"在线"；
// 离线则显示离线分钟数，达到/超过 24 小时统一显示 "24h+"

// 超过该时长视为离线（约等于心跳间隔的倍数，容忍短暂断连）
export const ONLINE_WINDOW_MS = 3 * 60 * 1000 // 3 分钟
const DAY_MS = 24 * 60 * 60 * 1000 // 24 小时

export interface PresenceInfo {
  online: boolean
  text: string
}

export function presenceInfo(lastActiveAt: string | null, now: number = Date.now()): PresenceInfo {
  // 从未有过活跃记录：视为长期离线
  if (!lastActiveAt) return { online: false, text: '离线 24h+' }

  const t = new Date(lastActiveAt).getTime()
  const elapsed = now - t

  // 未来时间戳（客户端时钟偏差）按在线处理
  if (elapsed < ONLINE_WINDOW_MS) return { online: true, text: '在线' }

  if (elapsed >= DAY_MS) return { online: false, text: '离线 24h+' }

  const minutes = Math.max(1, Math.floor(elapsed / 60000))
  return { online: false, text: `离线 ${minutes} 分钟` }
}
