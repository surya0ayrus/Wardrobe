import { cn } from '@/lib/utils'
import { inputClass } from './inputClass'


export function Input({ className, ...props }) {
  return <input className={cn(inputClass, 'h-10', className)} {...props} />
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn(inputClass, 'py-2', className)} {...props} />
}

/** On / off switch. */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60',
          checked ? 'bg-primary' : 'bg-border',
        )}
      >
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-card shadow transition-transform', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}

export function Checkbox({ className, ...props }) {
  return <input type="checkbox" className={cn('size-4 rounded border-border accent-primary', className)} {...props} />
}
