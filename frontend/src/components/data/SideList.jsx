import { cn } from '@/lib/utils'

/**
 * The picker on the left of a master page (e.g. categories of a master list):
 * a column on wide screens, a scrolling row of chips on phones. Items can be grouped under
 * headings (shown on wide screens only).
 *
 *   <SideList value={current} onChange={setCurrent} groups={[
 *     { label: 'PPE', items: [{ value: 'uuid', label: 'Head Protection', count: 6, muted: false }] },
 *   ]} />
 *
 * `muted` greys an item out (e.g. an inactive category).
 */
export function SideList({ groups, value, onChange, label = 'Lists', emptyText }) {
  const empty = groups.every((group) => group.items.length === 0)

  return (
    <nav aria-label={label} className="card -mx-1 flex gap-1 overflow-x-auto p-1.5 lg:mx-0 lg:max-h-[calc(100dvh-12rem)] lg:flex-col lg:overflow-y-auto">
      {empty && emptyText && <p className="px-3 py-2 text-sm text-muted">{emptyText}</p>}
      {groups.map((group) => (
        <div key={group.label ?? 'items'} className="contents lg:block">
          {group.label && group.items.length > 0 && (
            <p className="hidden px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase lg:block">{group.label}</p>
          )}
          {group.items.map((item) => {
            const active = item.value === value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onChange(item.value)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors max-lg:w-auto',
                  active ? 'bg-primary-soft font-medium text-primary-ink' : 'text-muted hover:bg-subtle hover:text-ink',
                  item.muted && !active && 'opacity-60',
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs tabular-nums', active ? 'bg-primary/15' : 'bg-subtle')}>{item.count}</span>
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
