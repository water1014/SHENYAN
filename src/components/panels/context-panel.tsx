import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Hint } from '@/components/ui/tooltip'
import { IconEye, IconLayers, IconRefresh, IconSparkles } from '@/components/icons'
import { cn, estimateTokens } from '@/lib/utils'
import { useChatStore } from '@/store/chat'
import { useMemoryStore } from '@/store/memory'
import { useSessionStore } from '@/store/sessions'
import { useSettingsStore } from '@/store/settings'
import type { Character } from '@/lib/types'

const ROLE_LABEL: Record<string, string> = {
  system: '系统',
  user: '用户',
  assistant: '角色',
}

export function ContextPanel({ character }: { character: Character | null }) {
  const sessionId = useSessionStore((s) => s.activeSessionId)
  const context = useChatStore((s) => s.lastContext)
  const refresh = useChatStore((s) => s.refreshContextPreview)
  const messages = useSessionStore((s) => s.messages)
  const settings = useSettingsStore((s) => s.settings)
  const memories = useMemoryStore((s) =>
    character ? (s.byCharacter[character.id] ?? []) : [],
  )

  // 切换会话 / 消息变化 / 记忆变化后刷新预览
  useEffect(() => {
    if (!sessionId) return
    void refresh()
  }, [sessionId, refresh, messages.length, memories.length, settings.memoryEnabled])

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
        选中一个会话后，这里会显示实际发送给模型的上下文
      </div>
    )
  }

  const usedIds = new Set(context?.usedMemoryIds ?? [])
  const usedMemories = memories.filter((m) => usedIds.has(m.id))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <IconLayers className="h-3.5 w-3.5" /> 上下文组装
        </span>
        <Hint label="刷新预览">
          <Button variant="ghost" size="icon-sm" onClick={() => void refresh()}>
            <IconRefresh className="h-3.5 w-3.5" />
          </Button>
        </Hint>
      </div>

      {context && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 text-[11px] text-muted-foreground">
          <Badge variant="muted">最近 {context.keptCount} 条</Badge>
          <Badge variant="muted">约 {context.estimatedTokens} token</Badge>
          {context.droppedCount > 0 && (
            <Badge variant="secondary">裁掉 {context.droppedCount} 条</Badge>
          )}
          <Badge variant="secondary">{usedMemories.length} 条记忆</Badge>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto scrollbar-thin border-t border-border px-3 py-3">
        <section className="rounded-lg border border-border/70 bg-card/60">
          <header className="flex items-center gap-1.5 border-b border-border/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            <IconSparkles className="h-3 w-3" /> 系统提示（system）
          </header>
          <pre className="max-h-64 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words p-2.5 font-sans text-[11px] leading-5 text-foreground/85">
            {context?.system || '（空）'}
          </pre>
        </section>

        {context?.messages
          .map((m, i) => ({ ...m, key: `${i}-${m.role}` }))
          .filter((m) => m.role !== 'system')
          .map((m) => (
            <section key={m.key} className="rounded-lg border border-border/70 bg-card/60">
              <header className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-medium',
                    m.role === 'user' ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground/80',
                  )}
                >
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
                <span>~{estimateTokens(m.content)} tok</span>
              </header>
              <p className="max-h-40 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words px-2.5 pb-2 text-[11px] leading-5 text-foreground/80">
                {m.content.slice(0, 1200)}
                {m.content.length > 1200 && '…'}
              </p>
            </section>
          ))}

        <section className="rounded-lg border border-dashed border-border px-2.5 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium">
            <IconEye className="h-3 w-3" /> 实际注入的长期记忆
          </div>
          {usedMemories.length === 0 ? (
            <p className="mt-1">没有（记忆关闭，或还没有记忆）</p>
          ) : (
            <ul className="mt-1 space-y-0.5 pl-4">
              {usedMemories.map((m) => (
                <li key={m.id} className="list-disc">
                  {m.content}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
