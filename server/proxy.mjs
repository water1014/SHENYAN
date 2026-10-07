/**
 * 可选的本地代理（零依赖，Node 18+ 直接跑）：
 *
 *   npm run proxy
 *
 * 用途：
 * 1. 隐藏 API Key —— 浏览器只跟 127.0.0.1 说话，Key 留在本机环境变量里；
 * 2. 绕开浏览器 CORS —— 有些中转站不允许网页直连。
 *
 * 用法：把设置页里的 API Base 改成 http://127.0.0.1:8787/v1
 * 启动前设置上游地址与 Key（不设也能用，则会转发浏览器带来的 Authorization）：
 *   Windows PowerShell:  $env:UPSTREAM_BASE="https://api.openai.com/v1"; $env:UPSTREAM_KEY="sk-..."; npm run proxy
 *
 * 注意：这是本地开发工具，只绑定 127.0.0.1，不要暴露到公网。
 */

import { createServer } from 'node:http'

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const UPSTREAM_BASE = (process.env.UPSTREAM_BASE || 'https://api.openai.com/v1').replace(/\/+$/, '')
const UPSTREAM_KEY = process.env.UPSTREAM_KEY || ''

const server = createServer(async (req, res) => {
  // 允许本地页面跨域访问
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Expose-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, upstream: UPSTREAM_BASE, mode: 'local-proxy' }))
    return
  }

  if (!req.url?.startsWith('/v1/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: '只代理 /v1/* 路径' } }))
    return
  }

  // 收集请求体
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks)

  const headers = { 'Content-Type': 'application/json' }
  if (UPSTREAM_KEY) {
    headers.Authorization = `Bearer ${UPSTREAM_KEY}`
  } else if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization
  }

  const target = `${UPSTREAM_BASE}${req.url}`
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    })

    // 透传状态码与内容类型（SSE 必须保持 text/event-stream）
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })

    if (!upstream.body) {
      res.end()
      return
    }

    // 边读边写，保证流式不被缓冲
    const reader = upstream.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: { message: `代理到 ${target} 失败：${error?.message || error}` },
      }),
    )
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[proxy] 监听 http://${HOST}:${PORT}`)
  console.log(`[proxy] 上游：${UPSTREAM_BASE}${UPSTREAM_KEY ? '（使用 UPSTREAM_KEY）' : '（透传浏览器 Authorization）'}`)
  console.log(`[proxy] 把应用设置里的 API Base 改成 http://${HOST}:${PORT}/v1`)
})
