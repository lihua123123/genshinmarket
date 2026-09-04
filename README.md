# 艾莲的原神道具交易市场

一个用于**原神**（Genshin Impact）玩家间进行道具交换的 Web 应用。采用明亮简洁的卡片式设计，支持道具库存管理、市场挂单、玩家间交易等完整流程。基于 **Cloudflare Workers + D1** 部署。

> 本项目的界面与数据基于用户 "艾莲"（爱恋）的定制需求开发，锁屏密码为：请联系开发者获取

## ✨ 功能特性

- **🔒 锁屏解锁**：输入正确密码进入（提示：网页的创建者是谁？）
- **👤 账号注册 / 密码登录**：群内名字、游戏内名字、游戏 UID（9-10 位纯数字）+ 密码注册；登录需输入游戏 UID + 密码（严格单账号，账号间相互隔离）
- **📦 道具库存**：按"类别 → 道具"层级展示，搜索、添加、CSV 批量导入（自动去重合并）、批量操作、标签系统
  - 数量为 0 → 自动标记"寻找"
  - 数量 > 1 → 可手动标记"余货"（余货量 = 数量 - 1）
- **🏪 市场**：三层级展示（类别 → 物品及总余货量 → 玩家列表），仅展示有余货的道具，不能与自己交易
  - **B 服识别**：游戏 UID 为 9 位且以 5 开头即判定为 B 服玩家，市场玩家列表带「B服」徽标
  - **服务器筛选**：市场各层级顶部可一键切换「全部市场 / 仅看B服 / 不看B服」
  - **在线状态**：市场玩家列表展示每位玩家的在线状态——绿点「在线」或灰点「离线 X 分钟」；离线满 24 小时统一显示「24h+」。登录后前端每分钟自动心跳上报，离开页面/关闭后自然转为离线
- **🔄 交易流程**：仅限同类别交易、每次限 1 张牌、确认后展示双方 UID、完成后自动扣补数量并重跑标签逻辑
- **🗂 当前交易**：查询进行中/已完成/已取消的交易，可对进行中的交易完成或取消
- **🛡 后台管理（管理员）**：管理员账号登录后可查看全部用户账号信息（游戏UID/昵称/群名/服务器/注册时间/最近活跃/在线会话等），并可重置用户密码。密码始终以 PBKDF2 哈希存储，**不支持也无法查看明文密码**
- **🎨 预留扩展**：已为道具图标与颜色分级预留数据字段与界面空间

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vite + React + TypeScript + React Router |
| 后端 | Hono（运行于 Cloudflare Workers） |
| 数据库 | Cloudflare D1（云端 SQLite） |
| 部署 | Wrangler + Workers Static Assets |
| 样式 | 原生 CSS（明亮卡片式设计） |

## 🚀 快速开始（本地开发）

```bash
# 1. 安装依赖
npm install

# 2. 应用本地 D1 迁移（首次需要）
npm run db:migrate:local

# 3. 终端 A：启动 Worker（含本地 D1，端口 8787）
npm run dev:worker

# 4. 终端 B：启动前端（端口 5173，/api 已代理到 8787）
npm run dev
```

- 前端：http://localhost:5173
- Worker/API：http://localhost:8787

## ☁️ 部署到 Cloudflare（D1）

### 1. 创建 D1 数据库

```bash
npx wrangler d1 create genshinmarket-db
```

把输出中的 **database_id** 填入 `wrangler.toml` 的 `[[d1_databases]]` 占位符（`REPLACE_WITH_YOUR_D1_DATABASE_ID`）。

### 2. 应用迁移（建表）

```bash
npm run db:migrate   # 应用到远程 D1
```

### 3. 构建并部署

```bash
npm run deploy       # = vite build && wrangler deploy
```

部署后：
- 前端静态资源由 Workers Static Assets 托管
- `/api/*` 由 Worker（Hono）处理，读写 D1
- SPA 路由（如 `/trades`）自动回退到 `index.html`

> ⚠️ 本项目早期采用 Express + `node:sqlite`，无法运行于 Cloudflare 无服务器环境，现已迁移到 **Hono + Cloudflare D1**。

## 🛡 后台管理（管理员）

后台只对 `users.is_admin = 1` 的账号开放（导航栏会出现「后台管理」）。

### 启用第一个管理员

应用迁移 `0004_add_admin.sql` 后，用 `wrangler` 把某个已注册账号标记为管理员（把 `<你的游戏UID>` 换成你自己的游戏UID）：

```bash
# 本地开发库
npx wrangler d1 execute genshinmarket-db --local --command "UPDATE users SET is_admin = 1 WHERE game_uid = '<你的游戏UID>';"

# 线上库
npx wrangler d1 execute genshinmarket-db --remote --command "UPDATE users SET is_admin = 1 WHERE game_uid = '<你的游戏UID>';"
```

之后用该账号登录，导航栏即可看到「后台管理」。

### 部署步骤

```bash
npm run db:migrate:local   # 本地：应用 0004 迁移
npm run db:migrate         # 线上：应用 0004 迁移
# 代码改动需 git commit && git push，GitHub Cloudflare 集成会自动部署
```

> ⚠️ **安全提示**：后台能查看/重置所有用户账号。请确保仅把 `is_admin` 授给你信任的账号；不要轻信任何能登录后台的账号。密码均为哈希存储，无法查看明文——这是有意设计，请勿改为明文存储。

## � 解锁密码（服务端密钥，不入仓库）

锁屏密码**保存在 Cloudflare Secret 中**，不进入代码仓库或前端包，避免被爬取。

### 生产环境（设置一次）

```bash
npx wrangler secret put LOCK_PASSWORD
# 按提示粘贴你的真实解锁密码
```

### 本地开发

复制模板并填入真实密码（`.dev.vars` 已被 `.gitignore` 忽略，不会提交）：

```bash
cp .dev.vars.example .dev.vars   # 然后编辑 .dev.vars 填入 LOCK_PASSWORD
```

`/api/unlock` 接口会用该密钥校验用户输入的密码。

## �📁 项目结构

```
├── package.json
├── wrangler.toml          # Worker/D1/静态资源配置
├── vite.config.ts         # Vite 配置（/api 代理到 8787）
├── migrations/
│   └── 0001_init.sql      # D1 表结构迁移
├── worker/                # Cloudflare Worker 后端（Hono + D1）
│   ├── index.js           # Worker 入口，挂载 /api 路由
│   ├── db.js              # D1 异步数据访问辅助
│   ├── util.js            # 标签工具
│   └── routes/
│       ├── auth.js        # 用户认证
│       ├── items.js       # 道具管理
│       ├── market.js      # 市场
│       └── trade.js       # 交易
├── index.html
└── src/                   # React 前端
    ├── main.tsx / App.tsx
    ├── index.css
    ├── types/index.ts     # 类型定义
    ├── context/           # Auth / Toast Context
    ├── data/              # 预设数据（月谕圣牌、材料分类）
    ├── components/        # 通用组件
    ├── pages/             # 页面
    └── utils/             # API 封装、CSV 解析
```

## 📖 使用说明

1. **解锁**：输入密码（请联系开发者获取）
2. **注册/登录**：注册需设置密码；登录时输入「游戏 UID + 密码」
3. **管理道具**：在"我的道具"中按类别浏览、添加、CSV 导入
4. **发布余货**：给数量 > 1 的道具标记"余货"，即会在市场中挂出
5. **发起交易**：在市场中找到目标物品和玩家，选择同类别物品完成交换

## 📝 数据模型（D1）

- **users**：群内名字、游戏内名字、游戏 UID、password_hash（PBKDF2 哈希，不入前端）、last_active_at（最近活跃时间，用于市场在线状态）
- **sessions**：登录会话令牌（服务端识别"当前登录用户"，账号隔离的关键）
- **items**：所属用户、类别、名称、数量、标签、图标、颜色（图标/颜色为预留字段）
- **trades**：发起方、目标方、双方物品、状态（pending/completed/cancelled）

## 📄 License

仅供学习与个人使用。
