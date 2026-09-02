// worker/index.js
// Cloudflare Worker 入口：Hono 处理 /api，静态资源由 wrangler assets 托管（SPA 回退）
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import auth from './routes/auth.js'
import items from './routes/items.js'
import market from './routes/market.js'
import trade from './routes/trade.js'

const app = new Hono()

// CORS（本地开发时前端 5173 → worker 8787 为跨域；生产同源无影响）
app.use('*', cors())

// 全部 API 挂在 /api 下，与前端请求路径一致
app.route('/api/auth', auth)
app.route('/api/items', items)
app.route('/api/market', market)
app.route('/api/trade', trade)

// 健康检查
app.get('/api/health', c => c.json({ ok: true }))

// 全局错误处理
app.onError((err, c) => {
  console.error('[Worker Error]', err)
  return c.json({ error: err.message || '服务器内部错误' }, 500)
})

// 其余路径（非 /api）交给 assets 处理；未命中静态资源时由
// wrangler.toml 的 not_found_handling = single-page-application 回退到 index.html
app.notFound(c => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: '接口不存在' }, 404)
  }
  // 非 /api 交给 assets 绑定托管静态文件/SPA 回退
  return envAssetsFetch(c)
})

// 通过 ASSETS 绑定兜底静态资源（保障 SPA 回退）
async function envAssetsFetch(c) {
  const assets = c.env.ASSETS
  if (assets) {
    const res = await assets.fetch(c.req.raw)
    return res
  }
  return c.json({ error: 'not found' }, 404)
}

export default app
