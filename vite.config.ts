import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 配置：React 插件 + 开发服务器代理
// 本地开发时先运行 `npm run dev:worker`（wrangler dev，端口 8787，含本地 D1），
// 再运行 `npm run dev`（vite，端口 5173），/api 转发到 worker
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
