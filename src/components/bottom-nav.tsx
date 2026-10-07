import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { IconBrain, IconChat, IconHome, IconSettings, IconUser } from '@/components/icons'

const TABS = [
  { to: '/home', label: '首页', icon: IconHome },
  { to: '/', label: '聊天', icon: IconChat },
  { to: '/characters', label: '角色', icon: IconUser },
  { to: '/memory', label: '记忆', icon: IconBrain },
  { to: '/settings', label: '设置', icon: IconSettings },
]

/**
 * 底部导航（窄屏 / 平板）。
 * 这批参考里几乎每一张都是「底部 4-5 个 tab」的结构，
 * 比顶栏更符合手机上的拇指可达范围。
 */
export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/85 backdrop-blur-md xl:hidden pb-safe"
      aria-label="主导航"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to)
          return (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                className={cn(
                  'flex flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-[18px] w-[18px]" />
                {tab.label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
