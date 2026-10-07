import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/avatar'
import { RoomAmbient } from '@/components/room-ambient'
import { PopNumber } from '@/components/pop-number'
import { ChatHeatmap } from '@/components/chat-heatmap'
import { Button } from '@/components/ui/button'
import { IconChevronRight, IconMessages, IconSparkles } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useCharacterStore } from '@/store/characters'
import { useMemoryStore } from '@/store/memory'
import { useSessionStore } from '@/store/sessions'
import { db } from '@/lib/db'

/** 在一起的天数：从角色创建那天算起。当天算第 1 天，避免新装时显示 0 很打击人 */
function daysSince(ts: number): number {
  const start = new Date(ts)
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000) + 1)
}

/** 今天聊了多少条 —— 用 createdAt 落在今天的消息数 */
function useTodayStats(sessionIds: string[]) {
  const [stats, setStats] = useState<{ today: number; total: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (sessionIds.length === 0) {
      setStats({ today: 0, total: 0 })
      return
    }
    void (async () => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const rows = await db.messages.where('sessionId').anyOf(sessionIds).toArray()
      if (cancelled) return
      const today = rows.filter((m) => m.createdAt >= start.getTime()).length
      setStats({ today, total: rows.length })
    })()
    return () => {
      cancelled = true
    }
  }, [sessionIds])

  return stats
}

export function Home() {
  const navigate = useNavigate()
  const characters = useCharacterStore((s) => s.characters)
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId)
  const sessions = useSessionStore((s) => s.sessions)
  const memoriesByCharacter = useMemoryStore((s) => s.byCharacter)

  const character = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )
  const memories = character ? (memoriesByCharacter[character.id] ?? []) : []
  const charSessions = useMemo(
    () => sessions.filter((s) => s.characterId === character?.id),
    [sessions, character],
  )
  const sessionIds = useMemo(() => charSessions.map((s) => s.id), [charSessions])
  const stats = useTodayStats(sessionIds)

  const days = character ? daysSince(character.createdAt) : 0
  // 最后一条角色消息，当作「今天的留言」来展示
  const lastSession = charSessions[0]

  if (!character) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <RoomAmbient />
        <p className="relative text-sm text-muted-foreground">
          还没有角色。建一个，这间屋子就有主人了。
        </p>
        <Button className="cta-primary relative" onClick={() => navigate('/characters')}>
          去创建角色
        </Button>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-y-auto scrollbar-thin">
      <RoomAmbient />

      <div className="relative mx-auto w-full max-w-2xl px-5 pb-28 pt-10 md:pt-16">
        {/* 关系天数：这一屏的视觉主角 */}
        <header className="rise rise-1 flex flex-col items-start">
          <div className="flex items-center gap-3">
            <Avatar name={character.name} src={character.avatar} size={44} square className="ring-1 ring-border" />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-tight">{character.name}</div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                {character.addressUser ? `称呼你「${character.addressUser}」` : '在等你说话'}
              </div>
            </div>
          </div>

          <div className="mt-10 flex items-baseline gap-3">
            <span className="tnum text-[56px] font-semibold leading-[0.9] tracking-[-0.04em] md:text-[72px]">
              <PopNumber value={days} />
            </span>
            <span className="pb-1 text-[12.5px] leading-snug text-muted-foreground">
              DAY
              <br />
              在一起
            </span>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            自 {new Date(character.createdAt).toLocaleDateString('zh-CN')} 起 · 第 {days} 天
          </p>
        </header>

        {/* 今天的留言：把角色最近一句当成留言读，比"开始对话"更有情感 */}
        {character.firstMessage && (
          <section className="rise rise-2 mt-10 rounded-[var(--r-panel)] border border-border bg-card/70 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <IconSparkles className="h-3 w-3" />
              {character.name} 说
            </div>
            <p className="max-w-[46ch] whitespace-pre-wrap text-[13.5px] leading-[1.8] text-foreground/90">
              {character.firstMessage}
            </p>
          </section>
        )}

        {/* 状态一行：今天聊了多少、记得多少事 */}
        <section className="rise rise-3 mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--r-panel)] border border-border bg-card/50 p-3.5 backdrop-blur-sm">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">今天</div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="tnum text-[26px] font-semibold leading-none">
                <PopNumber value={stats?.today ?? 0} />
              </span>
              <span className="text-[11.5px] text-muted-foreground">条消息</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/memory')}
            className="group rounded-[var(--r-panel)] border border-border bg-card/50 p-3.5 text-left backdrop-blur-sm transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              记忆
              <IconChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className="tnum text-[26px] font-semibold leading-none">
                <PopNumber value={memories.length} />
              </span>
              <span className="text-[11.5px] text-muted-foreground">件事</span>
            </div>
          </button>
        </section>

        {/* 聊天热力：颜色越深聊得越多。没有会话时也显示，起「还没开始聊」的提示作用 */}
        <ChatHeatmap sessionIds={sessionIds} className="rise rise-4 mt-8" />

        {/* 继续对话 */}
        <section className="rise rise-4 mt-8">
          <Button
            className="cta-primary h-12 w-full gap-2 text-[15px]"
            onClick={() => navigate('/')}
          >
            <IconMessages className="h-4 w-4" />
            {lastSession ? `继续和 ${character.name} 说话` : '开始第一次对话'}
          </Button>

          {charSessions.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  最近的对话
                </span>
                <button
                  onClick={() => navigate('/')}
                  className="text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                >
                  全部 {charSessions.length} 个
                </button>
              </div>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-[var(--r-panel)] border border-border bg-card/40">
                {charSessions.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => navigate('/')}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-accent/40"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]">{s.title}</span>
                      <span className="tnum shrink-0 text-[11px] text-muted-foreground">
                        {new Date(s.lastMessageAt).toLocaleDateString('zh-CN')}
                      </span>
                      <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 生活模块：本阶段只列入口，不做实现。
            窄屏用 2 列，避免 3 列把标签挤到贴边 */}
        <section className="rise rise-5 mt-9">
          <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            还在路上
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[
              { label: '日记本', icon: '📓' },
              { label: '留言板', icon: '💬' },
              { label: '相册墙', icon: '🖼' },
              { label: '待办', icon: '✅' },
              { label: '心情', icon: '🌙' },
              { label: '券包', icon: '🎟' },
            ].map((m) => (
              <div
                key={m.label}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-[var(--r-panel)] border border-dashed border-border/80 px-2 py-3.5',
                  'text-[11px] text-muted-foreground',
                )}
                title="后续版本实现"
              >
                <span className="text-base opacity-60" aria-hidden>
                  {m.icon}
                </span>
                {m.label}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
