import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Hint } from '@/components/ui/tooltip'
import { IconSend, IconStop, IconSparkles } from '@/components/icons'
import { cn, estimateTokens } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { Character } from '@/lib/types'

interface ComposerProps {
  character: Character
  streaming: boolean
  disabled?: boolean
  showTokens?: boolean
  onSend: (text: string) => void
  onStop: () => void
}

const DRAFT_PREFIX = 'composer:draft:'

export function Composer({
  character,
  streaming,
  disabled,
  showTokens,
  onSend,
  onStop,
}: ComposerProps) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  // 手机上 Enter 应该换行（软键盘没有 Shift），发送走按钮
  const desktopKeyboard = useMediaQuery('(min-width: 768px)')

  // 每个角色保留一份草稿（刷新不丢）
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_PREFIX + character.id)
    setText(saved ?? '')
  }, [character.id])

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (text) localStorage.setItem(DRAFT_PREFIX + character.id, text)
      else localStorage.removeItem(DRAFT_PREFIX + character.id)
    }, 300)
    return () => window.clearTimeout(id)
  }, [text, character.id])

  // 自适应高度
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [text])

  const submit = () => {
    const value = text.trim()
    if (!value || streaming || disabled) return
    onSend(value)
    setText('')
    localStorage.removeItem(DRAFT_PREFIX + character.id)
    // 手机上不主动唤起键盘，避免刚发完又被顶起来
    if (desktopKeyboard) requestAnimationFrame(() => ref.current?.focus())
  }

  return (
    <div className="border-t border-border bg-background/80 px-2.5 py-2 pb-safe backdrop-blur sm:px-5 sm:py-2.5">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5">
        <div
          className={cn(
            'flex items-end gap-2 rounded-2xl border border-input bg-card px-2.5 py-2 shadow-sm transition-colors',
            'focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30',
          )}
        >
          <Textarea
            ref={ref}
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (!desktopKeyboard) return
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            enterKeyHint="enter"
            placeholder={
              desktopKeyboard
                ? `对 ${character.name} 说点什么…（Enter 发送，Shift+Enter 换行）`
                : `对 ${character.name} 说点什么…`
            }
            className="composer-input min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:ring-0"
          />
          {streaming ? (
            <Hint label="停止生成">
              <Button
                size="icon"
                variant="destructive"
                onClick={onStop}
                className="h-10 w-10 rounded-xl sm:h-9 sm:w-9"
              >
                <IconStop className="h-4 w-4" />
              </Button>
            </Hint>
          ) : (
            <Hint label={desktopKeyboard ? '发送（Enter）' : '发送'}>
              <Button
                size="icon"
                onClick={submit}
                disabled={!text.trim() || disabled}
                className="h-10 w-10 rounded-xl sm:h-9 sm:w-9"
              >
                <IconSend className="h-4 w-4" />
              </Button>
            </Hint>
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <IconSparkles className="h-3 w-3 shrink-0" />
            {streaming ? '正在生成…' : `以 ${character.name} 的身份回复`}
          </span>
          {showTokens && text.trim() && <span className="shrink-0">约 {estimateTokens(text)} token</span>}
        </div>
      </div>
    </div>
  )
}
