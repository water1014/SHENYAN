import { create } from 'zustand'
import { db, listAllMessagesForSession, putMessage, putSession } from '@/lib/db'
import type { Character, Message, ModelPreset, Session } from '@/lib/types'
import { createMessage } from '@/lib/defaults'
import { budgetOf, streamChat, trimHistory, LlmError } from '@/services/llm'
import { assembleMessages } from '@/services/prompt'
import { looksMemorable, summarizeToMemories, summarizeToNarrative } from '@/services/memory'
import { useSessionStore } from '@/store/sessions'
import { useSettingsStore } from '@/store/settings'
import { useCharacterStore } from '@/store/characters'
import { useMemoryStore } from '@/store/memory'
import { useUiStore } from '@/store/ui'

export interface ContextPreview {
  system: string
  messages: { role: string; content: string }[]
  usedMemoryIds: string[]
  droppedCount: number
  keptCount: number
  estimatedTokens: number
}

interface ChatState {
  streaming: boolean
  streamingText: string
  streamingMessageId: string | null
  error: string | null
  lastBudget: { estimatedTokens: number; messageCount: number; droppedCount: number } | null
  lastContext: ContextPreview | null
  autoSummarizing: boolean

  send: (text: string) => Promise<void>
  regenerate: (messageId: string) => Promise<void>
  continueLast: () => Promise<void>
  stop: () => void
  clearError: () => void
  buildContextPreview: (sessionId: string) => Promise<ContextPreview>
  refreshContextPreview: () => Promise<void>
  /** 手动触发一次摘要 */
  summarizeNow: (sessionId: string) => Promise<{ facts: number } | null>
  /** 内部：自动摘要（按轮数） */
  maybeAutoSummarize: (sessionId: string) => Promise<void>
}

/** 流式请求的中断句柄（放模块作用域，避免每次 setState） */
const abortRef: { current: AbortController | null } = { current: null }

function resolvePreset(settings: ReturnType<typeof useSettingsStore.getState>['settings']): ModelPreset | null {
  return settings.presets.find((p) => p.id === settings.activePresetId) ?? settings.presets[0] ?? null
}

interface BuiltContext {
  preview: ContextPreview
  /** 送给 API 的完整消息数组 */
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  character: Character
  session: Session
  preset: ModelPreset
}

/**
 * 组装一次请求所需的上下文。
 * 顺序：系统身份 + 角色卡 + 长期记忆 → 更早对话摘要 → 最近对话 → 本轮用户输入
 */
async function buildContext(sessionId: string): Promise<BuiltContext | { error: string }> {
  const { settings, promptPresets } = useSettingsStore.getState()
  const preset = resolvePreset(settings)
  if (!preset) return { error: '没有可用的模型预设，请到设置页添加' }

  const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
  if (!session) return { error: '会话不存在' }

  const character = useCharacterStore.getState().characters.find((c) => c.id === session.characterId)
  if (!character) return { error: '该会话对应的角色已被删除' }

  const promptPreset =
    promptPresets.find((p) => p.id === settings.promptPresetId) ?? promptPresets[0]
  if (!promptPreset) return { error: '没有可用的提示词预设' }

  const memories = useMemoryStore.getState().byCharacter[character.id] ?? []
  const all = await listAllMessagesForSession(sessionId)
  const excluded = new Set(useUiStore.getState().excludedIn(sessionId))
  const usable = all.filter((m) => !excluded.has(m.id))

  const { kept, dropped } = trimHistory(usable, settings.contextMessageLimit)

  // 只在确实丢掉了更早内容时，才把摘要作为补充注入
  const summaries = dropped > 0 ? usable.filter((m) => m.type === 'summary') : []
  const forAssembly = [...summaries, ...kept]

  const result = assembleMessages({
    settings,
    character,
    memories,
    history: forAssembly,
    promptPreset,
  })

  const preview: ContextPreview = {
    system: result.system,
    messages: result.messages.map((m) => ({ role: m.role, content: m.content })),
    usedMemoryIds: result.usedMemoryIds,
    droppedCount: dropped,
    keptCount: kept.filter((m) => m.type === 'text').length,
    estimatedTokens: result.estimatedTokens,
  }

  return {
    preview,
    messages: result.messages,
    character,
    session,
    preset,
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  streaming: false,
  streamingText: '',
  streamingMessageId: null,
  error: null,
  lastBudget: null,
  lastContext: null,
  autoSummarizing: false,

  clearError: () => set({ error: null }),

  stop() {
    abortRef.current?.abort()
    abortRef.current = null
    set({ streaming: false })
    // 已生成的部分保留在消息里，只是不再继续追加
  },

  async buildContextPreview(sessionId) {
    const built = await buildContext(sessionId)
    if ('error' in built) {
      const empty: ContextPreview = {
        system: `（无法组装：${built.error}）`,
        messages: [],
        usedMemoryIds: [],
        droppedCount: 0,
        keptCount: 0,
        estimatedTokens: 0,
      }
      set({ lastContext: empty })
      return empty
    }
    set({ lastContext: built.preview })
    return built.preview
  },

  async refreshContextPreview() {
    const sessionId = useSessionStore.getState().activeSessionId
    if (!sessionId) {
      set({ lastContext: null })
      return
    }
    await get().buildContextPreview(sessionId)
  },

  async send(text) {
    const content = text.trim()
    if (!content || get().streaming) return

    const sessionStore = useSessionStore.getState()
    const sessionId = sessionStore.activeSessionId
    if (!sessionId) {
      set({ error: '还没有选中会话' })
      return
    }

    set({ error: null })

    // 1) 落库用户消息
    const userMessage = createMessage(sessionId, 'user', content)
    await sessionStore.appendMessage(userMessage)
    await sessionStore.autoTitleFromMessage(sessionId, content)

    // 2) 组装上下文并落库一个流式占位助手消息
    const built = await buildContext(sessionId)
    if ('error' in built) {
      set({ error: built.error })
      return
    }
    set({ lastContext: built.preview, lastBudget: budgetOf(built.messages) })

    const assistantMessage = createMessage(sessionId, 'assistant', '', {
      meta: { model: built.preset.model },
    })
    await useSessionStore.getState().appendMessage(assistantMessage)
    useUiStore.getState().recordMemoryUsage(assistantMessage.id, built.preview.usedMemoryIds)

    await runStream({ assistantMessage, built, set, get })
  },

  async regenerate(messageId) {
    if (get().streaming) return
    const sessionStore = useSessionStore.getState()
    const sessionId = sessionStore.activeSessionId
    if (!sessionId) return

    set({ error: null })
    const messages = sessionStore.messages
    const index = messages.findIndex((m) => m.id === messageId)
    if (index === -1) return
    const target = messages[index]

    // 把这条消息以及它之后的消息都排除出上下文，然后原地重新生成
    const excludedIds = messages.slice(index).map((m) => m.id)
    useUiStore.getState().excludeMessages(sessionId, excludedIds)

    if (target.role === 'assistant') {
      // 原地重生：清空内容继续用同一个 id
      const reset: Message = {
        ...target,
        content: '',
        createdAt: Date.now(),
        meta: { ...target.meta, regeneratedFrom: target.id, edited: false, error: undefined },
      }
      await useSessionStore.getState().replaceMessage(reset)
      useSessionStore.getState().patchMessageLocal(reset.id, reset)

      const built = await buildContext(sessionId)
      if ('error' in built) {
        set({ error: built.error })
        return
      }
      set({ lastContext: built.preview, lastBudget: budgetOf(built.messages) })
      useUiStore.getState().recordMemoryUsage(reset.id, built.preview.usedMemoryIds)
      await runStream({ assistantMessage: reset, built, set, get })
    } else {
      // 对用户消息重新生成：删掉这条之后的所有消息，再基于它重发
      const later = messages.slice(index + 1)
      for (const m of later) await db.messages.delete(m.id)
      set({
        lastContext: null,
      })
      await sessionStore.loadMessages(sessionId)

      const built = await buildContext(sessionId)
      if ('error' in built) {
        set({ error: built.error })
        return
      }
      set({ lastContext: built.preview, lastBudget: budgetOf(built.messages) })
      const assistantMessage = createMessage(sessionId, 'assistant', '', {
        meta: { model: built.preset.model, regeneratedFrom: target.id },
      })
      await useSessionStore.getState().appendMessage(assistantMessage)
      useUiStore.getState().recordMemoryUsage(assistantMessage.id, built.preview.usedMemoryIds)
      await runStream({ assistantMessage, built, set, get })
    }
  },

  async continueLast() {
    if (get().streaming) return
    const sessionStore = useSessionStore.getState()
    const sessionId = sessionStore.activeSessionId
    if (!sessionId) return
    const last = [...sessionStore.messages].reverse().find((m) => m.role === 'assistant')
    if (!last) {
      set({ error: '还没有可续写的内容' })
      return
    }
    set({ error: null })
    const built = await buildContext(sessionId)
    if ('error' in built) {
      set({ error: built.error })
      return
    }
    const assistantMessage = createMessage(sessionId, 'assistant', '', {
      meta: { model: built.preset.model, regeneratedFrom: last.id },
    })
    await useSessionStore.getState().appendMessage(assistantMessage)
    useUiStore.getState().recordMemoryUsage(assistantMessage.id, built.preview.usedMemoryIds)
    await runStream({ assistantMessage, built, set, get })
  },

  async summarizeNow(sessionId) {
    const { settings } = useSettingsStore.getState()
    const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
    if (!session) return null
    const character = useCharacterStore.getState().characters.find((c) => c.id === session.characterId)
    if (!character) return null

    const preset =
      settings.presets.find((p) => p.id === settings.summarizePresetId) ?? resolvePreset(settings)
    if (!preset) return null

    const all = await listAllMessagesForSession(sessionId)
    const from = session.summarizedCount ?? 0
    const slice = all.filter((m) => m.type === 'text').slice(from)
    if (slice.length === 0) return { facts: 0 }

    const controller = new AbortController()
    try {
      const result = await summarizeToMemories({
        preset,
        character,
        settings,
        messages: slice,
        signal: controller.signal,
      })
      if (result.memories.length) {
        await useMemoryStore.getState().addMany(result.memories)
      }
      // 存一条叙述型摘要，上下文被裁掉更早内容时会作为补充注入
      try {
        const narrative = await summarizeToNarrative({
          preset,
          character,
          settings,
          messages: slice,
          signal: controller.signal,
        })
        if (narrative.trim()) {
          const summaryMessage = createMessage(sessionId, 'system', narrative.trim(), {
            type: 'summary',
            meta: { summarizedRange: [from, from + slice.length] },
          })
          await putMessage(summaryMessage)
        }
      } catch {
        /* 叙述可选，失败不影响记忆入库 */
      }

      const summarizedCount = from + slice.length
      await putSession({ ...session, summarizedCount, lastSummarizedAt: Date.now() })
      await useSessionStore.getState().loadSessions(character.id)
      return { facts: result.memories.length }
    } catch (e) {
      const err = e as Error
      useUiStore.getState().showToast(`摘要失败：${err.message}`, 'error')
      return null
    }
  },

  async maybeAutoSummarize(sessionId) {
    const { settings } = useSettingsStore.getState()
    if (!settings.autoSummarize || get().autoSummarizing) return
    const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
    if (!session) return

    const all = await listAllMessagesForSession(sessionId)
    const textMessages = all.filter((m) => m.type === 'text')
    const from = session.summarizedCount ?? 0
    const pending = textMessages.slice(from)
    const rounds = Math.floor(pending.filter((m) => m.role === 'user').length)
    if (rounds < Math.max(1, settings.summarizeEveryRounds)) return
    if (!looksMemorable(pending)) {
      // 没什么可记的，直接推进游标，避免每轮都重试
      await putSession({ ...session, summarizedCount: textMessages.length })
      await useSessionStore.getState().loadSessions(session.characterId)
      return
    }

    set({ autoSummarizing: true })
    try {
      await get().summarizeNow(sessionId)
    } finally {
      set({ autoSummarizing: false })
    }
  },
}))

/* ------------------------- 流式执行（模块内私有） ------------------------- */

interface RunArgs {
  assistantMessage: Message
  built: BuiltContext
  set: (partial: Partial<ChatState>) => void
  get: () => ChatState
}

async function runStream({ assistantMessage, built, set, get }: RunArgs) {
  const { settings } = useSettingsStore.getState()
  const controller = new AbortController()
  abortRef.current = controller

  let timeoutId: number | null = null
  if (settings.requestTimeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      controller.abort()
    }, settings.requestTimeoutMs)
  }

  set({
    streaming: true,
    streamingText: '',
    streamingMessageId: assistantMessage.id,
    error: null,
  })

  let accumulated = ''
  let settled = false

  const persistFinal = async (extra?: Partial<Message['meta']>) => {
    const final: Message =
      (await db.messages.get(assistantMessage.id)) ?? assistantMessage
    const updated: Message = {
      ...final,
      content: accumulated,
      meta: { ...final.meta, ...extra, model: built.preset.model },
    }
    await putMessage(updated)
    useSessionStore.getState().patchMessageLocal(updated.id, updated)
    await useSessionStore.getState().touchSession(assistantMessage.sessionId)
  }

  await streamChat(
    {
      preset: built.preset,
      messages: built.messages,
      signal: controller.signal,
    },
    {
      onDelta(delta) {
        accumulated += delta
        set({ streamingText: accumulated })
        useSessionStore.getState().patchMessageLocal(assistantMessage.id, { content: accumulated })
      },
      onDone() {
        settled = true
        void (async () => {
          if (timeoutId !== null) window.clearTimeout(timeoutId)
          abortRef.current = null
          set({ streaming: false, streamingMessageId: null, streamingText: '' })
          await persistFinal()
          void get().maybeAutoSummarize(assistantMessage.sessionId)
        })()
      },
      onError(error) {
        settled = true
        if (timeoutId !== null) window.clearTimeout(timeoutId)
        abortRef.current = null
        const message =
          error instanceof LlmError ? error.message : (error as Error)?.message || '未知错误'
        set({ streaming: false, streamingMessageId: null, streamingText: '', error: message })
        void (async () => {
          if (!accumulated.trim()) {
            // 一个字都没生成：把空占位删掉，别留个空泡
            await db.messages.delete(assistantMessage.id)
            useSessionStore.getState().removeMessageLocal(assistantMessage.id)
          } else {
            await persistFinal({ error: message })
          }
        })()
      },
    },
  )

  // 安全网：极端情况下回调都没触发
  if (!settled) {
    if (timeoutId !== null) window.clearTimeout(timeoutId)
    abortRef.current = null
    set({ streaming: false, streamingMessageId: null, streamingText: '' })
    if (accumulated.trim()) await persistFinal()
  }
}
