import { create } from 'zustand'
import type { Memory } from '@/lib/types'
import {
  deleteMemory as dbDeleteMemory,
  listMemories,
  putMemory,
} from '@/lib/db'
import { createMemory } from '@/lib/defaults'

interface MemoryState {
  /** characterId -> 记忆列表 */
  byCharacter: Record<string, Memory[]>
  loaded: boolean

  load: (characterId: string) => Promise<void>
  all: (characterId: string) => Memory[]
  add: (memory: Memory) => Promise<void>
  addMany: (memories: Memory[]) => Promise<void>
  update: (id: string, patch: Partial<Memory>) => Promise<void>
  remove: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleEnabled: (id: string) => Promise<void>
  clearCharacter: (characterId: string) => Promise<void>
  createManual: (characterId: string, content: string, extra?: Partial<Memory>) => Promise<Memory>
}

function sortMemories(list: Memory[]): Memory[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (b.importance !== a.importance) return b.importance - a.importance
    return b.createdAt - a.createdAt
  })
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  byCharacter: {},
  loaded: false,

  async load(characterId) {
    const list = await listMemories(characterId)
    set({ byCharacter: { ...get().byCharacter, [characterId]: list }, loaded: true })
  },

  all(characterId) {
    return get().byCharacter[characterId] ?? []
  },

  async add(memory) {
    await putMemory(memory)
    const list = get().byCharacter[memory.characterId] ?? []
    set({
      byCharacter: {
        ...get().byCharacter,
        [memory.characterId]: sortMemories([...list, memory]),
      },
    })
  },

  async addMany(memories) {
    if (!memories.length) return
    await Promise.all(memories.map((m) => putMemory(m)))
    const next = { ...get().byCharacter }
    const grouped = new Map<string, Memory[]>()
    for (const m of memories) {
      grouped.set(m.characterId, [...(grouped.get(m.characterId) ?? []), m])
    }
    for (const [characterId, items] of grouped) {
      next[characterId] = sortMemories([...(next[characterId] ?? []), ...items])
    }
    set({ byCharacter: next })
  },

  async update(id, patch) {
    const next = { ...get().byCharacter }
    let updated: Memory | null = null
    for (const [characterId, list] of Object.entries(next)) {
      const found = list.find((m) => m.id === id)
      if (found) {
        updated = { ...found, ...patch, updatedAt: Date.now() }
        next[characterId] = sortMemories(list.map((m) => (m.id === id ? updated! : m)))
        break
      }
    }
    if (updated) {
      await putMemory(updated)
      set({ byCharacter: next })
    }
  },

  async remove(id) {
    await dbDeleteMemory(id)
    const next = { ...get().byCharacter }
    for (const [characterId, list] of Object.entries(next)) {
      if (list.some((m) => m.id === id)) {
        next[characterId] = list.filter((m) => m.id !== id)
      }
    }
    set({ byCharacter: next })
  },

  async togglePin(id) {
    for (const list of Object.values(get().byCharacter)) {
      const found = list.find((m) => m.id === id)
      if (found) {
        await get().update(id, { pinned: !found.pinned })
        return
      }
    }
  },

  async toggleEnabled(id) {
    for (const list of Object.values(get().byCharacter)) {
      const found = list.find((m) => m.id === id)
      if (found) {
        await get().update(id, { enabled: found.enabled === false })
        return
      }
    }
  },

  async clearCharacter(characterId) {
    const list = get().byCharacter[characterId] ?? []
    await Promise.all(list.map((m) => dbDeleteMemory(m.id)))
    set({ byCharacter: { ...get().byCharacter, [characterId]: [] } })
  },

  async createManual(characterId, content, extra) {
    const memory = createMemory(characterId, content, { source: 'manual', ...extra })
    await get().add(memory)
    return memory
  },
}))
