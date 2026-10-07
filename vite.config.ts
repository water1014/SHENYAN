import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// 本地优先：默认无后端。若要隐藏 API Key，可运行 `npm run proxy`，
// 然后把设置里的 API Base 指向 http://127.0.0.1:8787/v1

/**
 * 部署路径（base）。
 *
 * - 默认 './'：相对路径。dist/ 可以直接双击打开，也能挂在任意子目录下。
 * - 在 GitHub Pages 上由 CI 传 BASE_PATH 覆盖成绝对路径，例如
 *   BASE_PATH=/my-repo/ —— 这样即使页面 URL 因为 hash 路由变得很怪，
 *   资源也一律从站点根开始解析，不会出现「HTML 拿到了、JS 却 404」的空白页。
 */
const basePath = process.env.BASE_PATH?.trim()

/**
 * Service Worker 的缓存名。
 * 每次构建都不同，SW 在 activate 时会把旧缓存删掉，
 * 避免出现「页面已经是新版、SW 还在喂旧壳」的经典问题。
 */
const swCache = `companion-${Date.now().toString(36)}`

export default defineConfig({
  base: basePath && basePath !== '/' ? (basePath.endsWith('/') ? basePath : `${basePath}/`) : './',
  plugins: [
    react(),
    {
      // public/ 下的文件由 Vite 原样拷贝，不经过 generateBundle，
      // 所以在这里构建结束后直接改写 dist/sw.js 里的缓存版本占位符。
      name: 'inject-sw-cache',
      apply: 'build',
      closeBundle() {
        const file = resolve(__dirname, 'dist/sw.js')
        if (!existsSync(file)) return
        const src = readFileSync(file, 'utf8')
        writeFileSync(file, src.replace(/__SW_CACHE__/g, swCache), 'utf8')
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
})
