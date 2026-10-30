import { cn } from '@/lib/utils'

/**
 * Pick one of a few options, shown as joined buttons.
 *   <SegmentedControl value={theme} onChange={setTheme} options={[{ value: 'light', label: 'Light', icon: Sun }]} />
 */
export function SegmentedControl({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-surface p-1">
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
        const active = optionValue === value
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(optionValue)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              active ? 'bg-card text-primary-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {optionLabel}
          </button>
        )
      })}
    </div>
  )
}
