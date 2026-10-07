import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SessionList } from '@/components/session-list'
import { MessageBubble, TypingDots } from '@/components/message-bubble'
import { Composer } from '@/components/composer'
import { CharacterPanel } from '@/components/panels/character-panel'
import { MemoryPanel } from '@/components/panels/memory-panel'
import { ContextPanel } from '@/components/panels/context-panel'
import { RoomAmbient } from '@/components/room-ambient'
import { PopNumber } from '@/components/pop-number'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  IconAlert,
  IconBrain,
  IconEdit,
  IconLayers,
  IconMenu,
  IconMessages,
  IconPanelRight,
  IconRefresh,
  IconSettings,
  IconTrash,
  IconUser,
  IconX,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { db } from '@/lib/db'
import { useIsCompact, useIsMobile } from '@/hooks/use-media-query'
import { useCharacterStore } from '@/store/characters'
import type { Character } from '@/lib/types'
import { useSessionStore } from '@/store/sessions'
import { useChatStore } from '@/store/chat'
import { useMemoryStore } from '@/store/memory'
import { useSettingsStore } from '@/store/settings'
import { useUiStore, type RightPanelTab } from '@/store/ui'

export function ChatView() {
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)

  const characters = useCharacterStore((s) => s.characters)
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId)
  const setActiveCharacter = useCharacterStore((s) => s.setActive)
  const createCharacter = useCharacterStore((s) => s.create)

  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const messages = useSessionStore((s) => s.messages)
  const loadSessions = useSessionStore((s) => s.loadSessions)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const createSession = useSessionStore((s) => s.createSession)
  const renameSession = useSessionStore((s) => s.renameSession)
  const removeSession = useSessionStore((s) => s.removeSession)
  const replaceMessage = useSessionStore((s) => s.replaceMessage)
  const removeMessageLocal = useSessionStore((s) => s.removeMessageLocal)

  const streaming = useChatStore((s) => s.streaming)
  const streamingMessageId = useChatStore((s) => s.streamingMessageId)
  const error = useChatStore((s) => s.error)
  const clearError = useChatStore((s) => s.clearError)
  const send = useChatStore((s) => s.send)
  const regenerate = useChatStore((s) => s.regenerate)
  const continueLast = useChatStore((s) => s.continueLast)
  const stop = useChatStore((s) => s.stop)
  const summarizeNow = useChatStore((s) => s.summarizeNow)
  const autoSummarizing = useChatStore((s) => s.autoSummarizing)

  const memoriesByCharacter = useMemoryStore((s) => s.byCharacter)
  const settings = useSettingsStore((s) => s.settings)
  const promptPresets = useSettingsStore((s) => s.promptPresets)
  const updateSettings = useSettingsStore((s) => s.update)

  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useUiStore((s) => s.toggleRightPanel)
  const rightPanelTab = useUiStore((s) => s.rightPanelTab)
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab)
  const memoryUsage = useUiStore((s) => s.memoryUsage)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  // 响应式：窄屏把两侧面板变成抽屉 / 底部面板
  const isMobile = useIsMobile()
  const isCompact = useIsCompact()
  const forcedCompactRef = useRef(false)

  // 首次进入窄屏时收起右栏，之后用户怎么选就怎么保留
  useEffect(() => {
    if (isCompact && !forcedCompactRef.current) {
      forcedCompactRef.current = true
      if (rightPanelOpen) toggleRightPanel()
    }
    if (!isCompact) forcedCompactRef.current = false
  }, [isCompact, rightPanelOpen, toggleRightPanel])

  // 窄屏首次进入、且还没有任何对话时，收起左侧抽屉：
  // 让「小屋」开始页完整露出来，而不是一开就被抽屉盖住
  const autoClosedSidebarRef = useRef(false)
  useEffect(() => {
    if (!isMobile || autoClosedSidebarRef.current) return
    if (sessions.length === 0 && sidebarOpen) {
      autoClosedSidebarRef.current = true
      toggleSidebar()
    }
  }, [isMobile, sessions.length, sidebarOpen, toggleSidebar])

  // 抽屉 / 面板打开时锁住背景滚动
  useEffect(() => {
    if (!isMobile) return
    const open = sidebarOpen || rightPanelOpen
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, sidebarOpen, rightPanelOpen])

  // Esc 关掉最上层的抽屉
  useEffect(() => {
    if (!isMobile) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (rightPanelOpen) toggleRightPanel()
      else if (sidebarOpen) toggleSidebar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile, rightPanelOpen, sidebarOpen, toggleRightPanel, toggleSidebar])

  const activeCharacter = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? null,
    [characters, activeCharacterId],
  )
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )
  const activePreset = useMemo(
    () => settings.presets.find((p) => p.id === settings.activePresetId) ?? settings.presets[0],
    [settings],
  )
  const activePromptPreset = useMemo(
    () => promptPresets.find((p) => p.id === settings.promptPresetId) ?? promptPresets[0],
    [promptPresets, settings.promptPresetId],
  )
  const memories = activeCharacter ? (memoriesByCharacter[activeCharacter.id] ?? []) : []

  /* 1) 切换角色：加载该角色的会话 */
  useEffect(() => {
    if (!activeCharacterId) return
    void loadSessions(activeCharacterId)
  }, [activeCharacterId, loadSessions])

  /* 2) 会话列表变化时，确保有一个选中的会话 */
  useEffect(() => {
    if (!activeCharacterId) return
    if (sessions.length === 0) {
      if (activeSessionId) void setActiveSession(null)
      return
    }
    if (!activeSessionId || !sessions.some((s) => s.id === activeSessionId)) {
      void setActiveSession(sessions[0].id)
    }
  }, [sessions, activeSessionId, activeCharacterId, setActiveSession])

  /* 3) 自动滚动到底部（用户往上翻时暂停） */
  useEffect(() => {
    if (!autoScroll) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, streaming, autoScroll])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAutoScroll(nearBottom)
  }, [])

  const handleNewSession = async () => {
    if (!activeCharacter) {
      const created = await createCharacter()
      await createSession(created.id, '新的对话', created.firstMessage)
      return
    }
    await createSession(activeCharacter.id, '新的对话', activeCharacter.firstMessage)
  }

  const handleSelectCharacter = (id: string) => {
    setActiveCharacter(id)
  }

  const handleEditMessage = async (id: string, content: string) => {
    const target = messages.find((m) => m.id === id)
    if (!target) return
    await replaceMessage({ ...target, content, meta: { ...target.meta, edited: true } })
  }

  /** 表情回应：同一个 emoji 再点一次即取消 */
  const handleReact = async (id: string, emoji: string) => {
    const target = messages.find((m) => m.id === id)
    if (!target) return
    const next = { ...(target.meta?.reactions ?? {}) }
    if (next[emoji]) delete next[emoji]
    else next[emoji] = Date.now()
    await replaceMessage({
      ...target,
      meta: { ...target.meta, reactions: Object.keys(next).length ? next : undefined },
    })
  }

  const handleDeleteMessage = async (id: string) => {
    await db.messages.delete(id)
    removeMessageLocal(id)
  }

  const handleDeleteSession = async () => {
    if (!activeSessionId) return
    await removeSession(activeSessionId)
    setConfirmDelete(false)
  }

  const hasApiKey = Boolean(activePreset?.apiKey?.trim())
  const isLocalEndpoint = /localhost|127\.0\.0\.1/.test(activePreset?.apiBase ?? '')

  /** 右栏内容：窄屏底部面板与宽屏固定侧栏共用 */
  const renderRightPanelBody = () => (
    <>
      <div className={cn('min-h-0 flex-1', rightPanelTab === 'character' && 'flex flex-col')}>
        {rightPanelTab === 'character' && (
          <CharacterPanel
            characters={characters}
            activeCharacterId={activeCharacterId}
            onSelect={handleSelectCharacter}
            onCreate={() => {
              void (async () => {
                const created = await createCharacter()
                await createSession(created.id, '新的对话', created.firstMessage)
              })()
            }}
          />
        )}
        {rightPanelTab === 'memory' && <MemoryPanel character={activeCharacter} compact />}
        {rightPanelTab === 'context' && <ContextPanel character={activeCharacter} />}
      </div>

      {rightPanelTab === 'memory' && (
        <div className="flex items-center gap-1 border-t border-border px-3 py-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            disabled={streaming || !activeSessionId}
            onClick={() => {
              if (activeSessionId) void summarizeNow(activeSessionId)
            }}
          >
            <IconBrain className="h-3.5 w-3.5" /> 立即摘要这一段
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => navigate('/memory')}
          >
            管理
          </Button>
        </div>
      )}

      {rightPanelTab === 'context' && (
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          提示词预设：
          <select
            className="ml-1 rounded border border-input bg-transparent px-1.5 py-0.5 text-[11px]"
            value={settings.promptPresetId}
            onChange={(e) => void updateSettings({ promptPresetId: e.target.value })}
          >
            {promptPresets.map((p) => (
              <option key={p.id} value={p.id} className="bg-card">
                {p.name}
              </option>
            ))}
          </select>
          {activePromptPreset?.template && (
            <span className="ml-1 opacity-70">
              （{activePromptPreset.blocks.identity ? '含身份' : '无身份'}）
            </span>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden">
      {/* 左：会话列表。窄屏是抽屉，≥lg 是固定侧栏 */}
      {isMobile ? (
        sidebarOpen && (
          <>
            <div
              className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={toggleSidebar}
              aria-hidden
            />
            <div className="sheet-panel sheet-panel-left">
              <SessionList
                sessions={sessions}
                characters={characters}
                activeSessionId={activeSessionId}
                onSelect={(id) => void setActiveSession(id)}
                onNew={() => void handleNewSession()}
                onRename={(id, title) => void renameSession(id, title)}
                onDelete={() => setConfirmDelete(true)}
                onOpenSettings={() => navigate('/settings')}
                onOpenImportExport={() => navigate('/data')}
                showNav
                onNavigate={toggleSidebar}
              />
            </div>
          </>
        )
      ) : (
        sidebarOpen && (
          <SessionList
            sessions={sessions}
            characters={characters}
            activeSessionId={activeSessionId}
            onSelect={(id) => void setActiveSession(id)}
            onNew={() => void handleNewSession()}
            onRename={(id, title) => void renameSession(id, title)}
            onDelete={() => setConfirmDelete(true)}
            onOpenSettings={() => navigate('/settings')}
            onOpenImportExport={() => navigate('/data')}
          />
        )
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        {/* 顶部栏 */}
        <header className="flex items-center gap-2 border-b border-border px-2.5 py-2 pt-safe md:px-3 md:py-2.5">
          <Hint label={sidebarOpen ? '收起会话列表' : '会话列表 / 导航'}>
            <Button variant="ghost" size="icon-sm" onClick={toggleSidebar}>
              <IconMenu className="h-4 w-4" />
            </Button>
          </Hint>

          {activeCharacter ? (
            <>
              {/* 手机：头像 + 两行，尽量省空间 */}
              <div className="flex min-w-0 items-center gap-2 md:hidden">
                <Avatar name={activeCharacter.name} src={activeCharacter.avatar} size={26} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold leading-tight">
                    {activeCharacter.name}
                  </div>
                  <div className="truncate text-[10px] leading-tight text-muted-foreground">
                    {activeSession?.title ?? '未选择对话'}
                  </div>
                </div>
              </div>
              {/* ≥sm：完整信息 */}
              <div className="hidden min-w-0 items-center gap-2 md:flex">
                <Avatar name={activeCharacter.name} src={activeCharacter.avatar} size={28} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-tight">
                    {activeCharacter.name}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {activeSession?.title ?? '未选择对话'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">还没有角色</span>
          )}

          <div className="ml-auto flex items-center gap-1">
            {autoSummarizing && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                正在整理记忆…
              </span>
            )}
            {/* 手机上这些入口都在抽屉与右侧面板里，头部只留面板开关 */}
            <div className="hidden items-center gap-1 md:flex">
              <Hint label="切换角色">
                <Button variant="ghost" size="icon-sm" onClick={() => navigate('/characters')}>
                  <IconUser className="h-4 w-4" />
                </Button>
              </Hint>
              <Hint label="编辑当前角色卡">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!activeCharacter}
                  onClick={() => navigate(`/characters/${activeCharacter?.id}`)}
                >
                  <IconEdit className="h-4 w-4" />
                </Button>
              </Hint>
              <Hint label="设置">
                <Button variant="ghost" size="icon-sm" onClick={() => navigate('/settings')}>
                  <IconSettings className="h-4 w-4" />
                </Button>
              </Hint>
            </div>
            <Hint label="角色 / 记忆 / 上下文">
              <Button
                variant={isMobile && rightPanelOpen ? 'secondary' : 'ghost'}
                size="icon-sm"
                onClick={toggleRightPanel}
              >
                <IconPanelRight className="h-4 w-4" />
              </Button>
            </Hint>
          </div>
        </header>

        {/* 未配置提醒 */}
        {!hasApiKey && !isLocalEndpoint && (
          <div className="flex items-center gap-2 border-b border-primary/30 bg-primary/10 px-4 py-2 text-xs">
            <IconAlert className="h-3.5 w-3.5 text-primary" />
            <span className="flex-1">
              还没有填 API Key，聊天会失败。到设置页填好 Base / Key / 模型即可。
            </span>
            <Button size="sm" variant="outline" onClick={() => navigate('/settings')}>
              去设置
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs">
            <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <span className="flex-1 whitespace-pre-wrap break-words">{error}</span>
            <button onClick={clearError} className="text-muted-foreground hover:text-foreground">
              关闭
            </button>
          </div>
        )}

        {/* 消息区 */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2.5 py-3 md:px-6 md:py-4"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
            {messages.length === 0 && !streaming && (
              <div className="relative -mx-2.5 -mt-3 min-h-[64dvh] px-5 pb-10 pt-14 md:-mx-6 md:px-8 md:pt-20">
                <RoomAmbient />

                {/* 左对齐编辑式构图：不做"居中发光圆"那一套（那是 AI 指纹） */}
                <div className="relative mx-auto flex w-full max-w-2xl flex-col">
                  <div className="rise rise-1 flex items-center gap-3.5">
                    <Avatar
                      name={activeCharacter?.name ?? '?'}
                      src={activeCharacter?.avatar}
                      size={52}
                      square
                      className="ring-1 ring-border"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate text-[26px] font-semibold leading-[1.15] tracking-[-0.022em] md:text-[32px]">
                        {activeCharacter ? activeCharacter.name : '还没有角色'}
                      </h2>
                      {activeCharacter?.tags.length ? (
                        <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
                          {activeCharacter.tags.slice(0, 3).join(' · ')}
                        </p>
                      ) : (
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                          {activeCharacter ? '这间屋子已经为你留好了灯。' : '先建一个角色，或导入一张角色卡。'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 开场白：用左侧竖线 + 衬线感行距当台词读，不用卡片框 */}
                  {activeCharacter &&
                    (activeCharacter.firstMessage ? (
                      <figure className="rise rise-2 mt-9 border-l-2 border-primary/45 pl-4 md:pl-5">
                        <figcaption className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          开场白
                        </figcaption>
                        <blockquote className="max-w-[42ch] whitespace-pre-wrap text-[15.5px] leading-[1.85] text-foreground/92">
                          {activeCharacter.firstMessage}
                        </blockquote>
                      </figure>
                    ) : (
                      <p className="rise rise-2 mt-9 text-[13px] text-muted-foreground">
                        还没有写开场白，直接说第一句也开始了。
                      </p>
                    ))}

                  {/* 元信息：一行，靠分隔点而非胶囊堆叠 */}
                  {activeCharacter && (
                    <div className="rise rise-3 mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        在线
                      </span>
                      <span aria-hidden className="text-border">
                        ·
                      </span>
                      <span className="tnum">
                        上下文 <PopNumber value={settings.contextMessageLimit} /> 条
                      </span>
                      {settings.memoryEnabled && memories.length > 0 && (
                        <>
                          <span aria-hidden className="text-border">
                            ·
                          </span>
                          <button
                            onClick={() => navigate('/memory')}
                            className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-primary"
                          >
                            <IconBrain className="h-3 w-3" /> 记得{' '}
                            <PopNumber value={memories.length} /> 件事
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {activeCharacter && (
                    <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-2.5">
                      <Button
                        size="lg"
                        onClick={() => void handleNewSession()}
                        className="cta-primary gap-2 px-6"
                      >
                        <IconMessages className="h-4 w-4" /> 开始对话
                      </Button>
                      <Button
                        size="lg"
                        variant="ghost"
                        className="gap-2 px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate(`/characters/${activeCharacter.id}`)}
                      >
                        <IconEdit className="h-4 w-4" /> 编辑角色卡
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                character={activeCharacter ?? FALLBACK_CHARACTER}
                streaming={streaming && streamingMessageId === message.id}
                usedMemories={memories.filter((m) =>
                  (memoryUsage[message.id] ?? []).includes(m.id),
                )}
                showTokens={settings.showTokenEstimate}
                regenerating={streaming}
                onRegenerate={(id) => void regenerate(id)}
                onEdit={(id, content) => void handleEditMessage(id, content)}
                onDelete={(id) => void handleDeleteMessage(id)}
                onContinue={() => void continueLast()}
                onReact={(id, emoji) => void handleReact(id, emoji)}
              />
            ))}

            {streaming && !streamingMessageId && (
              <div className="flex items-center gap-3 pl-1 text-xs text-muted-foreground">
                <TypingDots />
              </div>
            )}

            {!streaming && messages.length > 0 && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[11px] text-muted-foreground"
                  onClick={() => void continueLast()}
                >
                  <IconRefresh className="h-3 w-3" /> 让 {activeCharacter?.name ?? '角色'} 继续说
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 输入区 */}
        {activeCharacter ? (
          <Composer
            character={activeCharacter}
            streaming={streaming}
            showTokens={settings.showTokenEstimate}
            onSend={(text) => void send(text)}
            onStop={stop}
          />
        ) : (
          <div className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
            先创建一个角色才能开始聊天
          </div>
        )}
      </main>

      {/* 右：角色 / 记忆 / 上下文。窄屏是底部面板，≥xl 是固定侧栏 */}
      {rightPanelOpen &&
        (isCompact ? (
          <>
            <div
              className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={toggleRightPanel}
              aria-hidden
            />
            <div className="sheet-panel">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Tabs
                  value={rightPanelTab}
                  onValueChange={(v) => setRightPanelTab(v as RightPanelTab)}
                  className="min-w-0 flex-1"
                >
                  <TabsList className="h-8 w-full justify-start">
                    <TabsTrigger value="character" className="h-6 gap-1 px-2.5 text-xs">
                      <IconUser className="h-3 w-3" /> 角色
                    </TabsTrigger>
                    <TabsTrigger value="memory" className="h-6 gap-1 px-2.5 text-xs">
                      <IconBrain className="h-3 w-3" /> 记忆
                      {memories.length > 0 && (
                        <span className="text-[10px] opacity-70">{memories.length}</span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="context" className="h-6 gap-1 px-2.5 text-xs">
                      <IconLayers className="h-3 w-3" /> 上下文
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="ghost" size="icon-sm" onClick={toggleRightPanel}>
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden pb-safe">
                {renderRightPanelBody()}
              </div>
            </div>
          </>
        ) : (
          <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card/40">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <Tabs
                value={rightPanelTab}
                onValueChange={(v) => setRightPanelTab(v as RightPanelTab)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="character" className="h-6 gap-1 px-2.5 text-xs">
                    <IconUser className="h-3 w-3" /> 角色
                  </TabsTrigger>
                  <TabsTrigger value="memory" className="h-6 gap-1 px-2.5 text-xs">
                    <IconBrain className="h-3 w-3" /> 记忆
                    {memories.length > 0 && (
                      <span className="text-[10px] opacity-70">{memories.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="context" className="h-6 gap-1 px-2.5 text-xs">
                    <IconLayers className="h-3 w-3" /> 上下文
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Hint label="收起">
                <Button variant="ghost" size="icon-sm" onClick={toggleRightPanel}>
                  <IconX className="h-4 w-4" />
                </Button>
              </Hint>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">{renderRightPanelBody()}</div>
          </aside>
        ))}

      {/* 删除会话确认 */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconTrash className="h-4 w-4 text-destructive" /> 删除这个对话？
            </DialogTitle>
            <DialogDescription>
              该对话的所有消息会一起删除，且无法撤销。角色卡和记忆不受影响。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteSession()}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const FALLBACK_CHARACTER: Character = {
  id: 'fallback',
  name: '角色',
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
  createdAt: 0,
  updatedAt: 0,
}
