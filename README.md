# AI 伴侣聊天前端（P0）

单用户、本地优先、API 可配、数据可导出的 AI 伴侣聊天前端。
不要登录、不要支付、不要社区、不要后台、不要多租户 —— 只做「能聊、能记、能管角色」。

- 技术栈：Vite + React 18 + TypeScript + Tailwind + shadcn/ui 风格组件 + Zustand + Dexie(IndexedDB)
- 流式聊天：`fetch` + `ReadableStream` 手写 SSE 分包解析
- 数据全部落在浏览器 IndexedDB，可一键导出/导入全量 JSON
- P1（分层记忆 / 压缩 / 主动消息 / 语音）只留接口，不实现

---

## 快速开始

```bash
npm install
npm run dev          # 打开 http://localhost:5173
```

首次打开会自动种入两个示例角色（林晚、阿克夏），直接就能聊。

然后进 **设置** 页填：

| 字段 | 说明 |
| --- | --- |
| API Base | 例 `https://api.openai.com/v1`（会自动补 `/v1` 与 `/chat/completions`） |
| API Key | 只存在本机浏览器里 |
| 模型 | 例 `gpt-4o-mini` / `deepseek-chat` |
| 温度 / 最大 token / 上下文条数 | 按需调 |

点 **测试连接** 会发一条 `ping` 验证 Base / Key / 模型是否可用。

### 想隐藏 API Key 或绕过浏览器跨域（CORS）

```bash
# Windows PowerShell
$env:UPSTREAM_BASE="https://api.openai.com/v1"; $env:UPSTREAM_KEY="sk-..."; npm run proxy
# macOS / Linux
UPSTREAM_BASE="https://api.openai.com/v1" UPSTREAM_KEY="sk-..." npm run proxy
```

然后把设置里的 **API Base 改成 `http://127.0.0.1:8787/v1`**。代理只绑定 `127.0.0.1`，
只转发 `/v1/*`，边读边写不会缓冲流式响应。

### 构建

```bash
npm run build        # tsc -b && vite build，产物在 dist/
npm run preview      # 用真实 HTTP 服务跑 dist/（推荐）
npm run typecheck
```

### 独立运行（不依赖开发服务器）

三种方式，按推荐顺序：

| 方式 | 命令 / 操作 | 说明 |
| --- | --- | --- |
| 预览服务器 | `npm run preview` → `http://localhost:4173` | **推荐**。真实 HTTP 环境，IndexedDB、CORS 行为都跟正式部署一致 |
| 任意静态服务器 | 把 `dist/` 目录交给 nginx / `python -m http.server` 等 | 产物是纯静态的，`base: './'` 已配好，挂在子路径下也能用 |
| 直接双击打开 | 双击 `dist/index.html` | 能打开、能聊天记录本地保存，但**调用 API 很可能失败**（见下） |

> **为什么双击打开可能聊不起来**：`file://` 页面的来源是 `null`，浏览器发跨域请求时不带正常
> Origin，多数 API 会直接拒绝。同理，Markdown 渲染、IndexedDB 这种纯本地功能不受影响。
> 想在 `file://` 下也能聊，就**先启动本地代理**（`npm run proxy`），再把 API Base 指向
> `http://127.0.0.1:8787/v1` —— 代理的 CORS 头是 `*`，能接住任意来源。

> **依赖安装说明**：本项目用 npm 的扁平 `node_modules` 布局。若用 pnpm，需要
> `node-linker=hoisted` 且额外放行 esbuild 的安装脚本，否则 Vite 会报
> `Cannot find package 'esbuild' / 'rollup'`。用 npm 最省事。

---

## 手机 / 窄屏

界面本身就是移动优先的响应式布局，不需要另做一套：

| 宽度 | 布局 |
| --- | --- |
| `< 1024px`（手机、竖屏平板） | 单栏聊天。左侧会话列表变成**左侧抽屉**（抽屉里带完整导航：角色 / 记忆 / 导入导出 / 设置）；右侧角色·记忆·上下文变成**底部面板** |
| `1024–1279px` | 双栏。会话列表固定左侧，右侧面板仍收在底部面板里 |
| `≥ 1280px` | 桌面三栏 |

针对手机做的细节：

- **安全区**：`viewport-fit=cover` + `env(safe-area-inset-*)`，刘海与底部横条不会压住内容
- **键盘**：输入框在手机上强制 `16px` 字号，避免 iOS 聚焦时把整页放大；手机上 Enter 是换行（软键盘没有 Shift），发送走按钮
- **触摸**：没有 hover，所以消息操作条（复制 / 重新生成 / 编辑 / 删除）在触摸设备上常驻显示，按钮加大到 40px 点按区
- **高度**：用 `100dvh`，手机地址栏收放时不会跳动
- **弹窗**：对话框宽度是 `calc(100% - 1.5rem)`，窄屏不会贴边
- **可加桌面图标**：填好设置后「添加到主屏幕」，就是全屏无地址栏的体验

## 部署到 GitHub Pages

仓库里已经放好 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)，推上去即可自动构建发布：

```bash
cd github-upload
git init
git add -A
git commit -m "AI 伴侣聊天前端 P0"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

然后在 GitHub 仓库里：**Settings → Pages → Build and deployment → Source 选 `GitHub Actions`**。
之后每次 push 到 `main` 都会自动「类型检查 → 构建 → 发布」，地址是
`https://<你的用户名>.github.io/<仓库名>/`。

### 部署路径是怎么处理的

Vite 的 `base` 决定 `index.html` 里资源怎么写。两种模式都支持：

| 场景 | base | `index.html` 里长这样 |
| --- | --- | --- |
| 本地 `npm run build` / 双击打开 | `./`（默认） | `<script src="./assets/index-xxx.js">` |
| GitHub Pages（CI 里设置 `BASE_PATH`） | `/仓库名/` | `<script src="/仓库名/assets/index-xxx.js">` |

CI 会自动传 `BASE_PATH`，用户主页仓库（`<用户名>.github.io`）会自动用 `/`。你也可以手动指定：

```bash
BASE_PATH=/my-repo/ npm run build
```

> 为什么要给 Pages 用绝对路径：hash 路由会让页面 URL 变成 `/仓库名/#/settings` 这种形式。
> 用相对路径时资源是按当前文档地址解析的，虽然正常情况下也能work，但一旦出现
> 「HTML 拿到了、JS/CS 却 404」的情况，页面上就只剩一片空白 —— 绝对路径从站点根解析，更稳。

### 部署后是空白页？按这个顺序查

1. **Pages 的 Source 必须是 `GitHub Actions`。** 如果选的是 `Deploy from a branch / main / (root)`，
   GitHub 会把**源码**当静态站发布 —— 而根目录的 `index.html` 里写的是
   `<script src="/src/main.tsx">`，浏览器拿不到编译后的 JS，结果就是**全白**。
   这是最常见的空白页原因。
2. **看 Actions 有没有跑成功。** 仓库 **Actions** 标签页里应该有一条绿色的
   `Deploy to GitHub Pages`。失败的话点进去看日志，构建日志里有一步会打印
   `dist` 结构和 `index.html` 的资源引用，能直接看出问题。
3. **确认文件在仓库根目录，不是套在子文件夹里。** 仓库顶层应该直接看到
   `index.html`、`package.json`、`src/`、`.github/`；不能是 `github-upload/index.html` 这种。
4. **强制刷新**：`Ctrl+Shift+R`（手机上换个浏览器或无痕窗口），排除缓存。
5. 还不行就打开浏览器控制台（F12）看 **Console 和 Network** 里的红色报错，
   那是定位问题最快的方式 —— 把报错发出来即可。

几个已为此准备好的点：

- **路由用 HashRouter**，Pages 刷新子页面不会 404，也不用配任何 rewrite
- **纯前端 + IndexedDB**，不需要任何后端或数据库
- **CI 会生成 `.nojekyll`**，避免 Jekyll 忽略下划线开头的文件
- API Key 存在使用者自己浏览器的本地库里，不会进仓库

> ⚠️ 部署后「聊不起来」和空白页是两回事：页面能打开但发消息报错，那是 **CORS**，
> 跟 Pages 无关，用本地代理解决（见上文）。不要把 API Key 写进代码或 `.env` 再提交到公开仓库。

---

## 页面

| 路由 | 页面 | 内容 |
| --- | --- | --- |
| `/` | 聊天主界面 | 左：会话列表；中：聊天；右：角色 / 记忆 / 上下文面板（可切换） |
| `/settings` | 设置 | 接口与模型（多预设）、对话与记忆、提示词组装 |
| `/characters` | 角色列表 | 卡片式管理、导入导出角色卡、复制、删除 |
| `/characters/:id` | 角色编辑 | 全字段编辑 + 系统提示词实时预览 |
| `/memory` | 记忆管理 | 按角色查看、搜索、按类型筛选、编辑、置顶、停用、清理自动记忆 |
| `/data` | 导入导出 | 全量/单角色/单会话导出、导入预览、自动备份快照与回滚 |

---

## 项目结构

```
.
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── components.json                 # shadcn/ui 配置（组件已内置到 src/components/ui）
├── server/
│   └── proxy.mjs                   # 零依赖本地代理（可选，隐藏 Key / 绕 CORS）
├── .github/workflows/deploy.yml     # 推到 GitHub 后自动构建并发布到 Pages
└── src/
    ├── main.tsx                    # 入口（HashRouter，便于 Pages / Tauri）
    ├── App.tsx                     # 路由表
    ├── index.css                   # Tailwind + 主题变量 + 安全区 + 抽屉动画 + Markdown 样式
    ├── vite-env.d.ts
    ├── hooks/
    │   └── use-media-query.ts      # 响应式判断（窄屏切抽屉 / 底部面板）
    ├── components/
    │   ├── app-shell.tsx           # 顶栏导航 + 启动初始化 + 自动备份调度
    │   ├── icons.tsx               # 自维护内联 SVG 图标集（不引图标库）
    │   ├── markdown.tsx            # Markdown 渲染 + 代码高亮 + 代码复制按钮
    │   ├── message-bubble.tsx      # 消息气泡 + 操作条 + 打字状态
    │   ├── composer.tsx            # 输入框（草稿保留、自适应高度、键盘差异）
    │   ├── avatar.tsx              # 头像（无图时按名字取暖色）
    │   ├── session-list.tsx        # 左侧会话列表 + 搜索 + 重命名 + 删除
    │   ├── panels/
    │   │   ├── character-panel.tsx # 右栏：角色切换与角色卡速览
    │   │   ├── memory-panel.tsx    # 右栏：记忆增删改查 + 注入开关
    │   │   └── context-panel.tsx   # 右栏：实际发送的上下文与注入的记忆
    │   └── ui/                     # shadcn/ui 风格基础组件
    │       ├── button.tsx  input.tsx  textarea.tsx  label.tsx
    │       ├── card.tsx    badge.tsx  separator.tsx switch.tsx
    │       ├── slider.tsx  tabs.tsx   dialog.tsx    select.tsx
    │       ├── dropdown-menu.tsx  scroll-area.tsx  tooltip.tsx
    │       ├── popover.tsx  toast.tsx
    ├── lib/
    │   ├── types.ts                # 数据模型（Character / Session / Message / Memory / Setting）
    │   ├── defaults.ts             # 默认设置、内置提示词预设、示例角色
    │   ├── db.ts                   # Dexie schema + 全部读写 + 导入导出底层
    │   └── utils.ts                # cn / uid / 时间格式化 / token 估算 / 下载 / 复制
    ├── services/
    │   ├── llm.ts                  # OpenAI 兼容客户端 + SSE 解析 + 上下文裁剪
    │   ├── prompt.ts               # 提示词组装
    │   ├── memory.ts               # 记忆摘要（每 N 轮提炼事实）+ 解析
    │   ├── backup.ts               # 导出 / 导入 / 自动备份快照
    │   └── p1/index.ts             # P1 接口占位（分层记忆 / 压缩 / 主动 / 语音 / 生活模块）
    ├── store/
    │   ├── settings.ts             # 设置 + 多模型预设 + 提示词预设
    │   ├── characters.ts           # 角色
    │   ├── sessions.ts             # 会话 + 消息
    │   ├── memory.ts               # 记忆
    │   ├── chat.ts                 # 流式发送 / 重新生成 / 续写 / 摘要
    │   └── ui.ts                   # 面板开关、记忆使用记录、Toast
    └── pages/
        ├── chat.tsx  settings.tsx  characters.tsx
        ├── character-editor.tsx  memory.tsx  data.tsx
```

---

## 数据模型

```ts
Character { id, name, avatar, persona, style, addressUser, selfName,
            taboos, firstMessage, exampleDialogs, scenario, tags,
            createdAt, updatedAt, layers? }        // layers 为 P1 占位
Session   { id, characterId, title, lastMessageAt, createdAt,
            summarizedCount?, lastSummarizedAt?, archived? }
Message   { id, sessionId, role, content, type, createdAt, meta? }
Memory    { id, characterId, sessionId?, type, content, importance,
            pinned, enabled, source, createdAt, updatedAt? }
Setting   { key, value }
ModelPreset { id, name, apiBase, apiKey, model, temperature, maxTokens,
              topP, includeUsage, extraHeaders, extraBody, ... }
PromptPreset { id, name, template, blocks{identity,character,memory,
               scenario,examples,time}, builtin? }
```

IndexedDB 表（Dexie）：`characters / sessions / messages / memories / settings / promptPresets`。

---

## 关键实现说明

### 1. 流式聊天与 SSE 分包

`src/services/llm.ts` 里的 `SseParser` 负责缓冲，因为一次 `read()` 可能只拿到半个
`data: {...}` 也可能一次拿到好几条。它处理了：

- 跨块撕裂的 JSON
- 一次包含多条事件
- `\n\n` 与 `\r\n\r\n` 两种分隔
- 流结束时最后一条不带空行（`flush()`）
- 没有 `[DONE]`、以 `finish_reason` 结束的服务
- `: keep-alive` 注释行、空 delta
- `reasoning_content`（DeepSeek-R1 类）
- `usage` 透传、`error` 载荷

### 2. 提示词组装顺序

`系统身份 → 角色卡 → 长期记忆 →（场景 / 示例 / 时间）→ 更早对话摘要 → 最近对话 → 用户输入`

- 段落由**提示词预设**控制（内置三套：默认角色扮演 / 精简省 token / 弱角色扮演助手），可另存自定义
- 模板用 `{{identity}} {{character}} {{memory}} {{scenario}} {{examples}} {{time}}` 占位
- 右栏「上下文」面板可以实时看到**实际组装出来的 system 与消息数组**，以及本次注入了哪些记忆

### 3. 记忆系统

| 层 | 实现 |
| --- | --- |
| 短期 | 上下文条数上限（默认 20）。本轮输入不占上限，绝不会被裁掉 |
| 长期 | 手动添加 / 置顶；每 N 轮（默认 10）自动提炼事实入库 |
| 注入 | 置顶优先 → 重要度 → 时间，取前 N 条（默认 12）拼进 system |
| 压缩 | 摘要另存为 `type: 'summary'` 消息，**只在确实裁掉更早内容时**才注入，平时不占 token |

自动摘要只在内容看起来值得记录时才真的调模型（`looksMemorable`），纯寒暄不浪费额度。

### 4. 上下文裁剪

- 条数上限只约束「已完成的往返」，末尾尚未回复的用户发言作为本轮输入永远保留
- 窗口起点若是角色发言，会往前补一条用户发言，避免上下文以角色发言开头

### 5. 重新生成 / 编辑 / 删除

- **重新生成**：把该消息及之后的消息标记为 excluded（不进上下文），原地重生，不破坏历史
- **编辑**：直接改写消息内容并打上 `edited` 标记
- **删除**：从 IndexedDB 删除
- 用户消息「编辑后重新发送」会删掉其后的消息再重发

### 6. 本地存储与备份

- 启动时申请 `navigator.storage.persist()`，降低浏览器清理概率
- 自动备份：按设定间隔在本地数据库留快照，可回滚；覆盖导入前**强制自动留一份快照**
- 导出粒度：全量 / 单角色 / 单会话 / 纯角色卡
- 导入：支持合并（按 id 去重，冲突自动改名另存）与覆盖两种模式，导入前有预览

---

## 验收对照

| 验收项 | 状态 | 说明 |
| --- | --- | --- |
| 配好 API 能流式聊 | ✅ 代码完成 | SSE 分包、CRLF、无 `[DONE]`、多字节切断等 11 项解析用例全部通过；代理 SSE 透传经 mock 上游端到端验证（确认分块未被缓冲） |
| 角色卡生效 | ✅ | 全字段进 system，右栏与设置页都可预览组装结果 |
| 刷新不丢数据 | ✅ | 全部落 IndexedDB；输入框草稿另存 localStorage |
| 能导出导入 | ✅ | 全量 / 单角色 / 单会话导出，导入有预览与两种模式 |
| 记忆能注入并影响回复 | ✅ | 置顶与重要度排序注入 system，右栏「上下文」可见实际注入内容 |
| 记忆可管理 | ✅ | 记忆管理页 + 右栏面板：增删改查、置顶、停用、按类型筛选、清理自动记忆 |

**本地已验证**：`npm run typecheck` 与 `npm run build` 均通过（628 模块，产物约 900 KB / gzip 288 KB）；
开发服务器可正常构建并加载全部页面模块；48 项核心逻辑用例通过。

**需要你在浏览器里确认**（我这里没有真实浏览器与 API Key）：
IndexedDB 的实际读写、真实流式对话、Markdown 与代码高亮渲染效果。

---

## P1 接口占位（`src/services/p1/index.ts`）

已经定义好签名但抛 `未实现`，将来换实现即可，不用改调用方：

- `layerService` —— 分层记忆：Persona Core / Memory Notes / Life Line / State Card / Diary
- `compressionService` —— 对话压缩成「经历」、日总结（走便宜模型，不占主上下文）
- `proactiveService` —— 日程监督、到点提醒、哄睡故事（**常驻需 Tauri 或 Service Worker**）
- `speechService` —— TTS、ASR、实时通话
- `LIFE_MODULES` —— 日记本 / 留言板 / timeline / 天气 / todolist / 愿望清单 / 券包 / 照片墙 / 经期记录
- `interactionService` —— 触碰反应、表情随心境变化、自动唤醒 / 自动换窗

`Character.layers`（`MemoryLayers`）与 `MessageMeta.mood / audioId` 也已预留字段。

### 包 Tauri 的注意点

已经为 Tauri 做了两处准备：HashRouter（不依赖服务端重写）、生产构建纯静态。
接 Tauri 时把 `fetch` 走 Rust 侧代理即可彻底解决 CORS，并把主动消息做成常驻。
