import { cn } from '@/lib/utils'

/**
 * 「小屋」氛围背景。
 * 四层叠起来：渐变底 → 网格 → 漂移的暖色光团 → 噪点。
 * 全部是纯 CSS（模糊光团 + 内联 SVG 噪点），不引任何动效库，
 * 并且尊重系统的 prefers-reduced-motion。
 */
export function RoomAmbient({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {/* 底色：上方偏暖，下方压暗，营造一点纵深 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_65%_at_50%_-10%,hsl(338_58%_30%/.5),transparent_62%),radial-gradient(ellipse_70%_50%_at_50%_115%,hsl(278_44%_26%/.36),transparent_66%)]" />

      {/* 网格 */}
      <div className="room-grid absolute inset-0" />

      {/* 漂移的光团 */}
      <div className="room-aura drift-a absolute left-[8%] top-[10%] h-56 w-56 bg-[radial-gradient(circle,hsl(338_76%_60%/.34),transparent_70%)]" />
      <div className="room-aura drift-b absolute right-[6%] top-[20%] h-64 w-64 bg-[radial-gradient(circle,hsl(285_66%_60%/.28),transparent_70%)]" />
      <div className="room-aura drift-c absolute bottom-[-8%] left-1/2 h-72 w-[26rem] bg-[radial-gradient(circle,hsl(22_78%_58%/.2),transparent_70%)]" />

      {/* 噪点，压住渐变的塑料感 */}
      <div className="room-noise absolute inset-0" />
    </div>
  )
}
