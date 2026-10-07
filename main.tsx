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
