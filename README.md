# 艾莲的原神道具交易市场

一个用于**原神**（Genshin Impact）玩家间进行道具交换的 Web 应用。采用明亮简洁的卡片式设计，支持道具库存管理、市场挂单、玩家间交易等完整流程。

> 本项目的界面与数据基于用户 "艾莲"（爱恋）的定制需求开发，锁屏密码为：请联系开发者获取
## ✨ 功能特性

- **🔒 锁屏解锁**：输入正确密码进入（提示：网页的创建者是谁？）
- **👤 用户注册 / 多用户切换**：群内名字、游戏内名字、游戏 UID（9-10 位纯数字）注册，支持多账号切换
- **📦 道具库存**：按"类别 → 道具"层级展示，搜索、添加、CSV 批量导入（自动去重合并）、批量操作、标签系统
  - 数量为 0 → 自动标记"寻找"
  - 数量 > 1 → 可手动标记"余货"（余货量 = 数量 - 1）
- **🏪 市场**：三层级展示（类别 → 物品及总余货量 → 玩家列表），仅展示有余货的道具，不能与自己交易
- **🔄 交易流程**：仅限同类别交易、每次限 1 张牌、确认后展示双方 UID、完成后自动扣补数量并重跑标签逻辑
- **🗂 当前交易**：查询进行中/已完成/已取消的交易，可对进行中的交易完成或取消
- **🎨 预留扩展**：已为道具图标与颜色分级预留数据字段与界面空间

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vite + React + TypeScript + React Router |
| 后端 | Express |
| 数据库 | SQLite（Node 内置 `node:sqlite` 模块） |
| 样式 | 原生 CSS（明亮卡片式设计） |

## ✅ 环境要求

- **Node.js ≥ 22.5**（因为使用了 Node 内置的 `node:sqlite` 模块，无需额外安装原生数据库依赖）

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（同时启动前端 5173 和后端 3001）
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001 （`/api` 由 Vite 代理转发）

数据库文件会在首次启动时自动创建于 `server/database.db`（已被 `.gitignore` 忽略）。

## � 生产部署（单服务）

本项目是 **Express + SQLite** 全栈应用，需要**支持 Node.js 与持久化磁盘**的托管平台（如 **Railway / Render / Fly.io / 自建 VPS**）。生产模式下 Express 会同时托管前端静态文件与 `/api` 接口，只需部署**一个服务**即可。

> ⚠️ 注意：本项目**不适用** Cloudflare Workers / Pages 等无服务器边缘平台（无法运行 Express + `node:sqlite`，也没有持久化文件系统）。

```bash
# 构建前端产物（生成 dist/）
npm run build

# 以单服务模式启动（默认端口 3001，部署平台可用环境变量 PORT 覆盖）
npm start
```

部署步骤（以 Railway / Render 为例）：
1. 连接 GitHub 仓库 `lihua123123/genshinmarket`
2. 构建命令：`npm run build`
3. 启动命令：`npm start`
4. 需开启**持久磁盘/卷**（Persistent Disk），用于存放 SQLite 数据库文件
5. 平台会自动注入 `PORT` 环境变量

## �📁 项目结构

```
├── package.json
├── vite.config.ts          # Vite 配置（/api 代理到 3001）
├── index.html
├── server/
│   ├── index.js            # Express 服务器入口
│   ├── database.js         # SQLite 初始化与建表/迁移
│   └── routes/
│       ├── auth.js         # 用户认证
│       ├── items.js        # 道具管理
│       ├── market.js       # 市场
│       └── trade.js        # 交易
└── src/
    ├── main.tsx / App.tsx
    ├── index.css
    ├── types/index.ts      # 类型定义
    ├── context/            # Auth / Toast Context
    ├── data/               # 预设数据（月谕圣牌、材料分类）
    ├── components/         # 通用组件
    ├── pages/              # 页面
    └── utils/              # API 封装、CSV 解析
```

## 📖 使用说明

1. **解锁**：输入密码 请联系开发者获取
2. **注册/登录**：填写注册信息或选择已有账号
3. **管理道具**：在"我的道具"中按类别浏览、添加、CSV 导入
4. **发布余货**：给数量 > 1 的道具标记"余货"，即会在市场中挂出
5. **发起交易**：在市场中找到目标物品和玩家，选择同类别物品完成交换

## 📝 数据模型

- **users**：群内名字、游戏内名字、游戏 UID
- **items**：所属用户、类别、名称、数量、标签、图标、颜色（图标/颜色为预留字段）
- **trades**：发起方、目标方、双方物品、状态（pending/completed/cancelled）

## 📄 License

仅供学习与个人使用。
