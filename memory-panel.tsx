import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Hint } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  IconBrain,
  IconCheck,
  IconEdit,
  IconEyeOff,
  IconPlus,
  IconSave,
  IconSearch,
  IconSettings,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconX,
} from '@/components/icons'
import { cn, formatDate } from '@/lib/utils'
import { importanceLabel, memoryTypeLabel } from '@/services/memory'
import type { Character, Memory, MemoryType } from '@/lib/types'
import { useMemoryStore } from '@/store/memory'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'

interface MemoryPanelProps {
  character: Character | null
  compact?: boolean
}

const TYPES: MemoryType[] = ['fact', 'preference', 'event', 'relation', 'other']

export function MemoryPanel({ character, compact }: MemoryPanelProps) {
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.update)
  const memories = useMemoryStore((s) => (character ? (s.byCharacter[character.id] ?? []) : []))
  const createManual = useMemoryStore((s) => s.createManual)
  const updateMemory = useMemoryStore((s) => s.update)
  const removeMemory = useMemoryStore((s) => s.remove)
  const showToast = useUiStore((s) => s.showToast)

  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [draftType, setDraftType] = useState<MemoryType>('fact')
  const [draftImportance, setDraftImportance] = useState(3)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? memories.filter((m) => m.content.toLowerCase().includes(q)) : memories
    return compact ? list.slice(0, 8) : list
  }, [memories, query, compact])

  const stats = useMemo(
    () => ({
      total: memories.length,
      pinned: memories.filter((m) => m.pinned).length,
      auto: memories.filter((m) => m.source === 'auto').length,
    }),
    [memories],
  )

  const submit = async () => {
    const content = draft.trim()
    if (!content || !character) return
    await createManual(character.id, content, {
      type: draftType,
      importance: draftImportance,
    })
    setDraft('')
    showToast('已添加记忆', 'success')
  }

  if (!character) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
        先选择一个角色，才能查看它的记忆
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <IconBrain className="h-3.5 w-3.5" /> 记忆
          <span className="text-[10px] opacity-70">
            {stats.total} 条{stats.pinned ? ` · ${stats.pinned} 置顶` : ''}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <Hint label={settings.memoryEnabled ? '记忆注入已开启' : '记忆注入已关闭'}>
            <Switch
              checked={settings.memoryEnabled}
              onCheckedChange={(v) => updateSettings({ memoryEnabled: v })}
            />
          </Hint>
          <Hint label="记忆管理页">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate('/memory')}>
              <IconSettings className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索记忆"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="rounded-lg border border-input bg-card p-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`记一条关于你的事，例如：我不吃香菜（会注入给 ${character.name}）`}
            className="min-h-[52px] border-0 bg-transparent p-1 text-xs shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void submit()
              }
            }}
          />
          <div className="flex items-center gap-1.5 pt-1">
            <Select value={draftType} onValueChange={(v) => setDraftType(v as MemoryType)}>
              <SelectTrigger className="h-7 w-[5.5rem] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {memoryTypeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(draftImportance)}
              onValueChange={(v) => setDraftImportance(Number(v))}
            >
              <SelectTrigger className="h-7 w-[5rem] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {importanceLabel(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="ml-auto h-7" onClick={submit} disabled={!draft.trim()}>
              <IconPlus className="h-3.5 w-3.5" /> 添加
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin border-t border-border px-3 py-2">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {memories.length === 0
              ? '还没有记忆。手动添加，或每 10 轮自动摘要。'
              : '没有匹配的记忆'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((m: Memory) => {
              const disabled = m.enabled === false
              return (
                <li
                  key={m.id}
                  className={cn(
                    'group rounded-lg border border-border/70 bg-card/60 p-2 transition-colors hover:border-border',
                    disabled && 'opacity-50',
                  )}
                >
                  {editingId === m.id ? (
                    <div className="space-y-1.5">
                      <Textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        className="min-h-[52px] text-xs"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => setEditingId(null)}
                        >
                          <IconX className="h-3 w-3" /> 取消
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={async () => {
                            const content = editDraft.trim()
                            if (content) await updateMemory(m.id, { content, source: m.source })
                            setEditingId(null)
                          }}
                        >
                          <IconSave className="h-3 w-3" /> 保存
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-1.5">
                        <button
                          onClick={() => updateMemory(m.id, { pinned: !m.pinned })}
                          title={m.pinned ? '取消置顶' : '置顶（一定注入）'}
                          className={cn(
                            'mt-0.5 shrink-0 transition-colors',
                            m.pinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {m.pinned ? (
                            <IconStarFilled className="h-3.5 w-3.5" />
                          ) : (
                            <IconStar className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs leading-5">
                          {m.content}
                        </p>
                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5 pl-5">
                        <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                          {memoryTypeLabel(m.type)}
                        </Badge>
                        <span className="text-[10px] text-primary/80">
                          {importanceLabel(m.importance)}
                        </span>
                        {m.source === 'auto' && (
                          <span className="text-[10px] text-muted-foreground">自动</span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(m.createdAt)}
                        </span>

                        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Hint label={disabled ? '启用' : '停用'}>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-6 w-6"
                              onClick={() => updateMemory(m.id, { enabled: disabled })}
                            >
                              {disabled ? (
                                <IconCheck className="h-3.5 w-3.5" />
                              ) : (
                                <IconEyeOff className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </Hint>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingId(m.id)
                              setEditDraft(m.content)
                            }}
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeMemory(m.id)}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {compact && memories.length > filtered.length && (
        <div className="border-t border-border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => navigate('/memory')}
          >
            查看全部 {memories.length} 条记忆
          </Button>
        </div>
      )}
    </div>
  )
}
