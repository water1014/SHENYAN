import { cn } from '@/lib/utils'

/**
 * 成功对勾（transitions.dev 的 success-check 手法）。
 * 淡入 + 旋转 + 去模糊三件事并行，比单纯换个图标更有"完成了"的确认感。
 */
export function SuccessCheck({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      className={cn('t-check', className)}
      data-state="in"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
