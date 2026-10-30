import { cn } from '@/lib/utils'

const tones = {
  green: 'bg-primary-soft text-primary-ink ring-primary/20',
  gray: 'bg-subtle text-muted ring-border',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  teal: 'bg-cyan-50 text-cyan-700 ring-cyan-600/15 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/20',
}

const dots = { green: 'bg-primary', gray: 'bg-muted', red: 'bg-red-500', amber: 'bg-amber-500', teal: 'bg-cyan-500' }

/**
 * Small status label. `dot` adds a coloured dot in front. `color` (a hex like #3b82f6, e.g. a
 * status colour stored in the database) is used instead of a tone.
 */
export function Badge({ tone = 'gray', color, dot = false, className, children }) {
  const custom = color ? { color, backgroundColor: `${color}1a`, boxShadow: `inset 0 0 0 1px ${color}40` } : undefined
  return (
    <span style={custom} className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap', !color && ['ring-1 ring-inset', tones[tone]], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', !color && dots[tone])} style={color ? { backgroundColor: color } : undefined} />}
      {children}
    </span>
  )
}

/** Active / Inactive, from any record with is_active. */
export function StatusBadge({ record }) {
  return record.is_active ? <Badge tone="green" dot>Active</Badge> : <Badge tone="gray" dot>Inactive</Badge>
}
