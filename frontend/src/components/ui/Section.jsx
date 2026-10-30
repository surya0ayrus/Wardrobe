import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Card with an icon, title and description; optionally collapsible.
 *   <Section icon={Globe} title="Request" description="HTTP details" collapsible>…</Section>
 */
export function Section({ icon: Icon, title, description, collapsible = false, defaultOpen = true, className, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const Header = collapsible ? 'button' : 'div'

  return (
    <section className={cn('card', className)}>
      <Header
        {...(collapsible ? { type: 'button', onClick: () => setOpen(!open), 'aria-expanded': open } : {})}
        className={cn('flex w-full items-start gap-3 px-5 py-4 text-left', open && 'border-b border-border')}
      >
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
            <Icon className="size-4.5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
        </span>
        {collapsible && <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />}
      </Header>
      {open && <div className="p-5">{children}</div>}
    </section>
  )
}

/** Label + value (+ small help text) block used inside detail sections. */
export function Detail({ label, icon: Icon, help, children, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="mt-1.5 flex min-w-0 items-start gap-1.5 text-sm break-words">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted" />}
        <span className="min-w-0">{children}</span>
      </dd>
      {help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </div>
  )
}
