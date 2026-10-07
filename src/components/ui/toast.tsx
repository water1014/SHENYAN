import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/ui'
import { IconAlert, IconInfo } from '@/components/icons'
import { SuccessCheck } from '@/components/success-check'

export function Toaster() {
  const toast = useUiStore((s) => s.toast)
  const dismiss = useUiStore((s) => s.dismissToast)

  if (!toast) return null
  const tone = toast.tone

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-5 z-[80] flex justify-center sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <div
        // key 用 toast.id：新提示会重播进场动画，不需要手动 remove/reflow/re-add
        key={toast.id}
        role="status"
        onClick={dismiss}
        data-state="open"
        className={cn(
          't-toast pointer-events-auto flex max-w-md cursor-pointer items-start gap-2 rounded-[var(--r-control)] border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur',
          'w-full sm:w-auto',
          tone === 'error'
            ? 'border-destructive/40 bg-destructive/15 text-destructive-foreground'
            : tone === 'success'
              ? 'border-primary/40 bg-primary/15'
              : 'border-border bg-popover',
        )}
      >
        <span className="mt-0.5 shrink-0">
          {tone === 'error' ? (
            <IconAlert className="h-4 w-4 text-destructive" />
          ) : tone === 'success' ? (
            <SuccessCheck className="text-primary" size={15} />
          ) : (
            <IconInfo className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
        <span className="whitespace-pre-wrap break-words">{toast.text}</span>
      </div>
    </div>
  )
}
