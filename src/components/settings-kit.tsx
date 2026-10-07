import { cn } from '@/lib/utils'

/**
 * 设置页的三种基础件，按 Tidal_Echo 的版式实现：
 * 分组卡片（毛玻璃）、行（图标 + 名称 + 值 + 箭头）、分段控件。
 * 见 NOTICE.md 的来源说明。
 */

/* ---------------- 分组卡片：毛玻璃，融入壁纸 ---------------- */
export function GlassCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('glass rounded-[18px] p-[15px]', className)}>{children}</div>
}

/* ---------------- 小节标签 ---------------- */
export function CardLabel({
  children,
  hint,
  className,
}: {
  children: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={cn('mb-2.5 flex items-baseline gap-2', className)}>
      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {children}
      </span>
      {hint && <span className="text-[10.5px] text-muted-foreground/70">{hint}</span>}
    </div>
  )
}

/* ---------------- 行：图标 + 名称 + 值 + 可选箭头 ---------------- */
export function SettingsRow({
  icon,
  name,
  value,
  desc,
  chevron,
  onClick,
  stacked,
  className,
}: {
  icon?: React.ReactNode
  name: React.ReactNode
  value?: React.ReactNode
  desc?: React.ReactNode
  chevron?: boolean
  onClick?: () => void
  /** 值比较宽（比如分段控件）时改成上下排，避免把卡片撑出屏幕 */
  stacked?: boolean
  className?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'w-full rounded-[16px] border border-[hsl(var(--line)/0.5)]',
        'bg-[hsl(var(--bg)/0.34)] px-4 py-[13px] text-left',
        'backdrop-blur-[14px] transition-colors',
        stacked ? 'block' : 'flex items-center gap-[13px]',
        onClick && 'cursor-pointer hover:bg-[hsl(var(--surface-2)/0.5)] active:scale-[0.995]',
        className,
      )}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      <span className={cn(stacked ? 'flex items-center gap-[13px]' : 'contents')}>
        {icon && (
          <span className="grid h-[21px] w-[21px] flex-none place-items-center text-[hsl(var(--accent))]">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] text-foreground">{name}</span>
          {desc && (
            <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
              {desc}
            </span>
          )}
        </span>
      </span>
      {value != null && value !== '' && (
        <span
          className={cn(
            'block',
            stacked ? 'mt-3' : 'shrink-0 text-[12.5px] text-muted-foreground',
          )}
        >
          {value}
        </span>
      )}
      {chevron && (
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      )}
    </Tag>
  )
}

/* ---------------- 分段控件：主题/开关类二选一或多选一 ---------------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T
  options: { value: T; label: React.ReactNode }[]
  onChange: (v: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'grid gap-[3px] rounded-[13px] p-[3px]',
        'bg-[hsl(var(--fg-faint)/0.11)]',
        className,
      )}
      style={{ gridAutoFlow: 'column', gridAutoColumns: '1fr' }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'rounded-[10px] px-3 py-[7px] text-[12.5px] transition-all',
              active
                ? 'bg-[hsl(var(--bg)/0.86)] text-foreground shadow-[0_2px_8px_hsl(205_30%_30%/0.08)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- 分组：多行放进一张毛玻璃卡片里 ---------------- */
export function RowGroup({
  label,
  children,
  className,
}: {
  label?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      {label && <CardLabel>{label}</CardLabel>}
      <div className="space-y-2">{children}</div>
    </section>
  )
}
