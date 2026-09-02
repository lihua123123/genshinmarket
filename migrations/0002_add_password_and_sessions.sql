-- 0002_add_password_and_sessions.sql
-- 用户隔离（安全加固）：
--   users 增加 password_hash（登录密码，PBKDF2 哈希后存储）
--   新增 sessions 表：服务端签发会话令牌，用于识别"当前登录用户"，
--   不再信任客户端自报的 user_id

ALTER TABLE users ADD COLUMN password_hash TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
