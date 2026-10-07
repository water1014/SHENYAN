import { create } from 'zustand'
import {
  deleteCharacter as dbDeleteCharacter,
  listCharacters,
  putCharacter,
} from '@/lib/db'
import type { Character } from '@/lib/types'
import { createCharacter, sampleCharacters } from '@/lib/defaults'
import { uid } from '@/lib/utils'

interface CharacterState {
  characters: Character[]
  activeCharacterId: string | null
  loaded: boolean

  init: () => Promise<void>
  reload: () => Promise<void>
  setActive: (id: string | null) => void
  create: (partial?: Partial<Character>) => Promise<Character>
  update: (id: string, patch: Partial<Character>) => Promise<void>
  remove: (id: string) => Promise<void>
  duplicate: (id: string) => Promise<Character | null>
  /** 导入角色卡（单卡 JSON 或备份文件里的 characters） */
  importCharacters: (characters: Partial<Character>[], onConflict?: 'rename' | 'skip') => Promise<Character[]>
  exportOne: (id: string) => Character | undefined
  active: () => Character | null
}

function normalizeCharacter(raw: Partial<Character>): Character {
  const base = createCharacter()
  const tags = Array.isArray(raw.tags)
    ? raw.tags
    : typeof raw.tags === 'string'
      ? String(raw.tags)
          .split(/[,，\s]+/)
          .filter(Boolean)
      : []
  return {
    ...base,
    ...raw,
    id: raw.id && String(raw.id).trim() ? String(raw.id) : base.id,
    name: (raw.name ?? base.name).toString().trim() || '未命名角色',
    avatar: raw.avatar ?? '',
    persona: raw.persona ?? '',
    style: raw.style ?? '',
    addressUser: raw.addressUser ?? (raw as any).address ?? '',
    selfName: raw.selfName ?? '',
    taboos: raw.taboos ?? '',
    firstMessage: raw.firstMessage ?? '',
    exampleDialogs: raw.exampleDialogs ?? '',
    scenario: raw.scenario ?? '',
    tags,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : base.createdAt,
    updatedAt: Date.now(),
  }
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [],
  activeCharacterId: null,
  loaded: false,

  async init() {
    let list = await listCharacters()
    if (list.length === 0) {
      // 首次使用：给两个示例角色，避免打开就是空白
      const samples = sampleCharacters()
      for (const c of samples) await putCharacter(c)
      list = await listCharacters()
    }
    set({
      characters: list,
      activeCharacterId: get().activeCharacterId ?? list[0]?.id ?? null,
      loaded: true,
    })
  },

  async reload() {
    const list = await listCharacters()
    const active = get().activeCharacterId
    set({
      characters: list,
      activeCharacterId: active && list.some((c) => c.id === active) ? active : (list[0]?.id ?? null),
    })
  },

  setActive(id) {
    set({ activeCharacterId: id })
  },

  async create(partial) {
    const character = createCharacter(partial ?? {})
    await putCharacter(character)
    set({ characters: [...get().characters, character], activeCharacterId: character.id })
    return character
  },

  async update(id, patch) {
    const prev = get().characters.find((c) => c.id === id)
    if (!prev) return
    const next: Character = { ...prev, ...patch, id, updatedAt: Date.now() }
    await putCharacter(next)
    set({ characters: get().characters.map((c) => (c.id === id ? next : c)) })
  },

  async remove(id) {
    await dbDeleteCharacter(id)
    const list = get().characters.filter((c) => c.id !== id)
    set({
      characters: list,
      activeCharacterId:
        get().activeCharacterId === id ? (list[0]?.id ?? null) : get().activeCharacterId,
    })
  },

  async duplicate(id) {
    const src = get().characters.find((c) => c.id === id)
    if (!src) return null
    const copy: Character = {
      ...src,
      id: uid('char'),
      name: `${src.name} 副本`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await putCharacter(copy)
    set({ characters: [...get().characters, copy] })
    return copy
  },

  async importCharacters(list, onConflict = 'rename') {
    const existing = new Map(get().characters.map((c) => [c.id, c]))
    const added: Character[] = []
    for (const raw of list) {
      const character = normalizeCharacter(raw)
      const conflict = existing.get(character.id)
      if (conflict) {
        if (onConflict === 'skip') continue
        character.id = uid('char')
        character.name = `${character.name}（导入）`
      }
      await putCharacter(character)
      added.push(character)
      existing.set(character.id, character)
    }
    if (added.length) {
      const merged = [...get().characters, ...added]
      set({ characters: merged, activeCharacterId: added[0].id })
    }
    return added
  },

  exportOne(id) {
    return get().characters.find((c) => c.id === id)
  },

  active() {
    const { characters, activeCharacterId } = get()
    return characters.find((c) => c.id === activeCharacterId) ?? null
  },
}))
