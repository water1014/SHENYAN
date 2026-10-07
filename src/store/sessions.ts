import { create } from 'zustand'
import {
  deleteSession as dbDeleteSession,
  listMessages,
  listSessions,
  putMessage,
  putSession,
} from '@/lib/db'
import type { Message, Session } from '@/lib/types'
import { createMessage, createSession } from '@/lib/defaults'
import { previewOf } from '@/lib/utils'

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null
  loaded: boolean
  /** 当前会话的可见消息（不含 summary） */
  messages: Message[]
  messagesLoading: boolean

  loadSessions: (characterId?: string) => Promise<void>
  setActiveSession: (id: string | null) => Promise<void>
  createSession: (characterId: string, title?: string, withFirstMessage?: string) => Promise<Session>
  renameSession: (id: string, title: string) => Promise<void>
  removeSession: (id: string) => Promise<void>
  touchSession: (id: string, patch?: Partial<Session>) => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  appendMessage: (message: Message) => Promise<void>
  replaceMessage: (message: Message) => Promise<void>
  patchMessageLocal: (id: string, patch: Partial<Message>) => void
  removeMessageLocal: (id: string) => void
  activeSession: () => Session | null
  autoTitleFromMessage: (sessionId: string, content: string) => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loaded: false,
  messages: [],
  messagesLoading: false,

  async loadSessions(characterId) {
    const sessions = await listSessions(characterId)
    const current = get().activeSessionId
    const stillValid = current && sessions.some((s) => s.id === current)
    set({
      sessions,
      loaded: true,
      activeSessionId: stillValid ? current : (sessions[0]?.id ?? null),
    })
  },

  async setActiveSession(id) {
    set({ activeSessionId: id, messages: [] })
    if (id) await get().loadMessages(id)
  },

  async createSession(characterId, title = '新的对话', withFirstMessage) {
    const session = createSession(characterId, title)
    await putSession(session)
    set({ sessions: [session, ...get().sessions], activeSessionId: session.id, messages: [] })
    if (withFirstMessage && withFirstMessage.trim()) {
      const msg = createMessage(session.id, 'assistant', withFirstMessage.trim())
      await putMessage(msg)
      set({ messages: [msg] })
    }
    return session
  },

  async renameSession(id, title) {
    const session = get().sessions.find((s) => s.id === id)
    if (!session) return
    const next = { ...session, title: title.trim() || '未命名对话' }
    await putSession(next)
    set({ sessions: get().sessions.map((s) => (s.id === id ? next : s)) })
  },

  async removeSession(id) {
    await dbDeleteSession(id)
    const sessions = get().sessions.filter((s) => s.id !== id)
    const nextActive = get().activeSessionId === id ? (sessions[0]?.id ?? null) : get().activeSessionId
    set({ sessions, activeSessionId: nextActive, messages: [] })
    if (nextActive) await get().loadMessages(nextActive)
  },

  async touchSession(id, patch) {
    const session = get().sessions.find((s) => s.id === id)
    if (!session) return
    const next = { ...session, ...patch, lastMessageAt: Date.now() }
    await putSession(next)
    const sessions = get()
      .sessions.map((s) => (s.id === id ? next : s))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    set({ sessions })
  },

  async loadMessages(sessionId) {
    set({ messagesLoading: true })
    const messages = await listMessages(sessionId, false)
    // 避免竞态：只有当仍然停留在该会话时才写入
    if (get().activeSessionId === sessionId) set({ messages, messagesLoading: false })
    else set({ messagesLoading: false })
  },

  async appendMessage(message) {
    await putMessage(message)
    if (get().activeSessionId === message.sessionId) {
      set({ messages: [...get().messages, message] })
    }
    await get().touchSession(message.sessionId)
  },

  async replaceMessage(message) {
    await putMessage(message)
    set({
      messages: get().messages.map((m) => (m.id === message.id ? message : m)),
    })
  },

  patchMessageLocal(id, patch) {
    set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  },

  removeMessageLocal(id) {
    set({ messages: get().messages.filter((m) => m.id !== id) })
  },

  activeSession() {
    const { sessions, activeSessionId } = get()
    return sessions.find((s) => s.id === activeSessionId) ?? null
  },

  async autoTitleFromMessage(sessionId, content) {
    const session = get().sessions.find((s) => s.id === sessionId)
    if (!session) return
    if (session.title && session.title !== '新的对话' && session.title !== '未命名对话') return
    await get().renameSession(sessionId, previewOf(content, 16))
  },
}))
