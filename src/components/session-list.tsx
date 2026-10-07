import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/avatar'
import { Hint } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  IconBrain,
  IconDatabase,
  IconEdit,
  IconMore,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTrash,
  IconUser,
} from '@/components/icons'
import { cn, formatDate } from '@/lib/utils'
import type { Character, Session } from '@/lib/types'

interface SessionListProps {
  sessions: Session[]
  characters: Character[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
  onOpenImportExport: () => void
  /** 窄屏抽屉里才显示完整导航 */
  showNav?: boolean
  /** 点完一项后关掉抽屉 */
  onNavigate?: () => void
}

const DRAWER_NAV = [
  { to: '/characters', label: '角色管理', icon: IconUser },
  { to: '/memory', label: '记忆管理', icon: IconBrain },
  { to: '/data', label: '导入导出', icon: IconDatabase },
  { to: '/settings', label: '设置', icon: IconSettings },
]

export function SessionList({
  sessions,
  characters,
  activeSessionId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onOpenSettings,
  onOpenImportExport,
  showNav,
  onNavigate,
}: SessionListProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  const charMap = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((s) => {
      const name = charMap.get(s.characterId)?.name ?? ''
      return s.title.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    })
  }, [sessions, query, charMap])

  const startRename = (session: Session) => {
    setRenamingId(session.id)
    setDraftTitle(session.title)
  }

  const commitRename = () => {
    if (renamingId) onRename(renamingId, draftTitle)
    setRenamingId(null)
  }

  const go = (to: string) => {
    navigate(to)
    onNavigate?.()
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card/40 lg:w-64 lg:shrink-0">
      <div className="flex items-center gap-2 px-3 py-3 pt-safe">
        <Button className="flex-1 justify-start gap-2" size="sm" onClick={onNew}>
          <IconPlus className="h-4 w-4" /> 新的对话
        </Button>
      </div>

      {showNav && (
        <div className="grid grid-cols-2 gap-1.5 border-b border-border px-3 pb-3">
          {DRAWER_NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.to}
                onClick={() => go(item.to)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs text-muted-foreground transition-colors active:bg-accent"
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="px-3 pb-2">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索对话或角色"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {query ? '没有匹配的对话' : '还没有对话，点上面「新的对话」开始'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((session) => {
              const character = charMap.get(session.characterId)
              const active = session.id === activeSessionId
              return (
                <li key={session.id}>
                  {renamingId === session.id ? (
                    <div className="flex items-center gap-1 rounded-lg bg-accent/60 p-1.5">
                      <Input
                        autoFocus
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        className="h-7 text-xs"
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={commitRename}>
                        好
                      </Button>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        onSelect(session.id)
                        onNavigate?.()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onSelect(session.id)
                      }}
                      className={cn(
                        'group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                      )}
                    >
                      <Avatar name={character?.name ?? '?'} src={character?.avatar} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{session.title}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatDate(session.lastMessageAt)}
                          </span>
                        </div>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {character?.name ?? '已删除的角色'}
                        </span>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-background/70 group-hover:opacity-100"
                          >
                            <IconMore className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              startRename(session)
                            }}
                          >
                            <IconEdit className="h-4 w-4" /> 重命名
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDelete(session.id)
                            }}
                          >
                            <IconTrash className="h-4 w-4" /> 删除对话
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-2 pb-safe">
        <Hint label="设置（API / 提示词）">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2"
            onClick={() => {
              onOpenSettings()
              onNavigate?.()
            }}
          >
            <IconSettings className="h-3.5 w-3.5" /> 设置
          </Button>
        </Hint>
        <Hint label="导入导出 / 自动备份">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2"
            onClick={() => {
              onOpenImportExport()
              onNavigate?.()
            }}
          >
            <IconDatabase className="h-3.5 w-3.5" /> 备份
          </Button>
        </Hint>
      </div>
    </aside>
  )
}
