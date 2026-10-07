import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar } from '@/components/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  IconBrain,
  IconCheck,
  IconDownload,
  IconEyeOff,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconX,
} from '@/components/icons'
import { cn, downloadJson, formatDateTime } from '@/lib/utils'
import { importanceLabel, memoryTypeLabel } from '@/services/memory'
import { useCharacterStore } from '@/store/characters'
import { useMemoryStore } from '@/store/memory'
import { useSessionStore } from '@/store/sessions'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import type { Memory, MemoryType } from '@/lib/types'

const TYPES: MemoryType[] = ['fact', 'preference', 'event', 'relation', 'other']

export function MemoryManager() {
  const characters = useCharacterStore((s) => s.characters)
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId)
  const setActiveCharacter = useCharacterStore((s) => s.setActive)
  const byCharacter = useMemoryStore((s) => s.byCharacter)
  const load = useMemoryStore((s) => s.load)
  const createManual = useMemoryStore((s) => s.createManual)
  const updateMemory = useMemoryStore((s) => s.update)
  const removeMemory = useMemoryStore((s) => s.remove)
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const summarizeNow = useChatStore((s) => s.summarizeNow)
  const streaming = useChatStore((s) => s.streaming)
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.update)
  const showToast = useUiStore((s) => s.showToast)

  const [characterId, setCharacterId] = useState(activeCharacterId ?? '')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<MemoryType | 'all'>('all')
  const [draft, setDraft] = useState('')
  const [draftType, setDraftType] = useState<MemoryType>('fact')
  const [draftImportance, setDraftImportance] = useState(3)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [confirmClearAuto, setConfirmClearAuto] = useState(false)

  useEffect(() => {
    if (!characterId && characters[0]) setCharacterId(characters[0].id)
  }, [characters, characterId])

  useEffect(() => {
    if (characterId) void load(characterId)
  }, [characterId, load])

  const character = characters.find((c) => c.id === characterId) ?? null
  const memories = byCharacter[characterId] ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return memories.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false
      if (q && !m.content.toLowerCase().includes(q)) return false
      return true
    })
  }, [memories, query, typeFilter])

  const stats = useMemo(
    () => ({
      total: memories.length,
      pinned: memories.filter((m) => m.pinned).length,
      auto: memories.filter((m) => m.source === 'auto').length,
      disabled: memories.filter((m) => m.enabled === false).length,
    }),
    [memories],
  )

  const characterSessions = sessions.filter((s) => s.characterId === characterId)
  const targetSession = characterSessions.find((s) => s.id === activeSessionId) ?? characterSessions[0]

  const add = async () => {
    const content = draft.trim()
    if (!content || !characterId) return
    await createManual(characterId, content, { type: draftType, importance: draftImportance })
    setDraft('')
    showToast('已添加', 'success')
  }

  const clearAuto = async () => {
    const auto = memories.filter((m) => m.source === 'auto')
    for (const m of auto) await removeMemory(m.id)
    setConfirmClearAuto(false)
    showToast(`已删除 ${auto.length} 条自动记忆`, 'success')
  }

  if (characters.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        还没有角色，先去创建一个
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-4xl space-y-5 px-3.5 py-5 pb-24 sm:px-5 sm:py-6 xl:pb-6">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <IconBrain className="h-5 w-5 text-primary" /> 记忆管理
          </h1>
          <p className="text-xs text-muted-foreground">
            置顶的记忆每次对话都会注入；其余按重要度取前 {settings.memoryInjectLimit} 条。
          </p>
        </header>

        {/* 角色选择 */}
        <div className="flex flex-wrap items-center gap-2">
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCharacterId(c.id)
                setActiveCharacter(c.id)
              }}
              className={cn(
                'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors',
                c.id === characterId
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border hover:bg-accent/60',
              )}
            >
              <Avatar name={c.name} src={c.avatar} size={22} />
              <span className="max-w-[8rem] truncate">{c.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {(byCharacter[c.id] ?? []).length}
              </span>
            </button>
          ))}
        </div>

        {/* 统计与开关 */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4 text-xs">
            <span className="flex items-center gap-1.5">
              <Badge variant="muted">{stats.total} 条</Badge>
              <Badge variant="secondary">{stats.pinned} 置顶</Badge>
              <Badge variant="secondary">{stats.auto} 自动</Badge>
              {stats.disabled > 0 && <Badge variant="outline">{stats.disabled} 已停用</Badge>}
            </span>

            <span className="ml-auto flex items-center gap-2">
              <Label className="text-xs">记忆注入</Label>
              <Switch
                checked={settings.memoryEnabled}
                onCheckedChange={(v) => void updateSettings({ memoryEnabled: v })}
              />
            </span>

            <span className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={streaming || !targetSession}
                title={targetSession ? `摘要「${targetSession.title}」` : '该角色还没有会话'}
                onClick={() => {
                  if (targetSession) void summarizeNow(targetSession.id)
                }}
              >
                <IconSparkles className="h-3.5 w-3.5" /> 立即摘要当前会话
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={memories.length === 0}
                onClick={() => {
                  downloadJson(`memories-${character?.name ?? 'character'}.json`, memories)
                }}
              >
                <IconDownload className="h-3.5 w-3.5" /> 导出
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={stats.auto === 0}
                onClick={() => setConfirmClearAuto(true)}
              >
                <IconTrash className="h-3.5 w-3.5" /> 清理自动记忆
              </Button>
            </span>
          </CardContent>
        </Card>

        {/* 新增 */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`手动记一条关于你和 ${character?.name ?? '角色'} 的事，例如：我下周三要面试，很紧张`}
              className="min-h-[64px] text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void add()
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value as MemoryType)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t} className="bg-card">
                    {memoryTypeLabel(t)}
                  </option>
                ))}
              </select>
              <select
                value={String(draftImportance)}
                onChange={(e) => setDraftImportance(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={String(n)} className="bg-card">
                    重要度 {importanceLabel(n)}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">Ctrl+Enter 快速添加</span>
              <Button size="sm" className="ml-auto" onClick={() => void add()} disabled={!draft.trim()}>
                <IconPlus className="h-3.5 w-3.5" /> 添加记忆
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 筛选 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索记忆内容"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(['all', ...TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                  typeFilter === t
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border hover:bg-accent/60',
                )}
              >
                {t === 'all' ? '全部' : memoryTypeLabel(t)}
              </button>
            ))}
          </div>
        </div>

        {/* 列表 */}
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {memories.length === 0
              ? '还没有记忆。手动添加几条，或者聊满设定的轮数后自动摘要。'
              : '没有符合条件的记忆'}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((m: Memory) => (
              <li
                key={m.id}
                className={cn(
                  'group rounded-lg border border-border bg-card p-3',
                  m.enabled === false && 'opacity-55',
                )}
              >
                {editing?.id === m.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editing.text}
                      onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                      className="min-h-[64px] text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        <IconX className="h-3.5 w-3.5" /> 取消
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const content = editing.text.trim()
                          if (content) void updateMemory(m.id, { content })
                          setEditing(null)
                        }}
                      >
                        <IconCheck className="h-3.5 w-3.5" /> 保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => void updateMemory(m.id, { pinned: !m.pinned })}
                        className={cn(
                          'mt-0.5',
                          m.pinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                        )}
                        title={m.pinned ? '取消置顶' : '置顶'}
                      >
                        {m.pinned ? (
                          <IconStarFilled className="h-4 w-4" />
                        ) : (
                          <IconStar className="h-4 w-4" />
                        )}
                      </button>
                      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6">
                        {m.content}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-6 text-[11px] text-muted-foreground">
                      <Badge variant="muted" className="text-[10px]">
                        {memoryTypeLabel(m.type)}
                      </Badge>
                      <select
                        value={String(m.importance)}
                        onChange={(e) =>
                          void updateMemory(m.id, { importance: Number(e.target.value) })
                        }
                        className="h-6 rounded border border-input bg-transparent px-1 text-[10px]"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={String(n)} className="bg-card">
                            {importanceLabel(n)}
                          </option>
                        ))}
                      </select>
                      <select
                        value={m.type}
                        onChange={(e) => void updateMemory(m.id, { type: e.target.value as MemoryType })}
                        className="h-6 rounded border border-input bg-transparent px-1 text-[10px]"
                      >
                        {TYPES.map((t) => (
                          <option key={t} value={t} className="bg-card">
                            {memoryTypeLabel(t)}
                          </option>
                        ))}
                      </select>
                      {m.source === 'auto' && <span>自动摘要</span>}
                      <span>{formatDateTime(m.createdAt)}</span>

                      <span className="ml-auto flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => void updateMemory(m.id, { enabled: m.enabled === false })}
                        >
                          {m.enabled === false ? (
                            <>
                              <IconCheck className="h-3 w-3" /> 启用
                            </>
                          ) : (
                            <>
                              <IconEyeOff className="h-3 w-3" /> 停用
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setEditing({ id: m.id, text: m.content })}
                        >
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] text-destructive"
                          onClick={() => void removeMemory(m.id)}
                        >
                          删除
                        </Button>
                      </span>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={confirmClearAuto} onOpenChange={setConfirmClearAuto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>清理 {stats.auto} 条自动摘要记忆？</DialogTitle>
            <DialogDescription>
              只删除 source 为「自动摘要」的记忆，手动添加的会保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmClearAuto(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void clearAuto()}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
