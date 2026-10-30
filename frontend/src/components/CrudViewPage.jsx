import { Check, CircleCheck, CircleX, Copy } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

const columnClasses = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' }
const spanClasses = { 2: 'sm:col-span-2', full: 'col-span-full' }

/** A titled card of label/value entries, for view pages. */
export function Section({ title, columns = 1, fields }) {
  return (
    <Card title={title}>
      <dl className={cn('grid gap-x-6 gap-y-5', columnClasses[columns])}>
        {fields.map((field) => <Entry key={field.label} {...field} />)}
      </dl>
    </Card>
  )
}

/** Label over value, like a Filament TextEntry. Empty values show "—". */
function Entry({ label, value, icon: Icon, copy, bold, span }) {
  const empty = value === null || value === undefined || value === ''
  return (
    <div className={cn('group min-w-0', spanClasses[span])}>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className={cn('mt-1 flex items-start gap-1.5 text-sm break-words text-muted', bold && 'font-semibold text-ink')}>
        {empty ? '—' : (
          <>
            {Icon && <Icon className="mt-0.5 size-4 shrink-0" />}
            <span className="min-w-0">{value}</span>
            {copy && typeof value === 'string' && <CopyButton text={value} />}
          </>
        )}
      </dd>
    </div>
  )
}

export function ActiveStatus({ record }) {
  return record.is_active
    ? <span className="inline-flex items-center gap-1.5 text-primary-ink"><CircleCheck className="size-4" /> Active</span>
    : <span className="inline-flex items-center gap-1.5 text-red-500"><CircleX className="size-4" /> Inactive</span>
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked: nothing to do */ }
  }

  return (
    <button type="button" onClick={copy} title="Copy" className="mt-0.5 rounded text-muted transition-opacity hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
      {copied ? <Check className="size-3.5 text-primary-ink" /> : <Copy className="size-3.5" />}
    </button>
  )
}
