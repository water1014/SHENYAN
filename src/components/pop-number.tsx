import { cn } from '@/lib/utils'

interface PopNumberProps {
  value: number
  className?: string
}

/**
 * 数字变化时逐位弹入（transitions.dev 的 number-pop-in 手法）。
 *
 * 关键点：用 `key={value}` 换掉整组节点，动画自然重播，
 * 不需要 JS 定时器去 remove/reflow/re-add class。
 */
export function PopNumber({ value, className }: PopNumberProps) {
  const text = String(value)
  return (
    <span key={value} className={cn('t-digits inline-flex items-baseline tnum', className)}>
      {text.split('').map((ch, i) => (
        <span key={`${i}-${ch}`} className="t-digit" data-stagger={i}>
          {ch}
        </span>
      ))}
    </span>
  )
}
