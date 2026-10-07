import { create } from 'zustand'
import {
  deletePromptPreset,
  loadPromptPresets,
  loadSettings,
  savePromptPreset,
  saveSettings,
} from '@/lib/db'
import type { AppSettings, ModelPreset, PromptPreset } from '@/lib/types'
import { BUILTIN_PROMPT_PRESETS, createDefaultPreset, createDefaultSettings } from '@/lib/defaults'
import { createAutoBackup, pruneAutoBackups } from '@/services/backup'

interface SettingsState {
  settings: AppSettings
  promptPresets: PromptPreset[]
  loaded: boolean
  /** 是否有未保存的改动（自动保存下仅作提示） */
  saving: boolean
  lastSavedAt: number | null

  init: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
  /** 当前激活的预设 */
  activePreset: () => ModelPreset
  addPreset: (preset?: Partial<ModelPreset>) => Promise<string>
  updatePreset: (id: string, patch: Partial<ModelPreset>) => Promise<void>
  duplicatePreset: (id: string) => Promise<string | null>
  removePreset: (id: string) => Promise<void>
  setActivePreset: (id: string) => Promise<void>
  savePromptPreset: (preset: PromptPreset) => Promise<void>
  deletePromptPreset: (id: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: createDefaultSettings(),
  promptPresets: BUILTIN_PROMPT_PRESETS,
  loaded: false,
  saving: false,
  lastSavedAt: null,

  async init() {
    const [settings, promptPresets] = await Promise.all([loadSettings(), loadPromptPresets()])
    set({ settings, promptPresets, loaded: true })
  },

  async update(patch) {
    const next = { ...get().settings, ...patch }
    set({ settings: next, saving: true })
    await saveSettings(next)
    set({ saving: false, lastSavedAt: Date.now() })
  },

  activePreset() {
    const { settings } = get()
    return (
      settings.presets.find((p) => p.id === settings.activePresetId) ?? settings.presets[0]
    )
  },

  async addPreset(preset) {
    const created = createDefaultPreset({ name: `预设 ${get().settings.presets.length + 1}`, ...preset })
    const next = { ...get().settings, presets: [...get().settings.presets, created] }
    set({ settings: next })
    await saveSettings(next)
    return created.id
  },

  async updatePreset(id, patch) {
    const presets = get().settings.presets.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
    )
    const next = { ...get().settings, presets }
    set({ settings: next })
    await saveSettings(next)
  },

  async duplicatePreset(id) {
    const src = get().settings.presets.find((p) => p.id === id)
    if (!src) return null
    const copy = createDefaultPreset({ ...src, name: `${src.name} 副本` })
    const next = { ...get().settings, presets: [...get().settings.presets, copy] }
    set({ settings: next })
    await saveSettings(next)
    return copy.id
  },

  async removePreset(id) {
    const { settings } = get()
    if (settings.presets.length <= 1) return
    const presets = settings.presets.filter((p) => p.id !== id)
    const activePresetId = settings.activePresetId === id ? presets[0].id : settings.activePresetId
    const summarizePresetId = settings.summarizePresetId === id ? '' : settings.summarizePresetId
    const next = { ...settings, presets, activePresetId, summarizePresetId }
    set({ settings: next })
    await saveSettings(next)
  },

  async setActivePreset(id) {
    await get().update({ activePresetId: id })
  },

  async savePromptPreset(preset) {
    await savePromptPreset(preset)
    const list = get().promptPresets.filter((p) => p.id !== preset.id)
    set({ promptPresets: [...list, preset] })
  },

  async deletePromptPreset(id) {
    const target = get().promptPresets.find((p) => p.id === id)
    if (!target || target.builtin) return
    await deletePromptPreset(id)
    const remaining = get().promptPresets.filter((p) => p.id !== id)
    set({ promptPresets: remaining })
    if (get().settings.promptPresetId === id) {
      await get().update({ promptPresetId: BUILTIN_PROMPT_PRESETS[0].id })
    }
  },
}))

/** 供非 React 代码（如 chat store）读取当前设置 */
export function readSettings(): AppSettings {
  return useSettingsStore.getState().settings
}

export function readActivePreset(): ModelPreset {
  return useSettingsStore.getState().activePreset()
}

/** 自动备份调度：由 App 挂载 */
let backupTimer: number | null = null
export function scheduleAutoBackup(getMinutes: () => number, getKeep: () => number) {
  if (backupTimer !== null) {
    window.clearInterval(backupTimer)
    backupTimer = null
  }
  const minutes = getMinutes()
  if (!minutes || minutes <= 0) return
  backupTimer = window.setInterval(
    async () => {
      await createAutoBackup()
      await pruneAutoBackups(getKeep())
    },
    Math.max(1, minutes) * 60_000,
  )
}
