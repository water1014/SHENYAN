import type { Message, ModelPreset } from '@/lib/types'
import { estimateTokens } from '@/lib/utils'

/**
 * OpenAI 兼容的 /v1/chat/completions 客户端。
 * 用 fetch + ReadableStream 手动解析 SSE —— 必须自己缓冲分包，
 * 因为一次 read() 可能只拿到半个 "data: {...}\n\n"，也可能一次拿到好几条。
 */

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatParams {
  preset: ModelPreset
  messages: ChatCompletionMessage[]
  /** 覆盖预设里的温度 / 最大 token */
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface StreamCallbacks {
  onDelta: (text: string) => void
  onDone: (full: string) => void
  onError: (error: Error) => void
  onUsage?: (usage: TokenUsage) => void
}

export interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export class LlmError extends Error {
  status?: number
  detail?: string
  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'LlmError'
    this.status = status
    this.detail = detail
  }
}

export function normalizeBase(apiBase: string): string {
  let base = (apiBase || '').trim().replace(/\s+/g, '')
  if (!base) base = 'https://api.openai.com/v1'
  base = base.replace(/\/+$/, '')
  // 允许用户直接填完整 endpoint
  base = base.replace(/\/chat\/completions$/, '')
  if (!/\/v\d+$/.test(base) && !/\/v\d+\//.test(base)) {
    // 没有版本段时补 /v1，兼容大多数中转
    base = `${base}/v1`
  }
  return base
}

export function endpointOf(apiBase: string): string {
  return `${normalizeBase(apiBase)}/chat/completions`
}

function parseExtraJson(raw: string, label: string): Record<string, unknown> {
  const text = (raw || '').trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    throw new Error('必须是 JSON 对象')
  } catch (e) {
    throw new LlmError(`${label} 不是合法 JSON：${(e as Error).message}`)
  }
}

export function buildRequestBody(params: ChatParams, stream: boolean): Record<string, unknown> {
  const { preset, messages, temperature, maxTokens } = params
  const extraBody = parseExtraJson(preset.extraBody, '额外请求体')
  const body: Record<string, unknown> = {
    model: preset.model,
    messages,
    temperature: temperature ?? preset.temperature,
    stream,
    ...extraBody,
  }
  const mt = maxTokens ?? preset.maxTokens
  if (mt && mt > 0) {
    // 兼容不同厂商：同时给 max_tokens 与 max_completion_tokens 会被部分服务拒绝，
    // 所以只用 max_tokens（OpenAI 兼容层普遍支持），可由额外请求体覆盖。
    body.max_tokens = mt
  }
  if (typeof preset.topP === 'number' && preset.topP > 0 && preset.topP < 1) {
    body.top_p = preset.topP
  }
  if (stream) {
    body.stream_options = { include_usage: true }
  }
  return body
}

export function buildHeaders(preset: ModelPreset): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const key = (preset.apiKey || '').trim()
  if (key) headers.Authorization = `Bearer ${key}`
  const extra = parseExtraJson(preset.extraHeaders, '额外请求头')
  for (const [k, v] of Object.entries(extra)) {
    if (typeof v === 'string') headers[k] = v
  }
  return headers
}

/** 把错误响应体转成人能看懂的话 */
async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text()
    if (!text) return ''
    try {
      const json = JSON.parse(text) as { error?: { message?: string }; message?: string }
      return json.error?.message || json.message || text.slice(0, 600)
    } catch {
      return text.slice(0, 600)
    }
  } catch {
    return ''
  }
}

function friendlyStatus(status: number, detail: string): string {
  const hints: Record<number, string> = {
    400: '请求被拒绝，检查模型名与参数',
    401: '鉴权失败，检查 API Key',
    403: '无权限访问该模型',
    404: '接口地址不对，检查 API Base',
    408: '服务端超时',
    413: '请求体过大，减少上下文条数',
    422: '参数不合法',
    429: '请求太频繁或额度不足',
    500: '服务端错误',
    502: '网关错误',
    503: '服务暂时不可用',
    504: '网关超时',
  }
  const hint = hints[status] ? `（${hints[status]}）` : ''
  return `HTTP ${status}${hint}${detail ? `：${detail}` : ''}`
}

/** 把服务端返回的一条 SSE data 载荷转换成文本增量与 usage */
export function parseSsePayload(payload: string): { delta: string; usage?: TokenUsage; error?: string } {
  if (!payload || payload === '[DONE]') return { delta: '' }
  let json: any
  try {
    json = JSON.parse(payload)
  } catch {
    return { delta: '' }
  }
  if (json?.error) {
    return { delta: '', error: json.error.message || JSON.stringify(json.error) }
  }
  const choice = json?.choices?.[0]
  const deltaObj = choice?.delta
  let delta = ''
  if (typeof deltaObj?.content === 'string') {
    delta = deltaObj.content
  } else if (Array.isArray(deltaObj?.content)) {
    // 少数实现返回内容数组
    delta = deltaObj.content
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
  } else if (typeof choice?.text === 'string') {
    // 兼容旧式 completions 风格
    delta = choice.text
  }
  // reasoning 类字段（DeepSeek-R1 等）作为内容的一部分附加
  const reasoning =
    typeof deltaObj?.reasoning_content === 'string' ? deltaObj.reasoning_content : ''
  const usage: TokenUsage | undefined = json?.usage
    ? {
        promptTokens: json.usage.prompt_tokens,
        completionTokens: json.usage.completion_tokens,
        totalTokens: json.usage.total_tokens,
      }
    : undefined
  return { delta: delta + reasoning, usage }
}

/** SSE 行缓冲解析器：逐块喂入，产出完整事件 */
export class SseParser {
  private buffer = ''

  push(chunk: string): string[] {
    this.buffer += chunk
    const events: string[] = []
    // SSE 事件以空行分隔。有的服务用 \n\n，有的用 \r\n\r\n，
    // 所以统一先把 \r\n 归一成 \n，避免把 CRLF 实现的事件全丢在缓冲里。
    this.buffer = this.buffer.replace(/\r\n/g, '\n')
    let idx: number
    while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
      const raw = this.buffer.slice(0, idx)
      this.buffer = this.buffer.slice(idx + 2)
      const dataLines = raw
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
      if (dataLines.length) events.push(dataLines.join('\n'))
    }
    return events
  }

  /** 流结束时冲刷残留（有些服务最后一条不带空行） */
  flush(): string[] {
    const rest = this.buffer.replace(/\r\n/g, '\n').trim()
    this.buffer = ''
    if (!rest) return []
    const dataLines = rest
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trimStart())
    return dataLines.length ? [dataLines.join('\n')] : []
  }
}

/** 流式请求 */
export async function streamChat(params: ChatParams, cb: StreamCallbacks): Promise<void> {
  const { preset, signal } = params
  const endpoint = endpointOf(preset.apiBase)
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(preset),
      body: JSON.stringify(buildRequestBody(params, true)),
      signal,
    })
  } catch (e) {
    const err = e as Error
    if (err.name === 'AbortError') return
    cb.onError(
      new LlmError(
        `无法连接到 ${endpoint}。可能是网络不通、API Base 写错，或浏览器跨域(CORS)被拦。可尝试运行 npm run proxy 走本地代理。`,
        undefined,
        err.message,
      ),
    )
    return
  }

  if (!res.ok) {
    const detail = await readErrorBody(res)
    cb.onError(new LlmError(friendlyStatus(res.status, detail), res.status, detail))
    return
  }
  if (!res.body) {
    cb.onError(new LlmError('响应没有 body，无法读取流'))
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  const parser = new SseParser()
  let full = ''

  const handleEvent = (payload: string): boolean => {
    const { delta, usage, error } = parseSsePayload(payload)
    if (error) {
      cb.onError(new LlmError(error))
      return false
    }
    if (usage && cb.onUsage) cb.onUsage(usage)
    if (delta) {
      full += delta
      cb.onDelta(delta)
    }
    return true
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const event of parser.push(text)) {
        if (event === '[DONE]') {
          cb.onDone(full)
          return
        }
        if (!handleEvent(event)) return
      }
    }
    for (const event of parser.flush()) {
      if (event === '[DONE]') break
      if (!handleEvent(event)) return
    }
    cb.onDone(full)
  } catch (e) {
    const err = e as Error
    if (err.name === 'AbortError') {
      cb.onDone(full)
      return
    }
    cb.onError(new LlmError(`读取流失败：${err.message}`, undefined, err.message))
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* 忽略 */
    }
  }
}

/** 非流式请求（用于摘要等后台任务） */
export async function completeChat(params: ChatParams): Promise<string> {
  const endpoint = endpointOf(params.preset.apiBase)
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(params.preset),
      body: JSON.stringify(buildRequestBody(params, false)),
      signal: params.signal,
    })
  } catch (e) {
    throw new LlmError(`无法连接到 ${endpoint}`, undefined, (e as Error).message)
  }
  if (!res.ok) {
    const detail = await readErrorBody(res)
    throw new LlmError(friendlyStatus(res.status, detail), res.status, detail)
  }
  const json = (await res.json()) as any
  const content = json?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('')
  }
  throw new LlmError('响应里没有内容')
}

export interface ContextBudget {
  estimatedTokens: number
  messageCount: number
  droppedCount: number
}

/**
 * 按上下文条数裁剪历史：从最新往前取 limit 条「已完成的往返」。
 *
 * 规则：
 * 1. 末尾未完成的用户发言（本轮输入，还没被回复）不计入条数上限，永远保留；
 * 2. 起点若是角色发言，往前多退一条，避免上下文以角色发言开头；
 * 3. 末尾若残留没有回复的用户发言（例如生成出错被删），去掉它。
 */
/**
 * 按上下文条数裁剪历史。
 *
 * 条数上限只约束「已完成的往返」；末尾尚未被回复的用户发言是**本轮输入**，
 * 必须始终保留（否则模型看不到用户刚说的话），也不占用上限。
 */
export function trimHistory(
  history: Message[],
  limit: number,
): { kept: Message[]; dropped: number } {
  const textMsgs = history.filter((m) => m.type === 'text' && !m.meta?.excluded)
  if (limit <= 0) return { kept: textMsgs, dropped: 0 }

  // 1) 剥出本轮输入（末尾连续的用户发言）
  const pending: Message[] = []
  const prior = [...textMsgs]
  while (prior.length && prior[prior.length - 1].role === 'user') {
    pending.unshift(prior.pop()!)
  }

  // 2) 只在已完成的往返里按上限裁剪
  let kept = prior.length <= limit ? [...prior] : prior.slice(prior.length - limit)

  // 3) 开头若只有角色发言，往前补一条用户发言（最多补一条，避免把整个历史拖回来）
  if (kept.length && kept[0].role === 'assistant') {
    const beforeIdx = prior.length - kept.length - 1
    if (beforeIdx >= 0 && prior[beforeIdx].role === 'user') kept = [prior[beforeIdx], ...kept]
  }

  // 4) 本轮输入永远接在最后
  kept = kept.concat(pending)

  return { kept, dropped: textMsgs.length - kept.length }
}

export function budgetOf(messages: ChatCompletionMessage[]): ContextBudget {
  const estimatedTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content) + 4,
    0,
  )
  return { estimatedTokens, messageCount: messages.length, droppedCount: 0 }
}
