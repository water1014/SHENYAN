import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 生成一个短 id（不依赖 crypto.randomUUID，便于在不安全上下文里也能用） */
export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  return prefix ? `${prefix}_${rand}` : rand
}

export function nowTs(): number {
  return Date.now()
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return formatTime(ts)
  const yesterday = new Date(now.getTime() - 86400000)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return '昨天'
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`
}

/** 粗略估算 token 数：中文按 1 字 ≈ 1 token，英文按 4 字符 ≈ 1 token */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let cjk = 0
  for (const ch of text) {
    if (/[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/.test(ch)) cjk++
  }
  const rest = text.length - cjk
  return Math.ceil(cjk + rest / 4)
}

export function truncate(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/** 从消息内容里推导一个可读的摘要预览 */
export function previewOf(content: string, max = 32): string {
  if (!content) return '（空）'
  const noCode = content.replace(/```[\s\S]*?```/g, ' [代码] ').replace(/[#*>`_~]/g, '')
  return truncate(noCode, max) || '（空）'
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function timestampSlug(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 落到下面的兜底方案 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
