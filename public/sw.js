/* Service Worker —— 离线外壳
 *
 * 思路参考 Tidal_Echo（AGPL-3.0，见 NOTICE.md）：
 *   1. 导航请求走 network-first：联网刷新一定能拿到最新 index.html
 *   2. 静态资源走 cache-first：命中即返回，未命中再取网并回填
 *   3. 绝不拦截跨域请求（LLM 接口、SSE 流式响应都不能被缓存）
 *
 * CACHE 名由构建时注入（见 vite.config.ts 的 __SW_CACHE__）。
 * 每次构建都会变，因此 activate 时会清掉旧缓存，不会出现"装了新版却跑旧壳"。
 */

const CACHE = '__SW_CACHE__'

/* 预缓存外壳。资源文件名带哈希，靠构建产物里的引用关系在运行时补进缓存，
   所以这里只放稳定路径的东西。 */
const PRECACHE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined) // 预缓存失败不该让 SW 装不上
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // 只处理同源请求：LLM 接口通常跨域，SSE 更不能被缓存
  if (url.origin !== self.location.origin) return

  // 导航：network-first，离线时回落到缓存的壳
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'reload' }).catch(() =>
        caches.match('./').then((r) => r || caches.match('./index.html')),
      ),
    )
    return
  }

  // 静态资源：cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        // 只缓存成功的同源响应
        if (res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      })
    }),
  )
})
