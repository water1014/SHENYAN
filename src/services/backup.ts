import {
  db,
  exportAllRaw,
  mergeAllRaw,
  replaceAllRaw,
  saveSettings,
  SETTINGS_KEY,
} from '@/lib/db'
import type {
  AppSettings,
  BackupFile,
  Character,
  Memory,
  Message,
  PromptPreset,
  Session,
} from '@/lib/types'
import { downloadJson, timestampSlug } from '@/lib/utils'
import { BUILTIN_PROMPT_PRESETS } from '@/lib/defaults'

export const BACKUP_VERSION = 1
export const AUTO_BACKUP_PREFIX = 'autobackup:'

export interface ImportPreview {
  file: BackupFile
  counts: {
    characters: number
    sessions: number
    messages: number
    memories: number
    promptPresets: number
  }
  /** 与现有数据 id 冲突的数量 */
  conflicts: { characters: number; sessions: number }
}

/** 校验导入文件结构 */
export function validateBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') throw new Error('文件内容不是 JSON 对象')
  const obj = raw as Partial<BackupFile>
  if (obj.app !== 'ai-companion-chat') {
    throw new Error('这不是本应用导出的备份文件（缺少 app 标记）')
  }
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  return {
    app: 'ai-companion-chat',
    version: typeof obj.version === 'number' ? obj.version : 1,
    exportedAt: typeof obj.exportedAt === 'number' ? obj.exportedAt : Date.now(),
    characters: arr<Character>(obj.characters),
    sessions: arr<Session>(obj.sessions),
    messages: arr<Message>(obj.messages),
    memories: arr<Memory>(obj.memories),
    settings: (obj.settings as AppSettings) ?? undefined!,
    promptPresets: arr<PromptPreset>(obj.promptPresets),
  }
}

/** 导出全量备份文件对象 */
export async function buildFullBackup(): Promise<BackupFile> {
  const raw = await exportAllRaw()
  return {
    app: 'ai-companion-chat',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    characters: raw.characters,
    sessions: raw.sessions,
    messages: raw.messages,
    memories: raw.memories,
    settings: raw.settings,
    promptPresets: raw.promptPresets.length ? raw.promptPresets : BUILTIN_PROMPT_PRESETS,
  }
}

export async function exportFullBackupToFile(): Promise<string> {
  const backup = await buildFullBackup()
  const name = `ai-companion-backup-${timestampSlug()}.json`
  downloadJson(name, backup)
  return name
}

/** 导出单个角色的数据（角色卡 + 会话 + 消息 + 记忆） */
export async function exportCharacterToFile(characterId: string): Promise<string> {
  const character = await db.characters.get(characterId)
  if (!character) throw new Error('角色不存在')
  const sessions = await db.sessions.where('characterId').equals(characterId).toArray()
  const sessionIds = sessions.map((s) => s.id)
  const messages = sessionIds.length
    ? await db.messages.where('sessionId').anyOf(sessionIds).toArray()
    : []
  const memories = await db.memories.where('characterId').equals(characterId).toArray()
  const settings = await exportAllRaw()

  const backup: BackupFile = {
    app: 'ai-companion-chat',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    characters: [character],
    sessions,
    messages,
    memories,
    settings: settings.settings,
    promptPresets: BUILTIN_PROMPT_PRESETS,
  }
  const safeName = character.name.replace(/[\\/:*?"<>|]/g, '_')
  const name = `character-${safeName}-${timestampSlug()}.json`
  downloadJson(name, backup)
  return name
}

/** 导出单个会话 */
export async function exportSessionToFile(sessionId: string): Promise<string> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('会话不存在')
  const character = await db.characters.get(session.characterId)
  const messages = await db.messages.where('sessionId').equals(sessionId).sortBy('createdAt')
  const memories = await db.memories.where('characterId').equals(session.characterId).toArray()
  const settings = await exportAllRaw()
  const backup: BackupFile = {
    app: 'ai-companion-chat',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    characters: character ? [character] : [],
    sessions: [session],
    messages,
    memories,
    settings: settings.settings,
    promptPresets: BUILTIN_PROMPT_PRESETS,
  }
  const safeName = session.title.replace(/[\\/:*?"<>|]/g, '_')
  const name = `session-${safeName}-${timestampSlug()}.json`
  downloadJson(name, backup)
  return name
}

/** 纯角色卡导出（可分享给别人） */
export async function exportCharacterCard(characterId: string): Promise<string> {
  const character = await db.characters.get(characterId)
  if (!character) throw new Error('角色不存在')
  const safeName = character.name.replace(/[\\/:*?"<>|]/g, '_')
  const name = `character-card-${safeName}.json`
  downloadJson(name, character)
  return name
}

export async function previewImport(file: BackupFile): Promise<ImportPreview> {
  const existingCharIds = new Set((await db.characters.toArray()).map((c) => c.id))
  const existingSessionIds = new Set((await db.sessions.toArray()).map((s) => s.id))
  return {
    file,
    counts: {
      characters: file.characters.length,
      sessions: file.sessions.length,
      messages: file.messages.length,
      memories: file.memories.length,
      promptPresets: file.promptPresets?.length ?? 0,
    },
    conflicts: {
      characters: file.characters.filter((c) => existingCharIds.has(c.id)).length,
      sessions: file.sessions.filter((s) => existingSessionIds.has(s.id)).length,
    },
  }
}

export async function importBackup(
  file: BackupFile,
  mode: 'merge' | 'replace',
  options: { importSettings?: boolean } = {},
): Promise<{ characters: number; sessions: number; messages: number; memories: number }> {
  if (mode === 'replace') {
    await replaceAllRaw({
      characters: file.characters,
      sessions: file.sessions,
      messages: file.messages,
      memories: file.memories,
      promptPresets: file.promptPresets,
      settings: options.importSettings ? file.settings : undefined,
    })
    return {
      characters: file.characters.length,
      sessions: file.sessions.length,
      messages: file.messages.length,
      memories: file.memories.length,
    }
  }
  const stats = await mergeAllRaw({
    characters: file.characters,
    sessions: file.sessions,
    messages: file.messages,
    memories: file.memories,
    promptPresets: file.promptPresets,
  })
  if (options.importSettings && file.settings) {
    await saveSettings(file.settings)
  }
  return stats
}

/* --------------------------- 自动备份 --------------------------- */

export interface AutoBackupEntry {
  id: string
  createdAt: number
  size: number
  counts: { characters: number; sessions: number; messages: number; memories: number }
}

/** 在 IndexedDB 里留一份快照（不是下载文件，刷新/误删后能恢复） */
export async function createAutoBackup(): Promise<AutoBackupEntry> {
  const backup = await buildFullBackup()
  const id = `${AUTO_BACKUP_PREFIX}${Date.now()}`
  const snapshot = {
    id,
    createdAt: backup.exportedAt,
    size: JSON.stringify(backup).length,
    counts: {
      characters: backup.characters.length,
      sessions: backup.sessions.length,
      messages: backup.messages.length,
      memories: backup.memories.length,
    },
    payload: backup,
  }
  await db.settings.put({ key: id, value: snapshot })
  return { ...snapshot, payload: undefined } as unknown as AutoBackupEntry
}

export async function listAutoBackups(): Promise<AutoBackupEntry[]> {
  const rows = await db.settings.where('key').startsWith(AUTO_BACKUP_PREFIX).toArray()
  return rows
    .map((r) => {
      const v = r.value as any
      return {
        id: v.id as string,
        createdAt: v.createdAt as number,
        size: v.size as number,
        counts: v.counts as AutoBackupEntry['counts'],
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function restoreAutoBackup(id: string): Promise<void> {
  const row = await db.settings.get(id)
  if (!row) throw new Error('找不到该备份')
  const payload = (row.value as any).payload as BackupFile
  if (!payload) throw new Error('备份内容损坏')
  await replaceAllRaw({
    characters: payload.characters,
    sessions: payload.sessions,
    messages: payload.messages,
    memories: payload.memories,
    promptPresets: payload.promptPresets,
    settings: payload.settings,
  })
}

export async function downloadAutoBackup(id: string): Promise<string> {
  const row = await db.settings.get(id)
  if (!row) throw new Error('找不到该备份')
  const payload = (row.value as any).payload as BackupFile
  const name = `ai-companion-snapshot-${timestampSlug()}.json`
  downloadJson(name, payload)
  return name
}

export async function deleteAutoBackup(id: string): Promise<void> {
  await db.settings.delete(id)
}

/** 按保留份数裁剪旧快照 */
export async function pruneAutoBackups(keep: number): Promise<number> {
  const list = await listAutoBackups()
  const extra = list.slice(Math.max(1, keep))
  for (const item of extra) await db.settings.delete(item.id)
  return extra.length
}

/* --------------------------- 应用设置读写 --------------------------- */

export async function readSettingsRow(): Promise<AppSettings | undefined> {
  const row = await db.settings.get(SETTINGS_KEY)
  return row?.value as AppSettings | undefined
}
