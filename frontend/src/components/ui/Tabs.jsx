import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * A row of tabs, each its own address (so a tab can be linked to and survives a refresh).
 *   <Tabs items={[{ to: '/settings/general', label: 'General', icon: Settings }]} />
 * Scrolls sideways on phones when there are more tabs than fit.
 */
export function Tabs({ items, label }) {
  return (
    <nav aria-label={label} className="-mx-3 overflow-x-auto border-b border-border px-3 sm:mx-0 sm:px-0">
      <div className="flex gap-1">
        {items.map(({ to, label: itemLabel, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              isActive ? 'border-primary text-primary-ink' : 'border-transparent text-muted hover:border-border hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-4" />}
            {itemLabel}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
