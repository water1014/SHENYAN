import { create } from 'zustand'

export type RightPanelTab = 'character' | 'memory' | 'context'

interface UiState {
  /** 左侧会话列表是否展开 */
  sidebarOpen: boolean
  /** 右侧面板是否展开 */
  rightPanelOpen: boolean
  rightPanelTab: RightPanelTab
  /** 生成中使用过的记忆 id：messageId -> memoryIds */
  memoryUsage: Record<string, string[]>
  /** 某个会话里被"忘记"的消息 id（重新生成后旧的后续消息不再进上下文） */
  excluded: Record<string, string[]>
  /** 全局提示 */
  toast: { id: number; text: string; tone: 'info' | 'success' | 'error' } | null

  toggleSidebar: () => void
  setSidebar: (open: boolean) => void
  toggleRightPanel: () => void
  setRightPanelTab: (tab: RightPanelTab) => void
  recordMemoryUsage: (messageId: string, ids: string[]) => void
  clearMemoryUsage: (messageId: string) => void
  excludeMessages: (sessionId: string, ids: string[]) => void
  resetExcluded: (sessionId: string) => void
  excludedIn: (sessionId: string) => string[]
  showToast: (text: string, tone?: 'info' | 'success' | 'error') => void
  dismissToast: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: true,
  rightPanelOpen: true,
  rightPanelTab: 'character',
  memoryUsage: {},
  excluded: {},
  toast: null,

  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebar: (open) => set({ sidebarOpen: open }),
  toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),

  recordMemoryUsage(messageId, ids) {
    set({ memoryUsage: { ...get().memoryUsage, [messageId]: ids } })
  },
  clearMemoryUsage(messageId) {
    const next = { ...get().memoryUsage }
    delete next[messageId]
    set({ memoryUsage: next })
  },

  excludeMessages(sessionId, ids) {
    const prev = get().excluded[sessionId] ?? []
    set({ excluded: { ...get().excluded, [sessionId]: Array.from(new Set([...prev, ...ids])) } })
  },
  resetExcluded(sessionId) {
    const next = { ...get().excluded }
    delete next[sessionId]
    set({ excluded: next })
  },
  excludedIn(sessionId) {
    return get().excluded[sessionId] ?? []
  },

  showToast(text, tone = 'info') {
    set({ toast: { id: Date.now(), text, tone } })
  },
  dismissToast: () => set({ toast: null }),
}))
