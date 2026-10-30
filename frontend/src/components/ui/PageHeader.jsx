import { Inbox } from 'lucide-react'
import { BackLink } from '@/components/ui/BackLink'
import { cn } from '@/lib/utils'


export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {(actions || back) && (
        <div className="flex flex-wrap gap-2">
          {actions}
          {back && <BackLink to={back.to} go={back.go} label={back.label} />}
        </div>
      )}
    </div>
  )
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={cn('card', className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function EmptyState({ title = 'Nothing here yet', message, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-subtle text-muted ring-1 ring-border">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
    </div>
  )
}
