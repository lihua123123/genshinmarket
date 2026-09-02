-- 0003_add_last_active.sql
-- 在线状态（presence）：
--   users 增加 last_active_at（最近活跃时间，UTC ISO 字符串）。
--   登录用户在浏览市场等操作时通过"心跳"刷新该时间戳，
--   市场玩家列表据此判断对方是否在线、离线多长时间（最多显示 24h+）。

ALTER TABLE users ADD COLUMN last_active_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);
