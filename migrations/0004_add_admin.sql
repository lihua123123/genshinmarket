-- 0004_add_admin.sql
-- 管理后台：users 表增加 is_admin 标记（1=管理员）
--   仅管理员登录后可见后台：可查看用户账号信息、重置用户密码。
--   重置密码仍为哈希存储，本功能不涉及也不允许查看明文密码。
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
