import { Check, Lock, Minus } from 'lucide-react'
import { Fragment } from 'react'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The permission grid:
 *  - click a box to toggle one permission
 *  - "All" toggles every action of that row (module)
 *  - click a column header to toggle that action for every module
 * `selected` is a Set of permission names; `onChange` gets the new Set.
 * With `locked`, everything is shown ticked and nothing can change (SuperAdmin).
 * With `readOnly`, the real ticks are shown but nothing can change (no update permission).
 */
export function PermissionMatrix({ matrix, selected, onChange, locked = false, readOnly = false }) {
  const disabled = locked || readOnly
  const resources = matrix.groups.flatMap((group) => group.resources)
  const has = (name) => locked || selected.has(name)

  const setMany = (names, on) => {
    const next = new Set(selected)
    names.forEach((name) => (on ? next.add(name) : next.delete(name)))
    onChange(next)
  }
  const rowNames = (resource) => resource.permissions.map((p) => p.name)
  const columnNames = (action) => resources.flatMap((r) => r.permissions.filter((p) => p.action === action).map((p) => p.name))
  const state = (names) => (names.every(has) ? 'all' : names.some(has) ? 'some' : 'none')

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-subtle/60">
          <tr className="text-xs text-muted">
            <th className="sticky left-0 z-10 bg-subtle px-4 py-3 text-left font-semibold">Module</th>
            <th className="w-16 px-2 py-3 text-center font-semibold">All</th>
            {matrix.actions.map((action) => {
              const names = columnNames(action)
              return (
                <th key={action} className="w-24 px-2 py-3 text-center font-semibold">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setMany(names, state(names) !== 'all')}
                    className="rounded px-1.5 py-0.5 hover:bg-card hover:text-primary-ink disabled:hover:bg-transparent"
                    title={`Toggle "${humanize(action)}" for every module`}
                  >
                    {humanize(action)}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {matrix.groups.map((group) => (
            <Fragment key={group.label}>
              <tr className="border-t border-border bg-subtle/40">
                <td colSpan={2 + matrix.actions.length} className="sticky left-0 px-4 py-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {group.label}
                </td>
              </tr>
              {group.resources.map((resource) => {
                const names = rowNames(resource)
                return (
                  <tr key={resource.key} className="border-t border-border transition-colors hover:bg-subtle/50">
                    <td className="sticky left-0 z-10 bg-card px-4 py-2.5 pl-6 font-medium">{resource.label}</td>
                    <td className="px-2 py-2.5 text-center">
                      <Box state={state(names)} locked={locked} disabled={disabled} onClick={() => setMany(names, state(names) !== 'all')} label={`All permissions for ${resource.label}`} />
                    </td>
                    {matrix.actions.map((action) => {
                      const permission = resource.permissions.find((p) => p.action === action)
                      return (
                        <td key={action} className="px-2 py-2.5 text-center">
                          {permission ? (
                            <Box
                              state={has(permission.name) ? 'all' : 'none'}
                              locked={locked}
                              disabled={disabled}
                              onClick={() => setMany([permission.name], !has(permission.name))}
                              label={`${resource.label}: ${humanize(action)}`}
                            />
                          ) : (
                            <span className="text-muted/40">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Checkbox-style button: empty, ticked, or partly ticked (some of the row). */
function Box({ state, onClick, locked, disabled = locked, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
      aria-label={label}
      title={locked ? 'Locked' : label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-default',
        !locked && disabled && 'opacity-70',
        locked
          ? 'border-muted/40 bg-muted/30 text-white'
          : state === 'none'
            ? 'border-border bg-card hover:border-primary hover:bg-primary-soft'
            : 'border-primary bg-primary text-white hover:bg-primary-hover',
      )}
    >
      {locked ? <Lock className="size-3" /> : state === 'all' ? <Check className="size-3.5" strokeWidth={3} /> : state === 'some' ? <Minus className="size-3.5" strokeWidth={3} /> : null}
    </button>
  )
}
