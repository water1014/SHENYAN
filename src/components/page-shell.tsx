import { cn } from '@/lib/utils'

/**
 * 页面外壳：滚动容器 + 居中栏宽 + 页头 + 底部留白（给固定的底部导航让位）。
 * 版式取自 Tidal_Echo 的 menu-scroll：用 clamp() 做流式内边距，少写断点。
 */
export function PageShell({
  title,
  icon,
  description,
  actions,
  toolbar,
  maxWidth = '54rem',
  className,
  children,
}: {
  title: React.ReactNode
  icon?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** 放在页头右侧但不可见的元素（例如隐藏的 file input） */
  toolbar?: React.ReactNode
  maxWidth?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div
        className={cn('mx-auto', className)}
        style={{
          maxWidth,
          paddingLeft: 'var(--side-pad)',
          paddingRight: 'var(--side-pad)',
          paddingTop: 'var(--gap-5)',
          paddingBottom: 'calc(var(--gap-5) + 5rem)',
        }}
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="flex items-center gap-2 text-[clamp(22px,3vw,30px)] font-medium tracking-[-0.02em]">
              {icon && <span className="text-[hsl(var(--accent))]">{icon}</span>}
              {title}
            </h1>
            {description && (
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        {toolbar}
        <div className="space-y-[var(--gap-3)]">{children}</div>
      </div>
    </div>
  )
}
