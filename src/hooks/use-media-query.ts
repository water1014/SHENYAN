import { useEffect, useState } from 'react'

/**
 * 用 matchMedia 做响应式判断。
 * 需要在 JS 里切换「抽屉 / 侧栏」这种结构差异时用它；纯样式差异用 Tailwind 断点即可。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    // 老 Safari 只有 addListener
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [query])

  return matches
}

/** 窄屏（手机 / 竖屏平板）：左侧会话列表与右侧面板改为抽屉 / 底部面板 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}

/** 双栏以下：右侧面板需要收起才能看清聊天 */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 1279px)')
}
