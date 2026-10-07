import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from '@/App'
import '@/index.css'

// 用 HashRouter：Tauri / file:// 或任意静态托管下都能直接跑，不需要服务端重写
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)

/**
 * 注册 Service Worker（离线外壳 + 可安装到主屏）。
 *
 * - 只在生产构建里注册：开发时不注册，否则改代码会被缓存干扰
 * - 路径用 BASE_URL 拼，GitHub Pages 的子路径部署也能命中
 * - 失败只记一行日志，不影响应用本身
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const url = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker.register(url).catch((err) => {
      console.warn('[sw] 注册失败，离线能力不可用：', err)
    })
  })
}
