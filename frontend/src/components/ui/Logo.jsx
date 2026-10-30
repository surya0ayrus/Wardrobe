import { APP_NAME } from '@/lib/app'
import { cn } from '@/lib/utils'

/**
 * The app's logo: a mark with the name's first letter, and the name (VITE_APP_NAME).
 * To use a real logo, replace this with <img src="/logo.svg" …> (files go in public/).
 */
export function Logo({ className, withName = true }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {withName && <span className="truncate text-lg font-bold tracking-tight text-ink">{APP_NAME}</span>}
    </span>
  )
}

export function LogoMark({ className }) {
  return (
    <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary to-secondary text-base font-bold text-white shadow-sm', className)}>
      {APP_NAME.trim().charAt(0).toUpperCase()}
    </span>
  )
}
