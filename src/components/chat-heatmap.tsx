import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { db } from '@/lib/db'
import { IconChevronLeft, IconChevronRight } from '@/components/icons'

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** 按月统计消息数，做成热力日历 */
function useMonthCounts(sessionIds: string[], month: Date) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const { start, end } = useMemo(() => {
    const s = new Date(month.getFullYear(), month.getMonth(), 1).getTime()
    const e = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime()
    return { start: s, end: e }
  }, [month])

  useEffect(() => {
    let cancelled = false
    if (sessionIds.length === 0) {
      setCounts({})
      setLoading(false)
      return
    }
    setLoading(true)
    void (async () => {
      const rows = await db.messages.where('sessionId').anyOf(sessionIds).toArray()
      if (cancelled) return
      const acc: Record<string, number> = {}
      for (const m of rows) {
        if (m.createdAt < start || m.createdAt >= end) continue
        const k = dayKey(m.createdAt)
        acc[k] = (acc[k] ?? 0) + 1
      }
      setCounts(acc)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [sessionIds, start, end])

  return { counts, loading }
}

/** 强度 0..4：按当月最大条数分档，和参考里「颜色越深聊得越多」一致 */
function intensity(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (max <= 0) return 1
  const r = count / max
  if (r <= 0.25) return 1
  if (r <= 0.5) return 2
  if (r <= 0.75) return 3
  return 4
}

const CELL_BG: Record<number, string> = {
  0: 'bg-transparent text-muted-foreground/70',
  1: 'bg-primary/15 text-foreground',
  2: 'bg-primary/30 text-foreground',
  3: 'bg-primary/50 text-foreground',
  4: 'bg-primary/75 text-primary-foreground',
}

export function ChatHeatmap({
  sessionIds,
  className,
}: {
  sessionIds: string[]
  className?: string
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const { counts, loading } = useMonthCounts(sessionIds, month)

  const max = useMemo(() => Math.max(0, ...Object.values(counts)), [counts])
  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])

  // 周一为一周起点
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const lead = (first.getDay() + 6) % 7
    const out: ({ day: number; key: string } | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, key: `${month.getFullYear()}-${month.getMonth()}-${d}` })
    }
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [month])

  const todayKey = dayKey(Date.now())
  const monthLabel = `${month.getFullYear()} · ${month.getMonth() + 1} 月`
  const shift = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  return (
    <section
      className={cn(
        'rounded-[var(--r-panel)] border border-border bg-card/50 p-4 backdrop-blur-sm',
        className,
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            聊天热力
          </div>
          <div className="tnum mt-0.5 text-[13px] font-medium">
            {monthLabel}
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              {loading ? '统计中' : `共 ${total} 条`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => shift(-1)}
            aria-label="上个月"
            className="rounded-[6px] p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => shift(1)}
            aria-label="下个月"
            className="rounded-[6px] p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={`pad-${i}`} className="aspect-square" />
          const n = counts[c.key] ?? 0
          const lv = intensity(n, max)
          const isToday = c.key === todayKey
          return (
            <div
              key={c.key}
              title={n > 0 ? `${c.day} 日 · ${n} 条消息` : `${c.day} 日 · 没有对话`}
              className={cn(
                'tnum flex aspect-square items-center justify-center rounded-[6px] text-[11.5px] transition-colors',
                CELL_BG[lv],
                isToday && 'ring-1 ring-primary',
              )}
            >
              {c.day}
            </div>
          )
        })}
      </div>

      <footer className="mt-3 flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span>颜色越深聊得越多</span>
        <span className="flex items-center gap-1">
          少
          {[0, 1, 2, 3, 4].map((lv) => (
            <span key={lv} className={cn('h-2.5 w-2.5 rounded-[3px]', CELL_BG[lv])} />
          ))}
          多
        </span>
      </footer>
    </section>
  )
}
