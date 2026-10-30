import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/**
 * Modal built on the native <dialog> (focus trap + Esc for free).
 * Full screen on phones, centred box on larger screens.
 *   <Dialog open={open} onClose={close} title="Edit department" footer={<Button/>}>…</Dialog>
 */
export function Dialog({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      className={cn(
        'm-0 h-dvh max-h-dvh w-full max-w-full bg-card p-0 text-ink backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        // h-fit (not h-auto): a modal <dialog> is pinned top + bottom, so "auto" would stretch it to full height.
        'sm:m-auto sm:h-fit sm:max-h-[90dvh] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl open:animate-page',
        size === 'lg' ? 'sm:max-w-3xl' : size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-lg',
      )}
    >
      {open && (
        <div className="flex h-full max-h-dvh flex-col sm:h-auto sm:max-h-[90dvh]">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <footer className="flex justify-end gap-2 border-t border-border bg-subtle/40 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  )
}

/**
 * "Are you sure?" dialog.
 *   <ConfirmDialog open={…} title="Delete department?" message="…" onConfirm={…} onClose={…} loading={…} />
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', tone = 'danger', loading }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <p className="text-sm text-muted">{message}</p>
    </Dialog>
  )
}
