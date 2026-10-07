import { cn } from '@/lib/utils'

/**
 * 「小屋」环境层。
 *
 * 设计约束（来自 taste-skill 的规则）：
 * - 动效必须有目的。这里**只保留一层静态环境光**，不做漂移、不做呼吸 ——
 *   那些无限循环的装饰动效是最典型的 AI slop 指纹，也持续抢注意力。
 * - 环境光只出现在顶部、且很淡，不与正文抢对比度。
 * - 网格作为"房间"的隐喻，用 mask 渐隐到消失，避免硬边。
 */
export function RoomAmbient({ className }: { className?: string }) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      {/* 顶部单一光源：暖调、低透明度，给出空间感而不发光 */}
      <div className="absolute inset-x-0 top-0 h-[46vh] bg-[radial-gradient(ellipse_78%_100%_at_32%_0%,hsl(var(--accent)/.16),transparent_72%)]" />

      {/* 墙面的极淡网格，向右下渐隐 */}
      <div className="absolute inset-0 opacity-0 dark:opacity-100 [background-image:linear-gradient(to_right,hsl(var(--fg)/.05)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--fg)/.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_58%_at_38%_18%,#000_10%,transparent_76%)] [-webkit-mask-image:radial-gradient(ellipse_70%_58%_at_38%_18%,#000_10%,transparent_76%)]" />

      {/* 颗粒：极轻，压住大色块的塑料感 */}
      <div className="grain absolute inset-0" />
    </div>
  )
}
