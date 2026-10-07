/**
 * 背景图注册表。
 *
 * 这些图是用 tools/build-backgrounds.py 从 D:\本地资源库\ins 里挑出来的竖版壁纸，
 * 统一裁成 9:16、压成 WebP（合计约 0.6MB）。
 *
 * 注意：原图都是浅色底 + 深色手写文案，而应用是深色主题，
 * 所以渲染时会叠一层暗色蒙版并做轻微模糊，保证前景文字始终可读。
 */

const modules = import.meta.glob<string>('../assets/backgrounds/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

export interface BackgroundOption {
  id: string
  url: string
  /** 平均亮度 0-1（离线量出来的）。用来决定配深色还是浅色主题、以及默认暗度 */
  luminance: number
}

/**
 * 各背景图的平均亮度（由 tools/build-backgrounds.py 量出）。
 * 这批壁纸都是浅底（平均 0.86），所以默认配浅色主题最自然；
 * 只有 bg-04 / bg-10 偏暗，配深色更好。
 */
const LUMINANCE: Record<string, number> = {
  'bg-01': 0.937,
  'bg-02': 0.938,
  'bg-03': 0.966,
  'bg-04': 0.579,
  'bg-05': 0.971,
  'bg-06': 0.92,
  'bg-07': 0.907,
  'bg-08': 0.839,
  'bg-09': 0.884,
  'bg-10': 0.644,
  'bg-11': 0.918,
  'bg-12': 0.955,
  'bg-13': 0.855,
  'bg-14': 0.688,
  'bg-15': 0.785,
  'bg-16': 0.992,
}

export const BACKGROUNDS: BackgroundOption[] = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url], i) => {
    const id = `bg-${String(i + 1).padStart(2, '0')}`
    return { id, url, luminance: LUMINANCE[id] ?? 0.86 }
  })

export function backgroundById(id: string | undefined | null): BackgroundOption | null {
  if (!id) return null
  return BACKGROUNDS.find((b) => b.id === id) ?? null
}

/** 浅色壁纸配浅色主题、深色壁纸配深色主题；暗度按亮度反着来 */
export function themeForBackground(bg: BackgroundOption): {
  theme: 'dark' | 'light'
  dim: number
} {
  const light = bg.luminance > 0.6
  return {
    theme: light ? 'light' : 'dark',
    dim: light ? 16 : 52,
  }
}
