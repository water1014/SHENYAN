/**
 * 全局数据模型。
 * 基础模型（Character / Session / Message / Memory / Setting）严格按需求给定字段定义，
 * 另外为 P1 预留了可选扩展字段（layers / stateCard / diary ...），现在只占位不启用。
 */

export type MessageRole = 'system' | 'user' | 'assistant'

/** 消息类型：普通消息 / 摘要（自动生成，默认不显示在正文流里）/ 主动消息（P1） */
export type MessageType = 'text' | 'summary' | 'proactive'

export interface Character {
  id: string
  name: string
  avatar: string
  /** 人设 */
  persona: string
  /** 说话风格 */
  style: string
  /** 对你的称呼 */
  addressUser: string
  /** 自称 */
  selfName: string
  /** 禁忌 */
  taboos: string
  /** 开场白 */
  firstMessage: string
  exampleDialogs: string
  /** 世界设定 / 背景（可选，P0 也参与组装） */
  scenario: string
  tags: string[]
  createdAt: number
  updatedAt: number
  /** P1 阶梯记忆占位：Persona Core / Memory Notes / Life Line / State Card / Diary */
  layers?: MemoryLayers
}

export interface Session {
  id: string
  characterId: string
  title: string
  lastMessageAt: number
  createdAt: number
  /** 已自动摘要到哪条消息为止（用于“每 N 轮摘要一次”的增量判断） */
  lastSummarizedAt?: number
  /** 上次自动摘要时覆盖到的消息数量 */
  summarizedCount?: number
  archived?: boolean
}

export interface Message {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  type: MessageType
  createdAt: number
  meta?: MessageMeta
}

export interface MessageMeta {
  /** 使用过的模型 */
  model?: string
  /** 是否被用户编辑过 */
  edited?: boolean
  /** 重新生成的来源消息 id */
  regeneratedFrom?: string
  /** 该消息是否被排除在上下文之外 */
  excluded?: boolean
  /** 摘要覆盖的消息区间（type === 'summary' 时使用） */
  summarizedRange?: [number, number]
  /** 生成的 token 估算 */
  tokens?: number
  /** 出错信息（若这条消息是错误占位） */
  error?: string
  /** 表情回应：emoji -> 打上的时间戳 */
  reactions?: Record<string, number>
  /** P1：情绪 / 心境快照 */
  mood?: string
  /** P1：语音条目 id */
  audioId?: string
}

/** 记忆类型：事实 / 偏好 / 事件 / 关系 / 未归档 */
export type MemoryType = 'fact' | 'preference' | 'event' | 'relation' | 'other'

export interface Memory {
  id: string
  characterId: string
  /** 关联会话（可选，便于按会话过滤） */
  sessionId?: string
  type: MemoryType
  content: string
  /** 重要度 1-5，越高越优先注入 */
  importance: number
  /** 手动置顶：置顶记忆一定注入 */
  pinned: boolean
  /** 是否启用（关掉就不参与注入） */
  enabled?: boolean
  /** 来源：手动 / 自动摘要 */
  source?: 'manual' | 'auto'
  createdAt: number
  updatedAt?: number
}

export interface Setting {
  key: string
  value: unknown
}

/** 一个模型预设（多套 API 配置，可保存切换） */
export interface ModelPreset {
  id: string
  name: string
  apiBase: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  topP: number
  /** 是否给请求带上 stream_options.include_usage */
  includeUsage: boolean
  /** 额外请求头（JSON 字符串） */
  extraHeaders: string
  /** 额外请求体字段（JSON 字符串） */
  extraBody: string
  createdAt: number
  updatedAt: number
}

/** 全局设置 */
export interface AppSettings {
  /** 当前激活的预设 id */
  activePresetId: string
  presets: ModelPreset[]
  /** 上下文里带多少条最近消息 */
  contextMessageLimit: number
  /** 是否启用长期记忆注入 */
  memoryEnabled: boolean
  /** 最多注入多少条记忆 */
  memoryInjectLimit: number
  /** 是否自动摘要 */
  autoSummarize: boolean
  /** 每多少轮（一问一答算一轮）自动摘要一次 */
  summarizeEveryRounds: number
  /** 摘要用哪个预设（空 = 用当前预设） */
  summarizePresetId: string
  /** 是否流式输出 */
  stream: boolean
  /** 请求超时（毫秒），0 = 不限制 */
  requestTimeoutMs: number
  /** 系统身份提示词（组装顺序的第一段） */
  systemIdentity: string
  /** 提示词预设：可切换的组装模板 */
  promptPresetId: string
  /** 主题 */
  theme: 'dark' | 'light'
  /** 是否显示 token 估算 */
  showTokenEstimate: boolean
  /** 自动备份间隔（分钟），0 = 关闭 */
  autoBackupMinutes: number
  /** 自动备份保留份数 */
  autoBackupKeep: number
  /** 是否在提示里注入"你正在扮演"约束 */
  strictRoleplay: boolean
}

/** 提示词组装模板：顺序由 blocks 决定 */
export interface PromptPreset {
  id: string
  name: string
  /** 模板文本，用 {{block}} 占位符引用下面启用的段落 */
  template: string
  blocks: PromptBlockToggle
  builtin?: boolean
}

export interface PromptBlockToggle {
  identity: boolean
  character: boolean
  memory: boolean
  scenario: boolean
  examples: boolean
  time: boolean
}

/** ---- P1 占位类型（只定义，不启用） ---- */

export interface MemoryLayers {
  /** 人格内核：几乎不变 */
  personaCore?: string
  /** 记忆笔记：自动摘要沉淀 */
  memoryNotes?: string
  /** 生命线：按时间排列的经历 */
  lifeLine?: string
  /** 状态卡：当前心情 / 关系状态 */
  stateCard?: string
  /** 日记：由便宜模型生成 */
  diary?: string
}

export interface ProactiveTask {
  id: string
  characterId: string
  kind: 'schedule' | 'reminder' | 'bedtime-story' | 'greeting'
  cron: string
  payload: string
  enabled: boolean
}

/** 导出文件的统一外壳 */
export interface BackupFile {
  app: 'ai-companion-chat'
  version: number
  exportedAt: number
  characters: Character[]
  sessions: Session[]
  messages: Message[]
  memories: Memory[]
  settings: AppSettings
  promptPresets: PromptPreset[]
}

export type ExportScope = 'all' | 'character' | 'session'
