import { useEffect, useRef, useState } from 'react'
import { Markdown } from '@/components/markdown'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconMore,
  IconRefresh,
  IconSparkles,
  IconTrash,
  IconX,
} from '@/components/icons'
import { cn, copyText, estimateTokens, formatDateTime } from '@/lib/utils'
import type { Character, Memory, Message } from '@/lib/types'

export interface MessageBubbleProps {
  message: Message
  character: Character
  /** 这条消息是否正在流式生成 */
  streaming?: boolean
  /** 本次生成实际注入的记忆 */
  usedMemories?: Memory[]
  showTokens?: boolean
  onRegenerate?: (id: string) => void
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
  onContinue?: () => void
  regenerating?: boolean
}

export function MessageBubble({
  message,
  character,
  streaming,
  usedMemories = [],
  showTokens,
  onRegenerate,
  onEdit,
  onDelete,
  onContinue,
}: MessageBubbleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const [copied, setCopied] = useState(false)
  const [showMemories, setShowMemories] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)

  const isUser = message.role === 'user'

  useEffect(() => {
    if (editing) {
      editRef.current?.focus()
      editRef.current?.setSelectionRange(draft.length, draft.length)
    }
    // 仅在进入编辑态时聚焦
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  useEffect(() => {
    if (!editing) setDraft(message.content)
  }, [message.content, editing])

  const handleCopy = async () => {
    if (await copyText(message.content)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const saveEdit = () => {
    const next = draft.trim()
    if (next && next !== message.content) onEdit?.(message.id, next)
    setEditing(false)
  }

  const empty = !message.content.trim()

  return (
    <div
      className={cn(
        'group/msg flex w-full gap-2 animate-fade-in sm:gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <Avatar
        name={isUser ? '我' : character.name}
        src={isUser ? undefined : character.avatar}
        size={30}
        className="mt-0.5 sm:hidden"
      />
      <Avatar
        name={isUser ? '我' : character.name}
        src={isUser ? undefined : character.avatar}
        size={34}
        className="mt-0.5 hidden sm:block"
      />

      <div className={cn('flex min-w-0 max-w-[88%] flex-col sm:max-w-[82%]', isUser && 'items-end')}>
        <div
          className={cn(
            'flex items-center gap-2 px-1 pb-1 text-xs text-muted-foreground',
            isUser && 'flex-row-reverse',
          )}
        >
          <span className="font-medium text-foreground/80">{isUser ? '我' : character.name}</span>
          <span className="tabular-nums opacity-70">{formatDateTime(message.createdAt)}</span>
          {message.meta?.edited && <span className="opacity-70">已编辑</span>}
          {message.meta?.model && !isUser && (
            <span className="hidden opacity-60 sm:inline">{message.meta.model}</span>
          )}
          {showTokens && (
            <span className="hidden opacity-60 sm:inline">
              ~{estimateTokens(message.content)} tok
            </span>
          )}
        </div>

        <div
          className={cn(
            'relative w-full rounded-2xl border px-3 py-2 shadow-sm sm:px-4 sm:py-2.5',
            isUser
              ? 'border-primary/30 bg-primary/12 text-foreground rounded-tr-sm'
              : 'border-border bg-card rounded-tl-sm',
          )}
        >
          {editing ? (
            <div className="space-y-2">
              <Textarea
                ref={editRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditing(false)
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    saveEdit()
                  }
                }}
                className="min-h-[90px] bg-background"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  <IconX className="h-3.5 w-3.5" /> 取消
                </Button>
                <Button size="sm" onClick={saveEdit}>
                  <IconCheck className="h-3.5 w-3.5" /> 保存
                </Button>
              </div>
            </div>
          ) : empty && streaming ? (
            <TypingDots />
          ) : empty ? (
            <p className="text-sm text-muted-foreground">（空消息）</p>
          ) : (
            <Markdown content={message.content} streaming={streaming} />
          )}

          {message.meta?.error && (
            <p className="mt-2 border-t border-destructive/30 pt-2 text-xs text-destructive">
              生成出错：{message.meta.error}
            </p>
          )}

          {usedMemories.length > 0 && !isUser && (
            <div className="mt-2 border-t border-border/60 pt-1.5">
              <button
                type="button"
                onClick={() => setShowMemories((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <IconSparkles className="h-3 w-3" />
                本次注入 {usedMemories.length} 条记忆
              </button>
              {showMemories && (
                <ul className="mt-1 space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                  {usedMemories.map((m) => (
                    <li key={m.id} className="list-disc">
                      {m.content}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* 操作条：hover 显示；触摸设备没有 hover，所以常驻 */}
        {!editing && !streaming && (
          <div
            className={cn(
              'mt-1 flex items-center gap-0.5 transition-opacity focus-within:opacity-100',
              'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100',
              isUser && 'flex-row-reverse',
            )}
          >
            <Hint label="复制">
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 sm:h-7 sm:w-7" onClick={handleCopy}>
                {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
              </Button>
            </Hint>

            {isUser ? (
              <Hint label="编辑后重新发送">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 sm:h-7 sm:w-7"
                  onClick={() => setEditing(true)}
                >
                  <IconEdit className="h-3.5 w-3.5" />
                </Button>
              </Hint>
            ) : (
              <>
                <Hint label="重新生成">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 sm:h-7 sm:w-7"
                    onClick={() => onRegenerate?.(message.id)}
                  >
                    <IconRefresh className="h-3.5 w-3.5" />
                  </Button>
                </Hint>
                <Hint label="续写">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-8 w-8 sm:h-7 sm:w-7"
                    onClick={() => onContinue?.()}
                  >
                    <IconMore className="h-3.5 w-3.5" />
                  </Button>
                </Hint>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-8 w-8 sm:h-7 sm:w-7">
                  <IconMore className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isUser ? 'end' : 'start'}>
                <DropdownMenuItem onClick={handleCopy}>
                  <IconCopy className="h-4 w-4" /> 复制内容
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <IconEdit className="h-4 w-4" /> 编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRegenerate?.(message.id)}>
                  <IconRefresh className="h-4 w-4" /> 以此为起点重新生成
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete?.(message.id)}
                >
                  <IconTrash className="h-4 w-4" /> 删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  )
}

/** 打字状态：三个跳动的小点 */
export function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="正在输入">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce-dot"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}
