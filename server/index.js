import express from 'express'
import cors from 'cors'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import authRouter from './routes/auth.js'
import itemsRouter from './routes/items.js'
import marketRouter from './routes/market.js'
import tradeRouter from './routes/trade.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json({ limit: '5mb' }))

app.use('/api/auth', authRouter)
app.use('/api/items', itemsRouter)
app.use('/api/market', marketRouter)
app.use('/api/trade', tradeRouter)

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('[Server Error]', err)
  res.status(500).json({ error: err.message || '服务器内部错误' })
})

// 生产环境：单服务部署，Express 同时托管前端静态文件（dist）与 /api 接口
const distPath = path.join(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  // SPA 回退：非 /api 的 GET 请求都返回 index.html，由前端路由处理
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log('📦 已托管前端静态文件: ' + distPath)
}

// 部署平台（Railway/Render 等）通过环境变量 PORT 指定端口
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`✅ 服务器已启动: http://localhost:${PORT}`)
})
