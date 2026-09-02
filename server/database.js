// 使用 Node 内置的 node:sqlite 模块（Node 22.5+ 提供），
// 避免 better-sqlite3 在 Node 24 下需要编译原生模块的问题。
import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 设计决策：数据库文件存放在 server/ 目录下，便于管理和清理
const db = new DatabaseSync(path.join(__dirname, 'database.db'))

// 开启 WAL 模式提升并发读写性能
db.exec('PRAGMA journal_mode = WAL;')

// 初始化数据表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL,
    game_name TEXT NOT NULL,
    game_uid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    icon TEXT,
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    initiator_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    initiator_item_id INTEGER,
    target_item_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (initiator_id) REFERENCES users(id),
    FOREIGN KEY (target_id) REFERENCES users(id),
    FOREIGN KEY (initiator_item_id) REFERENCES items(id),
    FOREIGN KEY (target_item_id) REFERENCES items(id)
  );
`)

// 迁移：为 items 表预留 icon / color 列（后续用于道具图标与颜色分级）
const itemColumns = db.prepare('PRAGMA table_info(items)').all().map(c => c.name)
if (!itemColumns.includes('icon')) db.exec('ALTER TABLE items ADD COLUMN icon TEXT')
if (!itemColumns.includes('color')) db.exec('ALTER TABLE items ADD COLUMN color TEXT')

export default db
