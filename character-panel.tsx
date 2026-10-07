import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Hint } from '@/components/ui/tooltip'
import {
  IconBook,
  IconEdit,
  IconPlus,
  IconSettings,
  IconSparkles,
  IconUser,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import type { Character } from '@/lib/types'

interface CharacterPanelProps {
  characters: Character[]
  activeCharacterId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-foreground/90">{value}</p>
    </div>
  )
}

export function CharacterPanel({
  characters,
  activeCharacterId,
  onSelect,
  onCreate,
}: CharacterPanelProps) {
  const navigate = useNavigate()
  const active = characters.find((c) => c.id === activeCharacterId) ?? null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <IconUser className="h-3.5 w-3.5" /> 角色
        </span>
        <div className="flex items-center gap-1">
          <Hint label="新建角色">
            <Button variant="ghost" size="icon-sm" onClick={onCreate}>
              <IconPlus className="h-3.5 w-3.5" />
            </Button>
          </Hint>
          <Hint label="角色管理">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate('/characters')}>
              <IconSettings className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs transition-colors',
                c.id === activeCharacterId
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-border hover:bg-accent/60',
              )}
            >
              <Avatar name={c.name} src={c.avatar} size={20} />
              <span className="max-w-[5.5rem] truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin border-t border-border px-3 py-3">
        {!active ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            还没有角色。新建一个，或到角色管理里导入角色卡。
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Avatar name={active.name} src={active.avatar} size={48} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{active.name}</div>
                {active.addressUser && (
                  <div className="text-[11px] text-muted-foreground">
                    称呼你为「{active.addressUser}」
                    {active.selfName ? ` · 自称「${active.selfName}」` : ''}
                  </div>
                )}
                {active.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {active.tags.map((t) => (
                      <Badge key={t} variant="muted" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate(`/characters/${active.id}`)}
            >
              <IconEdit className="h-3.5 w-3.5" /> 编辑角色卡
            </Button>

            <div className="space-y-3.5">
              <Field label="人设" value={active.persona} />
              <Field label="说话风格" value={active.style} />
              <Field label="禁忌" value={active.taboos} />
              <Field label="场景" value={active.scenario} />
              <Field label="开场白" value={active.firstMessage} />
              {active.exampleDialogs && (
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <IconBook className="h-3 w-3" /> 示例对话
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-sans text-[11px] leading-5 text-foreground/80">
                    {active.exampleDialogs}
                  </pre>
                </details>
              )}
            </div>

            <button
              onClick={() => navigate('/memory')}
              className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <IconSparkles className="h-3.5 w-3.5" />
              管理 {active.name} 的记忆
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
