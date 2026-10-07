/**
 * P1 预留接口 —— 现在只有类型定义与占位实现，P0 不启用。
 *
 * 这一层的意义：把后面要做的「分层记忆 / 对话压缩 / 主动消息 / 语音」
 * 收敛到几个稳定的函数签名上，将来替换实现即可，不用改调用方。
 */

import type { Character, Memory, Message, ProactiveTask } from '@/lib/types'

/* ------------------------------ 分层记忆 ------------------------------ */

export interface LayeredMemory {
  /** 人格内核：几乎不变，永远注入 */
  personaCore: string
  /** 记忆笔记：自动摘要沉淀的事实 */
  memoryNotes: string[]
  /** 生命线：按时间排列的经历 */
  lifeLine: { at: number; text: string }[]
  /** 状态卡：当前心情 / 关系状态 */
  stateCard: string
  /** 日记：由便宜模型生成 */
  diary: string
}

export interface LayerService {
  load(characterId: string): Promise<LayeredMemory>
  /** 把新记忆归入某一层 */
  absorb(characterId: string, memories: Memory[]): Promise<void>
  /** 组装成可注入的文本 */
  render(layer: LayeredMemory, budgetTokens: number): string
}

export const layerService: LayerService = {
  async load() {
    throw new Error('P1 未实现：分层记忆（KI-CO 式 Persona Core / Memory Notes / Life Line / State Card / Diary）')
  },
  async absorb() {
    throw new Error('P1 未实现：记忆归层')
  },
  render() {
    return ''
  },
}

/* ------------------------------ 对话压缩 ------------------------------ */

export interface CompressionService {
  /** 用便宜模型把一段对话压缩成「经历」，不占主上下文 */
  compress(messages: Message[], character: Character): Promise<string>
  /** 日总结 */
  dailyDigest(messages: Message[], date: string): Promise<string>
}

export const compressionService: CompressionService = {
  async compress() {
    throw new Error('P1 未实现：对话压缩为「经历」')
  },
  async dailyDigest() {
    throw new Error('P1 未实现：日总结')
  },
}

/* ------------------------------ 主动消息 ------------------------------ */

export interface ProactiveService {
  /** 注册任务（日程监督 / 到点提醒 / 哄睡故事 / 主动问候） */
  register(task: ProactiveTask): Promise<void>
  list(): Promise<ProactiveTask[]>
  /** 常驻需要 Tauri 或 Service Worker，浏览器里只能在前台轮询 */
  start(): void
  stop(): void
}

export const proactiveService: ProactiveService = {
  async register() {
    throw new Error('P1 未实现：主动消息（常驻需 Tauri 或 Service Worker）')
  },
  async list() {
    return []
  },
  start() {
    /* P1 */
  },
  stop() {
    /* P1 */
  },
}

/* ------------------------------ 语音 ------------------------------ */

export interface SpeechService {
  tts(text: string, opts?: { voice?: string; rate?: number }): Promise<ArrayBuffer>
  asr(audio: Blob): Promise<string>
  /** 实时通话 */
  startCall(characterId: string): Promise<void>
  endCall(): Promise<void>
}

export const speechService: SpeechService = {
  async tts() {
    throw new Error('P1 未实现：TTS')
  },
  async asr() {
    throw new Error('P1 未实现：语音识别')
  },
  async startCall() {
    throw new Error('P1 未实现：实时通话')
  },
  async endCall() {
    /* P1 */
  },
}

/* ------------------------------ 生活模块 ------------------------------ */

export type LifeModuleKey =
  | 'diary'
  | 'guestbook'
  | 'timeline'
  | 'weather'
  | 'todolist'
  | 'wishlist'
  | 'coupon'
  | 'photowall'
  | 'period'

export interface LifeModule {
  key: LifeModuleKey
  title: string
  enabled: boolean
}

export const LIFE_MODULES: LifeModule[] = [
  { key: 'diary', title: '日记本', enabled: false },
  { key: 'guestbook', title: '留言板', enabled: false },
  { key: 'timeline', title: 'Timeline', enabled: false },
  { key: 'weather', title: '天气', enabled: false },
  { key: 'todolist', title: '待办', enabled: false },
  { key: 'wishlist', title: '愿望清单', enabled: false },
  { key: 'coupon', title: '券包', enabled: false },
  { key: 'photowall', title: '照片墙', enabled: false },
  { key: 'period', title: '经期记录', enabled: false },
]

/* ------------------------------ 互动 ------------------------------ */

export interface InteractionService {
  /** 触碰反应 */
  touch(characterId: string, zone: string): Promise<string>
  /** 表情随心境变化 */
  moodOf(characterId: string): Promise<string>
  /** 自动唤醒 / 自动换窗 */
  setAutoWake(enabled: boolean): void
}

export const interactionService: InteractionService = {
  async touch() {
    throw new Error('P1 未实现：触碰反应')
  },
  async moodOf() {
    return 'calm'
  },
  setAutoWake() {
    /* P1 */
  },
}
