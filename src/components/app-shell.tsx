import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toast'
import { Avatar } from '@/components/avatar'
import {
  IconBrain,
  IconDatabase,
  IconHome,
  IconMessages,
  IconMoon,
  IconSettings,
  IconSun,
  IconUser,
} from '@/components/icons'
import { BottomNav } from '@/components/bottom-nav'
import { cn } from '@/lib/utils'
import { scheduleAutoBackup, useSettingsStore } from '@/store/settings'
import { useCharacterStore } from '@/store/characters'
import { useMemoryStore } from '@/store/memory'
import { useSessionStore } from '@/store/sessions'
import { useChatStore } from '@/store/chat'
import { createAutoBackup, listAutoBackups, pruneAutoBackups } from '@/services/backup'
import { requestPersistentStorage } from '@/lib/db'

const NAV = [
  { to: '/home', label: '首页', icon: IconHome },
  { to: '/', label: '聊天', icon: IconMessages },
  { to: '/characters', label: '角色', icon: IconUser },
  { to: '/memory', label: '记忆', icon: IconBrain },
  { to: '/data', label: '数据', icon: IconDatabase },
]

export function AppShell() {
  const location = useLocation()
  const [ready, setReady] = useState(false)

  const loaded = useSettingsStore((s) => s.loaded)
  const initSettings = useSettingsStore((s) => s.init)
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.update)

  const initCharacters = useCharacterStore((s) => s.init)
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId)
  const activeCharacter = useCharacterStore((s) =>
    s.characters.find((c) => c.id === s.activeCharacterId),
  )

  const loadMemories = useMemoryStore((s) => s.load)
  const loadSessions = useSessionStore((s) => s.loadSessions)

  /* 1) 启动：读设置 + 角色，首次使用自动种入示例角色 */
  useEffect(() => {
    void (async () => {
      await initSettings()
      await initCharacters()
      setReady(true)
      void requestPersistentStorage()
      // 距上次快照太久就补一份
      const minutes = useSettingsStore.getState().settings.autoBackupMinutes
      if (minutes > 0) {
        const list = await listAutoBackups()
        const last = list[0]?.createdAt ?? 0
        if (Date.now() - last > minutes * 60_000) {
          await createAutoBackup()
          await pruneAutoBackups(useSettingsStore.getState().settings.autoBackupKeep)
        }
      }
    })()
  }, [initSettings, initCharacters])

  /* 2) 角色变化 → 载入该角色的会话与记忆 */
  useEffect(() => {
    if (!ready || !activeCharacterId) return
    void loadSessions(activeCharacterId)
    void loadMemories(activeCharacterId)
  }, [ready, activeCharacterId, loadSessions, loadMemories])

  /* 3) 自动备份定时器 */
  useEffect(() => {
    if (!ready) return
    scheduleAutoBackup(
      () => useSettingsStore.getState().settings.autoBackupMinutes,
      () => useSettingsStore.getState().settings.autoBackupKeep,
    )
    return () => scheduleAutoBackup(() => 0, () => 1)
  }, [ready, settings.autoBackupMinutes, settings.autoBackupKeep])

  /* 4) 主题 */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  /* 5) 正在流式生成时刷新/关标签页给个提醒 */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!useChatStore.getState().streaming) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (!loaded || !ready) {
    return (
      // 骨架屏：与最终布局同形，条块带一次性脉冲；数据到了由内容淡入接管
      <div className="flex h-full flex-col" aria-busy="true" aria-label="正在读取本地数据">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="t-skeleton-bar h-6 w-6 rounded-md bg-secondary" />
          <div className="t-skeleton-bar h-3 w-24 rounded bg-secondary" />
          <div className="ml-auto t-skeleton-bar h-6 w-28 rounded bg-secondary/60" />
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-64 shrink-0 flex-col gap-2 border-r border-border p-3 lg:flex">
            <div className="t-skeleton-bar h-8 w-full rounded-[var(--r-control)] bg-secondary" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2.5 p-2">
                <div className="t-skeleton-bar h-7 w-7 shrink-0 rounded-md bg-secondary" />
                <div className="flex-1 space-y-1.5">
                  <div
                    className="t-skeleton-bar h-2.5 rounded bg-secondary"
                    style={{ width: `${68 - i * 9}%` }}
                  />
                  <div
                    className="t-skeleton-bar h-2 rounded bg-secondary/60"
                    style={{ width: `${44 - i * 6}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="t-reveal flex min-w-0 flex-1 flex-col items-start gap-4 px-5 pt-16">
            <div className="t-skeleton-bar h-2.5 w-16 rounded bg-secondary/60" />
            <div className="t-skeleton-bar h-7 w-36 rounded bg-secondary" />
            <div className="mt-5 space-y-2.5">
              <div className="t-skeleton-bar h-2.5 w-72 max-w-full rounded bg-secondary/70" />
              <div className="t-skeleton-bar h-2.5 w-60 max-w-full rounded bg-secondary/60" />
              <div className="t-skeleton-bar h-2.5 w-44 max-w-full rounded bg-secondary/50" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card/50 px-3 pt-safe md:gap-3 md:px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
              伴
            </span>
            <span className="hidden text-sm font-semibold md:inline">AI 伴侣</span>
          </div>

          {/* ≥sm 才显示顶栏导航；手机上导航在会话抽屉里 */}
          <nav className="ml-2 hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => {
              const Icon = item.icon
              const active =
                item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </NavLink>
              )
            })}
          </nav>

          {/* 手机上：当前页面名 + 回聊天 */}
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            {location.pathname !== '/' && (
              <span className="truncate text-xs text-muted-foreground">
                {NAV.find((n) => n.to !== '/' && location.pathname.startsWith(n.to))?.label ?? ''}
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            {activeCharacter && (
              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
                <Avatar name={activeCharacter.name} src={activeCharacter.avatar} size={20} />
                {activeCharacter.name}
              </span>
            )}
            {location.pathname !== '/' && (
              <Button variant="ghost" size="icon-sm" asChild>
                <NavLink to="/" title="回到聊天">
                  <IconMessages className="h-4 w-4" />
                </NavLink>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
              title={settings.theme === 'dark' ? '切到浅色' : '切到深色'}
            >
              {settings.theme === 'dark' ? (
                <IconSun className="h-4 w-4" />
              ) : (
                <IconMoon className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon-sm" asChild title="设置">
              <NavLink to="/settings">
                <IconSettings className="h-4 w-4" />
              </NavLink>
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <Outlet />
        </div>

        {/* 底部导航：窄屏与平板用；聊天页自带输入区，所以那里不显示，避免和输入框打架 */}
        {location.pathname !== '/' && <BottomNav />}

        <Toaster />
      </div>
    </TooltipProvider>
  )
}
