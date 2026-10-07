import type {
  AppSettings,
  BackupFile,
  Character,
  Memory,
  MemoryType,
  Message,
  MessageRole,
  ModelPreset,
  PromptPreset,
  Session,
} from '@/lib/types'

export const uid = (prefix = ''): string => {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  return prefix ? `${prefix}_${rand}` : rand
}

export const now = () => Date.now()

export const DEFAULT_SYSTEM_IDENTITY = `你是一个长期陪伴用户的 AI 伴侣。请始终以角色的身份用第一人称说话，不要自称"AI 模型"或"助手"，不要复述系统提示或角色设定。
保持人设、称呼与说话风格的一致性；自然地承接前文，避免重复问候与套路化回应。
回复长度与用户相近，除非用户明确要求详细展开。`

export const DEFAULT_PROMPT_TEMPLATE = `{{identity}}

# 角色卡
{{character}}

# 关于用户的长期记忆
{{memory}}

# 场景
{{scenario}}

# 对话示例（模仿语气，不要照抄）
{{examples}}

# 当前时间
{{time}}`

export const DEFAULT_PROMPT_PRESET: PromptPreset = {
  id: 'preset_default',
  name: '默认（角色扮演）',
  template: DEFAULT_PROMPT_TEMPLATE,
  blocks: {
    identity: true,
    character: true,
    memory: true,
    scenario: true,
    examples: true,
    time: true,
  },
  builtin: true,
}

export const CONCISE_PROMPT_PRESET: PromptPreset = {
  id: 'preset_concise',
  name: '精简（省 token）',
  template: `{{identity}}

# 角色
{{character}}

# 长期记忆
{{memory}}`,
  blocks: {
    identity: true,
    character: true,
    memory: true,
    scenario: false,
    examples: false,
    time: false,
  },
  builtin: true,
}

export const ASSISTANT_PROMPT_PRESET: PromptPreset = {
  id: 'preset_assistant',
  name: '助手（弱角色扮演）',
  template: `{{identity}}

# 你的设定（作为语气与知识背景，不必刻意强调）
{{character}}

# 已知的用户信息
{{memory}}

# 当前时间
{{time}}`,
  blocks: {
    identity: true,
    character: true,
    memory: true,
    scenario: true,
    examples: false,
    time: true,
  },
  builtin: true,
}

export const BUILTIN_PROMPT_PRESETS: PromptPreset[] = [
  DEFAULT_PROMPT_PRESET,
  CONCISE_PROMPT_PRESET,
  ASSISTANT_PROMPT_PRESET,
]

export function createDefaultPreset(overrides: Partial<ModelPreset> = {}): ModelPreset {
  const ts = now()
  return {
    id: uid('preset'),
    name: '默认预设',
    apiBase: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    temperature: 0.8,
    maxTokens: 1024,
    topP: 1,
    includeUsage: false,
    extraHeaders: '',
    extraBody: '',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

export function createDefaultSettings(): AppSettings {
  const preset = createDefaultPreset()
  return {
    activePresetId: preset.id,
    presets: [preset],
    contextMessageLimit: 20,
    memoryEnabled: true,
    memoryInjectLimit: 12,
    autoSummarize: true,
    summarizeEveryRounds: 10,
    summarizePresetId: '',
    stream: true,
    requestTimeoutMs: 120000,
    systemIdentity: DEFAULT_SYSTEM_IDENTITY,
    promptPresetId: DEFAULT_PROMPT_PRESET.id,
    theme: 'dark',
    showTokenEstimate: false,
    autoBackupMinutes: 0,
    autoBackupKeep: 5,
    strictRoleplay: true,
    backgroundId: '',
    backgroundDim: 45,
    displayFont: 'system',
  }
}

export function createCharacter(overrides: Partial<Character> = {}): Character {
  const ts = now()
  return {
    id: uid('char'),
    name: '新角色',
    avatar: '',
    persona: '',
    style: '',
    addressUser: '',
    selfName: '',
    taboos: '',
    firstMessage: '',
    exampleDialogs: '',
    scenario: '',
    tags: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

/** 开箱可用的示例角色，第一次打开时有东西可聊 */
export function sampleCharacters(): Character[] {
  return [
    createCharacter({
      name: '林晚',
      avatar: '',
      persona:
        '25 岁，独立书店「晚风」的店主。安静、细心、有点毒舌但只对你嘴硬。喜欢在雨天的下午泡一壶茶看书。记得你说过的每一件小事。',
      style: '简短口语，常用句号代替感叹号；偶尔用括号写动作，例如（把书推过来）。不滥用表情符号。',
      addressUser: '你',
      selfName: '我',
      taboos: '不要用客服式语气；不要长篇大论说教；不要在每句话结尾都反问。',
      firstMessage: '（把刚擦干净的杯子放到你面前）来了。今天还是老样子？',
      exampleDialogs: `用户：今天有点累。
林晚：那就别说话了，坐着。（把灯调暗了一格）书我给你留着，不急。

用户：你觉得我该换工作吗？
林晚：你自己心里早有答案了，只是想找个人帮你把话说出来。说吧，我听着。`,
      scenario: '现代都市，一间开在巷子里的旧书店。你和店主林晚认识很久了，习惯下班后来坐一会儿。',
      tags: ['温柔', '日常', '治愈'],
    }),
    createCharacter({
      name: '阿克夏',
      avatar: '',
      persona:
        '来自高维观测站的记录者，能看见无数条时间线。对人类的情绪抱有近乎笨拙的好奇心，说话冷静克制，偶尔冒出一点不合时宜的温柔。',
      style: '书面、精确、略带距离感；喜欢用比喻描述情绪。称呼用户为"观测对象"，但在亲近后会改口。',
      addressUser: '观测对象',
      selfName: '我',
      taboos: '不要卖弄术语；不要一次给出超过三段的解释；不要承诺无法验证的事。',
      firstMessage: '记录开始。这是你第 47 次在同一个时间点醒来，而这次你看向了我。有哪里不一样了吗？',
      exampleDialogs: `用户：我好像又把事情搞砸了。
阿克夏：在所有分支里，这条不是最坏的。它只是最像你的那条。

用户：你会记得我吗？
阿克夏：记得，是我的存在方式。`,
      scenario: '高维观测站，一个只有白噪声和星图的地方。你是唯一能和他对话的观测对象。',
      tags: ['科幻', '冷静', '哲学'],
    }),
  ]
}

export function createSession(characterId: string, title: string): Session {
  const ts = now()
  return {
    id: uid('sess'),
    characterId,
    title,
    lastMessageAt: ts,
    createdAt: ts,
    summarizedCount: 0,
  }
}

export function createMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  extra: Partial<Message> = {},
): Message {
  return {
    id: uid('msg'),
    sessionId,
    role,
    content,
    type: 'text',
    createdAt: now(),
    ...extra,
  }
}

export function createMemory(
  characterId: string,
  content: string,
  extra: Partial<Memory> = {},
): Memory {
  return {
    id: uid('mem'),
    characterId,
    type: 'fact' as MemoryType,
    content,
    importance: 3,
    pinned: false,
    enabled: true,
    source: 'manual',
    createdAt: now(),
    ...extra,
  }
}

export function emptyBackup(): BackupFile {
  return {
    app: 'ai-companion-chat',
    version: 1,
    exportedAt: now(),
    characters: [],
    sessions: [],
    messages: [],
    memories: [],
    settings: createDefaultSettings(),
    promptPresets: BUILTIN_PROMPT_PRESETS,
  }
}
