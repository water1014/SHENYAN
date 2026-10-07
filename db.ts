import Dexie, { type Table } from 'dexie'
import type {
  AppSettings,
  Character,
  Memory,
  Message,
  PromptPreset,
  Session,
  Setting,
} from '@/lib/types'
import { BUILTIN_PROMPT_PRESETS, createDefaultSettings } from '@/lib/defaults'

/**
 * 本地优先：所有数据都落在 IndexedDB。
 * 表结构 = 需求给定的数据模型（Character / Session / Message / Memory / Setting）
 * 外加 settings 对象表与 promptPresets 表。
 */
export class CompanionDB extends Dexie {
  characters!: Table<Character, string>
  sessions!: Table<Session, string>
  messages!: Table<Message, string>
  memories!: Table<Memory, string>
  settings!: Table<Setting, string>
  promptPresets!: Table<PromptPreset, string>

  constructor() {
    super('ai-companion-chat')
    this.version(1).stores({
      characters: 'id, name, createdAt, updatedAt',
      sessions: 'id, characterId, lastMessageAt, createdAt',
      messages: 'id, sessionId, role, type, createdAt, [sessionId+createdAt]',
      memories: 'id, characterId, sessionId, type, pinned, importance, createdAt',
      settings: 'key',
      promptPresets: 'id, name',
    })
  }
}

export const db = new CompanionDB()

export const SETTINGS_KEY = 'app'

/* ------------------------------ 通用 kv ------------------------------ */

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/* ------------------------------ 设置 ------------------------------ */

export async function loadSettings(): Promise<AppSettings> {
  const stored = await kvGet<Partial<AppSettings>>(SETTINGS_KEY)
  const base = createDefaultSettings()
  if (!stored) {
    await kvSet(SETTINGS_KEY, base)
    return base
  }
  // 与默认值合并，保证新增字段有值
  return {
    ...base,
    ...stored,
    presets:
      Array.isArray(stored.presets) && stored.presets.length > 0 ? stored.presets : base.presets,
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await kvSet(SETTINGS_KEY, settings)
}

/* ------------------------------ 提示词预设 ------------------------------ */

export async function loadPromptPresets(): Promise<PromptPreset[]> {
  const rows = await db.promptPresets.toArray()
  if (rows.length === 0) {
    await db.promptPresets.bulkPut(BUILTIN_PROMPT_PRESETS)
    return BUILTIN_PROMPT_PRESETS
  }
  // 内置预设以代码为准（保证升级时同步）
  const custom = rows.filter((p) => !p.builtin)
  const builtinIds = new Set(BUILTIN_PROMPT_PRESETS.map((p) => p.id))
  const userOverrides = rows.filter((p) => p.builtin && !builtinIds.has(p.id))
  return [...BUILTIN_PROMPT_PRESETS, ...userOverrides, ...custom]
}

export async function savePromptPreset(preset: PromptPreset): Promise<void> {
  await db.promptPresets.put(preset)
}

export async function deletePromptPreset(id: string): Promise<void> {
  await db.promptPresets.delete(id)
}

/* ------------------------------ 角色 ------------------------------ */

export async function listCharacters(): Promise<Character[]> {
  return db.characters.orderBy('createdAt').toArray()
}

export async function putCharacter(character: Character): Promise<void> {
  await db.characters.put(character)
}

export async function deleteCharacter(id: string): Promise<void> {
  await db.transaction('rw', db.characters, db.sessions, db.messages, db.memories, async () => {
    const sessions = await db.sessions.where('characterId').equals(id).toArray()
    const sessionIds = sessions.map((s) => s.id)
    if (sessionIds.length) {
      await db.messages.where('sessionId').anyOf(sessionIds).delete()
    }
    await db.sessions.where('characterId').equals(id).delete()
    await db.memories.where('characterId').equals(id).delete()
    await db.characters.delete(id)
  })
}

/* ------------------------------ 会话 ------------------------------ */

export async function listSessions(characterId?: string): Promise<Session[]> {
  const all = characterId
    ? await db.sessions.where('characterId').equals(characterId).toArray()
    : await db.sessions.toArray()
  return all.filter((s) => !s.archived).sort((a, b) => b.lastMessageAt - a.lastMessageAt)
}

export async function putSession(session: Session): Promise<void> {
  await db.sessions.put(session)
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.messages, async () => {
    await db.messages.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  })
}

/* ------------------------------ 消息 ------------------------------ */

export async function listMessages(sessionId: string, includeHidden = false): Promise<Message[]> {
  const rows = await db.messages.where('sessionId').equals(sessionId).sortBy('createdAt')
  return includeHidden ? rows : rows.filter((m) => m.type !== 'summary')
}

export async function listAllMessagesForSession(sessionId: string): Promise<Message[]> {
  return db.messages.where('sessionId').equals(sessionId).sortBy('createdAt')
}

export async function putMessage(message: Message): Promise<void> {
  await db.messages.put(message)
}

export async function deleteMessage(id: string): Promise<void> {
  await db.messages.delete(id)
}

export async function countMessages(sessionId: string): Promise<number> {
  return db.messages.where('sessionId').equals(sessionId).count()
}

/* ------------------------------ 记忆 ------------------------------ */

export async function listMemories(characterId: string): Promise<Memory[]> {
  const rows = await db.memories.where('characterId').equals(characterId).toArray()
  return rows.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (b.importance !== a.importance) return b.importance - a.importance
    return b.createdAt - a.createdAt
  })
}

export async function listAllMemories(): Promise<Memory[]> {
  return db.memories.toArray()
}

export async function putMemory(memory: Memory): Promise<void> {
  await db.memories.put(memory)
}

export async function deleteMemory(id: string): Promise<void> {
  await db.memories.delete(id)
}

/* ------------------------------ 全量操作（备份 / 导入） ------------------------------ */

export async function exportAllRaw() {
  const [characters, sessions, messages, memories, promptPresets, settingsRow] = await Promise.all([
    db.characters.toArray(),
    db.sessions.toArray(),
    db.messages.toArray(),
    db.memories.toArray(),
    db.promptPresets.toArray(),
    db.settings.get(SETTINGS_KEY),
  ])
  return {
    characters,
    sessions,
    messages,
    memories,
    promptPresets,
    settings: (settingsRow?.value ?? createDefaultSettings()) as AppSettings,
  }
}

/** 覆盖式导入：先清空再写入 */
export async function replaceAllRaw(data: {
  characters: Character[]
  sessions: Session[]
  messages: Message[]
  memories: Memory[]
  promptPresets?: PromptPreset[]
  settings?: AppSettings
}): Promise<void> {
  await db.transaction(
    'rw',
    [db.characters, db.sessions, db.messages, db.memories, db.promptPresets, db.settings],
    async () => {
      await Promise.all([
        db.characters.clear(),
        db.sessions.clear(),
        db.messages.clear(),
        db.memories.clear(),
        db.promptPresets.clear(),
      ])
      await db.characters.bulkPut(data.characters)
      await db.sessions.bulkPut(data.sessions)
      await db.messages.bulkPut(data.messages)
      await db.memories.bulkPut(data.memories)
      if (data.promptPresets?.length) await db.promptPresets.bulkPut(data.promptPresets)
      if (data.settings) await db.settings.put({ key: SETTINGS_KEY, value: data.settings })
    },
  )
}

/** 合并式导入：按 id 去重，冲突时保留较新的 */
export async function mergeAllRaw(data: {
  characters: Character[]
  sessions: Session[]
  messages: Message[]
  memories: Memory[]
  promptPresets?: PromptPreset[]
}): Promise<{ characters: number; sessions: number; messages: number; memories: number }> {
  const stats = { characters: 0, sessions: 0, messages: 0, memories: 0 }

  await db.transaction(
    'rw',
    [db.characters, db.sessions, db.messages, db.memories, db.promptPresets],
    async () => {
      const existingChars = new Map((await db.characters.toArray()).map((c) => [c.id, c]))
      const charConflicts = new Set<string>()
      for (const c of data.characters) {
        const prev = existingChars.get(c.id)
        if (prev) {
          // id 冲突但内容不同：导入方加后缀另存，避免静默覆盖
          const sameContent = prev.name === c.name && prev.persona === c.persona
          if (!sameContent) {
            const newId = `${c.id}_imported_${Date.now().toString(36)}`
            charConflicts.add(c.id)
            await db.characters.put({ ...c, id: newId, name: `${c.name}（导入）` })
            stats.characters++
            continue
          }
          continue
        }
        await db.characters.put(c)
        stats.characters++
      }
      const remap = (oldId: string) =>
        charConflicts.has(oldId) ? `${oldId}_imported_${Date.now().toString(36)}` : oldId

      const sessionIdMap = new Map<string, string>()
      const existingSessions = new Set((await db.sessions.toArray()).map((s) => s.id))
      for (const s of data.sessions) {
        const newCharId = remap(s.characterId)
        if (existingSessions.has(s.id)) {
          if (newCharId !== s.characterId) {
            const newSid = `${s.id}_imported_${Date.now().toString(36)}`
            sessionIdMap.set(s.id, newSid)
            await db.sessions.put({ ...s, id: newSid, characterId: newCharId })
            stats.sessions++
          }
          continue
        }
        await db.sessions.put({ ...s, characterId: newCharId })
        stats.sessions++
      }

      const existingMsgIds = new Set((await db.messages.toArray()).map((m) => m.id))
      for (const m of data.messages) {
        if (existingMsgIds.has(m.id)) continue
        const newSid = sessionIdMap.get(m.sessionId) ?? m.sessionId
        await db.messages.put({ ...m, sessionId: newSid })
        stats.messages++
      }

      const existingMemIds = new Set((await db.memories.toArray()).map((m) => m.id))
      for (const m of data.memories) {
        if (existingMemIds.has(m.id)) continue
        await db.memories.put({ ...m, characterId: remap(m.characterId) })
        stats.memories++
      }

      if (data.promptPresets?.length) {
        const existingPresetIds = new Set((await db.promptPresets.toArray()).map((p) => p.id))
        for (const p of data.promptPresets) {
          if (existingPresetIds.has(p.id)) continue
          await db.promptPresets.put(p)
        }
      }
    },
  )

  return stats
}

export async function dbStats() {
  const [characters, sessions, messages, memories] = await Promise.all([
    db.characters.count(),
    db.sessions.count(),
    db.messages.count(),
    db.memories.count(),
  ])
  let usage: number | null = null
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      usage = est.usage ?? null
    }
  } catch {
    usage = null
  }
  return { characters, sessions, messages, memories, usage }
}

/** 请求持久化存储，降低浏览器清理 IndexedDB 的概率 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch {
    /* 忽略 */
  }
  return false
}
