import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string
  size?: number
  className?: string
  square?: boolean
}

/**
 * 头像底色取自一组手挑的暖色（粉 / 玫红 / 紫 / 珊瑚 / 金 / 青）。
 * 不用简单的 `hash*31 % 360`：那个写法对中文名会大量落到绿色和黄色上，
 * 和整体玫红主题打架，而且相邻名字容易撞色。
 */
const PALETTE: { from: string; to: string }[] = [
  { from: 'hsl(338 55% 45%)', to: 'hsl(8 60% 32%)' }, // 玫红
  { from: 'hsl(300 45% 45%)', to: 'hsl(330 55% 32%)' }, // 紫粉
  { from: 'hsl(262 45% 48%)', to: 'hsl(292 50% 32%)' }, // 紫罗兰
  { from: 'hsl(8 60% 48%)', to: 'hsl(22 65% 34%)' }, // 珊瑚
  { from: 'hsl(38 60% 45%)', to: 'hsl(18 60% 32%)' }, // 琥珀
  { from: 'hsl(178 42% 38%)', to: 'hsl(200 48% 28%)' }, // 青
]

/** FNV-1a + 雪崩，保证相近的中文名字也能落到不同颜色上 */
function hash32(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return h >>> 0
}

export function paletteFor(name: string) {
  const text = (name || '?').trim() || '?'
  const entry = PALETTE[hash32(text) % PALETTE.length]
  return { background: `linear-gradient(140deg, ${entry.from}, ${entry.to})` }
}

/** 头像：有图用图，没图用名字首字 + 取色块 */
export function Avatar({ name, src, size = 36, className, square }: AvatarProps) {
  const label = (name || '?').trim().slice(0, 1) || '?'
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.42)),
    ...paletteFor(name),
  }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn(
          'shrink-0 select-none object-cover',
          square ? 'rounded-md' : 'rounded-full',
          className,
        )}
        onError={(e) => {
          // 图片坏了就退回字母头像
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }

  return (
    <div
      style={style}
      className={cn(
        'flex shrink-0 select-none items-center justify-center font-semibold text-white',
        square ? 'rounded-md' : 'rounded-full',
        className,
      )}
    >
      {label}
    </div>
  )
}
