import { completeChat, type ChatCompletionMessage } from '@/services/llm'
import type { AppSettings, Character, Memory, Message, ModelPreset } from '@/lib/types'
import { createMemory, uid } from '@/lib/defaults'

/**
 * 记忆系统：
 * - 短期：最近 N 条消息（由设置里的 contextMessageLimit 控制，在 chat store 里裁剪）
 * - 长期：手动 pin + 每 N 轮自动摘要出「事实」，存进 memories 表
 * - 注入：由 services/prompt.ts 完成
 */

export const FACT_SYSTEM_PROMPT = `你是一个记忆整理助手。请从下面的对话片段中提取值得长期记住的关于用户的事实、偏好、经历或关系变化。

要求：
1. 每条一行，以 "- " 开头，用第三人称陈述，例如 "- 用户在一家做跨境电商的公司上班"。
2. 只写确定的信息，不要推测、不要写对话过程、不要写角色的台词。
3. 单条不超过 40 字，最多 8 条。
4. 如果没有值得长期记住的新信息，只输出：无
5. 不要输出任何解释、标题或额外文字。`

export function buildSummaryPrompt(messages: Message[]): string {
  const lines = messages
    .filter((m) => m.type === 'text')
    .map((m) => `${m.role === 'user' ? '用户' : '角色'}：${m.content}`)
  return `对话片段：\n${lines.join('\n')}`
}

/** 解析模型返回的事实列表 */
export function parseFacts(raw: string): string[] {
  const text = (raw || '').trim()
  if (!text || text === '无') return []
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/, '').trim())
    .filter((line) => line.length > 0 && line !== '无' && !/^无[。.]?$/.test(line))
    .filter((line) => line.length <= 200)
    .slice(0, 8)
}

/**
 * 判断这些消息里是否出现了值得记录的信号。
 * 目的是省掉不必要的总结请求：纯寒暄不要触发模型调用。
 * 宁可偶尔多总结一次，也不要漏掉"我住在杭州"这类短句。
 */
export function looksMemorable(messages: Message[]): boolean {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n')
    .trim()
  if (userText.length < 12) return false
  // 纯寒暄直接跳过
  if (/^[\s好嗯哦啊哈呀吧嘛的了，。！？~～、,.!?]*(在吗|你好|早安|晚安|早上好|晚上好|嗨|hi|hello|在不在)[\s好嗯哦啊哈呀吧嘛的了，。！？~～、,.!?]*$/i.test(userText)) {
    return false
  }
  const patterns = [
    // 自述身份 / 处境
    /我(是|在|住|来自|从事|养|有(?:一|个|只|条|位)|叫)/,
    // 稳定的喜好
    /我(喜欢|讨厌|不喜欢|爱吃|不吃|害怕|习惯|想要|想去|想买)/,
    // 计划与日程
    /(明天|后天|下周|下个月|下星期|周末|即将|准备|打算|计划|约好|要(?:去|见|面试|考试|出差))/,
    // 情绪与重要经历
    /(生日|纪念日|分手|吵架|难过|开心|焦虑|压力|加班|生病|住院|搬家|换工作|离职|入职|毕业)/,
    // 身边人
    /(男朋友|女朋友|对象|老公|老婆|爸爸|妈妈|父母|家人|同事|老板|老师|朋友)/,
    // 明确要求角色记住
    /(记住|别忘了|提醒我|跟你说|告诉你)/,
  ]
  return patterns.some((p) => p.test(userText))
}

export interface SummarizeDeps {
  preset: ModelPreset
  character: Character
  settings: AppSettings
  /** 本次要总结的消息（一轮或多轮） */
  messages: Message[]
  signal?: AbortSignal
}

export interface SummarizeResult {
  facts: string[]
  memories: Memory[]
  raw: string
}

/** 调一次便宜模型，产出可入库的记忆条目 */
export async function summarizeToMemories(deps: SummarizeDeps): Promise<SummarizeResult> {
  const { preset, character, messages } = deps
  const chat: ChatCompletionMessage[] = [
    { role: 'system', content: FACT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `角色名：${character.name}\n用户称呼：${character.addressUser || '用户'}\n\n${buildSummaryPrompt(
        messages,
      )}`,
    },
  ]
  const raw = await completeChat({
    preset: { ...preset, temperature: 0.2, maxTokens: Math.min(preset.maxTokens || 512, 512) },
    messages: chat,
    signal: deps.signal,
  })
  const facts = parseFacts(raw)
  const memories = facts.map((content) =>
    createMemory(character.id, content, {
      type: 'fact',
      importance: 3,
      pinned: false,
      enabled: true,
      source: 'auto',
      sessionId: messages[0]?.sessionId,
    }),
  )
  return { facts, memories, raw }
}

/** 生成一段「更早对话」的压缩摘要文本，作为系统补充注入 */
export async function summarizeToNarrative(deps: SummarizeDeps): Promise<string> {
  const { preset, character, messages } = deps
  const chat: ChatCompletionMessage[] = [
    {
      role: 'system',
      content: `请把下面的对话压缩成一段不超过 200 字的第三人称叙述，保留关键事件、情绪变化与约定。只输出这段叙述本身。`,
    },
    {
      role: 'user',
      content: `角色：${character.name}\n\n${buildSummaryPrompt(messages)}`,
    },
  ]
  return completeChat({
    preset: { ...preset, temperature: 0.3, maxTokens: 400 },
    messages: chat,
    signal: deps.signal,
  })
}

/** 从模型回复里解析 JSON 数组（容错 ```json 包裹） */
export function parseLooseJsonArray(raw: string): any[] {
  const text = (raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
  } catch {
    /* 尝试截取第一个 [ ... ] */
  }
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1))
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* 放弃 */
    }
  }
  return []
}

export function memoryTypeLabel(type: Memory['type']): string {
  const map: Record<Memory['type'], string> = {
    fact: '事实',
    preference: '偏好',
    event: '事件',
    relation: '关系',
    other: '其他',
  }
  return map[type] ?? '其他'
}

export function importanceLabel(n: number): string {
  return '★'.repeat(Math.max(1, Math.min(5, n)))
}

export function newManualMemory(characterId: string, content: string): Memory {
  return createMemory(characterId, content, { id: uid('mem') })
}
