import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import itemsRouter from './routes/items.js'
import marketRouter from './routes/market.js'
import tradeRouter from './routes/trade.js'

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

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`✅ 服务器已启动: http://localhost:${PORT}`)
})
