import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string
  size?: number
  className?: string
  square?: boolean
}

/**
 * 头像底色取自一组冷调色板（石板蓝 / 雾蓝 / 青灰 / 珍珠灰）。
 * 配合 PEARL TIDE 的浅色石板色调，暖色（琥珀、珊瑚）会明显不协调，所以不用。
 * 不用简单的 `hash*31 % 360`：那个写法对中文名会大量落到绿色和黄色上，
 * 而且相邻名字容易撞色。
 */
const PALETTE: { from: string; to: string }[] = [
  { from: 'hsl(207 24% 42%)', to: 'hsl(212 30% 28%)' }, // 石板蓝
  { from: 'hsl(218 18% 48%)', to: 'hsl(224 24% 34%)' }, // 雾蓝
  { from: 'hsl(196 22% 42%)', to: 'hsl(205 28% 29%)' }, // 青灰
  { from: 'hsl(230 14% 52%)', to: 'hsl(236 20% 38%)' }, // 灰紫蓝
  { from: 'hsl(186 18% 40%)', to: 'hsl(194 24% 28%)' }, // 潮绿
  { from: 'hsl(210 10% 50%)', to: 'hsl(214 14% 36%)' }, // 珍珠灰
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
