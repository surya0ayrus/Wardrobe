import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-primary text-white shadow-sm shadow-primary/20 inset-ring inset-ring-white/10 hover:bg-primary-hover',
  secondary: 'border border-border bg-card text-ink shadow-xs hover:bg-subtle',
  danger: 'bg-danger text-white shadow-sm hover:bg-red-700',
  ghost: 'text-muted hover:bg-subtle hover:text-ink',
}

const sizes = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  icon: 'size-9 justify-center',
}

/**
 * <Button variant="primary|secondary|danger|ghost" size="sm|md|icon" loading>
 */
export function Button({ variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-all active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:pointer-events-none disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}
