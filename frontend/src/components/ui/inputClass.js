import { cn } from '@/lib/utils'

// Shared look for every text-like input. text-base on mobile stops iOS from zooming in.
export const inputClass = cn(
  'block w-full rounded-lg border border-border bg-card px-3 text-base text-ink shadow-xs transition-colors sm:text-sm',
  'placeholder:text-muted/70 hover:border-muted/40 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none',
  'disabled:bg-subtle disabled:text-muted aria-invalid:border-danger aria-invalid:ring-danger/10',
)
