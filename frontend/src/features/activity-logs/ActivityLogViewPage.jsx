import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowRightLeft, Clock, Download, ExternalLink, Fingerprint, Globe, Hash, History, IdCard,
  Info, Link2, Monitor, ShieldAlert, ShieldCheck, Smartphone, User, Zap,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { RequirePermission } from '@/auth/guards'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Detail, Section } from '@/components/ui/Section'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { actionLabel, actionTone, changeRows, recordPath, riskLevel } from '@/lib/activity'
import { api } from '@/lib/api'
import { formatDateTime, humanize } from '@/lib/format'
import { parseUserAgent } from '@/lib/userAgent'
import { cn } from '@/lib/utils'

/** /activity-logs/:id — full detail of one audit entry. */
export default function ActivityLogViewPage() {
  const { id } = useParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-logs', 'record', id],
    queryFn: () => api.get(`/activity-logs/${id}`).then((res) => res.data),
  })

  return (
    <RequirePermission permission="view_activity_log">
      {isLoading ? <FullPageSpinner /> : isError ? <p className="p-8 text-center text-muted">Activity log not found.</p> : (
        <LogDetail log={data.data} record={data.record} />
      )}
    </RequirePermission>
  )
}

function LogDetail({ log, record }) {
  const navigate = useNavigate()
  const risk = riskLevel(log.action)
  const agent = parseUserAgent(log.user_agent)
  const rows = changeRows(log)
  const openPath = record?.exists && !record.deleted ? recordPath(log.module, record.uuid) : null

  return (
    <div>
      <PageHeader
        title={`Activity log #${log.id}`}
        subtitle="Full view of this audit entry with its context."
        back={{ to: '/activity-logs', label: 'activity logs' }}
        actions={(
          <>
            {log.user && (
              <Button variant="secondary" onClick={() => navigate(`/activity-logs?user_id=${log.user.id}`)}>
                <Link2 className="size-4" /> Related activities
              </Button>
            )}
            <Button onClick={() => exportLog(log, record)}><Download className="size-4" /> Export log</Button>
          </>
        )}
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Section icon={IdCard} title="Audit metadata" description="Identifier and time of this audit entry">
          <dl className="grid gap-5 sm:grid-cols-3">
            <Detail label="Audit log ID" icon={Hash} help="Unique identifier of this entry">
              <span className="font-semibold text-primary-ink">#{log.id}</span>
            </Detail>
            <Detail label="Timestamp" icon={Clock} help={formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}>
              {formatDateTime(log.created_at)}
            </Detail>
            <Detail label="Record" icon={History} help={record?.deleted ? 'This record was deleted later' : undefined}>
              {log.module ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  {humanize(log.module)} #{log.record_id}
                  {record?.label && <span className="text-muted">· {record.label}</span>}
                  {record?.deleted && <Badge tone="red">Deleted</Badge>}
                </span>
              ) : '—'}
            </Detail>
          </dl>
        </Section>

        <Section icon={Info} title="Activity overview" description="What happened and who did it">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label="Action type" icon={Zap}>
              <Badge tone={actionTone(log.action)} className="text-sm">{actionLabel(log.action)}</Badge>
            </Detail>
            <Detail label="Performed by" icon={User} help={log.user?.email ?? (log.user ? `@${log.user.username}` : 'Seeder, import or another automatic process')}>
              {log.user?.name ?? 'System'}
            </Detail>
            {log.module && (
              <Detail label="Open record" icon={ExternalLink} className="sm:col-span-2">
                {openPath ? (
                  <Link to={openPath} className="font-medium text-primary-ink hover:underline">{record?.label ?? `${humanize(log.module)} #${log.record_id}`}</Link>
                ) : (
                  <Link to={`/activity-logs?module=${log.module}&record_id=${log.record_id}`} className="font-medium text-primary-ink hover:underline">
                    See the full history of this {humanize(log.module).toLowerCase()}
                  </Link>
                )}
              </Detail>
            )}
          </dl>
        </Section>

        <Section icon={Globe} title="Request information" description="HTTP request that caused this activity" collapsible>
          {log.method ? (
            <dl className="grid gap-5">
              <Detail label="HTTP method" icon={ArrowRightLeft}><Badge tone="teal">{log.method}</Badge></Detail>
              <Detail label="Request URL" icon={Link2}><span className="break-all">{log.url}</span></Detail>
              <Detail label="IP address" icon={Globe}>{log.ip_address ?? '—'}</Detail>
              <Detail label="User agent" icon={Monitor}><span className="break-all text-muted">{log.user_agent || '—'}</span></Detail>
            </dl>
          ) : (
            <p className="text-sm text-muted">No web request: this entry came from the system (seeder, import or background job).</p>
          )}
        </Section>

        <Section icon={ShieldCheck} title="Session & security context" description="Where the activity came from and how risky it is" collapsible>
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label="Source IP address" icon={Globe}>{log.ip_address ?? '—'}</Detail>
            <Detail label="Device" icon={agent?.device === 'Desktop' ? Monitor : Smartphone}>
              {agent ? `${agent.device} · ${agent.os}` : '—'}
            </Detail>
            <Detail label="Browser" icon={Fingerprint}>{agent?.browser ?? '—'}</Detail>
            <Detail label="Risk assessment" icon={risk.tone === 'red' ? ShieldAlert : ShieldCheck} help="Automatic, based on the action type">
              <Badge tone={risk.tone}>{risk.label}</Badge>
            </Detail>
          </dl>
        </Section>

        {rows.length > 0 && (
          <Section icon={ArrowRightLeft} title="Data changes" description="What was changed by this activity" collapsible className="xl:col-span-2">
            <DataChanges rows={rows} />
          </Section>
        )}
      </div>
    </div>
  )
}

const typeStyles = {
  added: { label: 'Added', tone: 'green', dot: 'bg-primary' },
  modified: { label: 'Modified', tone: 'teal', dot: 'bg-secondary' },
  removed: { label: 'Removed', tone: 'red', dot: 'bg-danger' },
}

/** Attribute / previous / updated / change type table (cards on phones). */
function DataChanges({ rows }) {
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.type]: (acc[row.type] ?? 0) + 1 }), {})
  const summary = Object.entries(counts).map(([type, n]) => `${n} ${type === 'modified' ? 'modified' : type}`).join(' · ')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-secondary/30 bg-cyan-50 px-4 py-3 text-sm dark:bg-cyan-500/10">
        <span className="flex items-center gap-2 font-medium text-secondary dark:text-cyan-300"><Info className="size-4" /> Data change summary</span>
        <Badge tone="teal">{rows.length} field{rows.length === 1 ? '' : 's'} · {summary}</Badge>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Attribute</th>
              <th className="px-4 py-3 font-medium"><span className="text-danger">−</span> Previous value</th>
              <th className="px-4 py-3 font-medium"><span className="text-primary-ink">+</span> Updated value</th>
              <th className="px-4 py-3 font-medium">Change type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border align-top">
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2"><span className={cn('size-2 rounded-full', typeStyles[row.type].dot)} />{humanize(row.key)}</span>
                </td>
                <td className="px-4 py-3"><Value value={row.old} missing={row.type === 'added' ? 'Not set' : null} /></td>
                <td className="px-4 py-3"><Value value={row.new} missing={row.type === 'removed' ? 'Removed' : null} /></td>
                <td className="px-4 py-3"><Badge tone={typeStyles[row.type].tone}>{typeStyles[row.type].label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.key} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium"><span className={cn('size-2 rounded-full', typeStyles[row.type].dot)} />{humanize(row.key)}</span>
              <Badge tone={typeStyles[row.type].tone}>{typeStyles[row.type].label}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-muted">Before</span><Value value={row.old} missing={row.type === 'added' ? 'Not set' : null} />
              <span className="text-muted">After</span><Value value={row.new} missing={row.type === 'removed' ? 'Removed' : null} />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {Object.values(typeStyles).map((style) => (
          <span key={style.label} className="flex items-center gap-1.5"><span className={cn('size-2 rounded-full', style.dot)} />{style.label}</span>
        ))}
      </div>
    </div>
  )
}

function Value({ value, missing }) {
  if (missing) return <span className="text-muted italic">— {missing}</span>
  if (value === null || value === undefined || value === '') return <span className="text-muted italic">empty</span>
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  if (typeof value === 'object') {
    return <pre className="max-w-md overflow-x-auto rounded bg-surface p-2 text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
  }
  return <span className="break-words">{String(value)}</span>
}

/** Download this entry as a CSV report. */
function exportLog(log, record) {
  const text = (value) => (value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value))
  const lines = [
    ['AUDIT LOG REPORT'],
    [`Generated at: ${formatDateTime(new Date())}`],
    [],
    ['LOG IDENTIFIER'],
    ['Log ID', log.id],
    ['Timestamp', formatDateTime(log.created_at)],
    [],
    ['ACTIVITY DETAILS'],
    ['Action type', actionLabel(log.action)],
    ['Performed by', log.user?.name ?? 'System'],
    ['User email', log.user?.email ?? ''],
    ['Resource type', log.module ? humanize(log.module) : ''],
    ['Resource ID', log.record_id ?? ''],
    ['Resource name', record?.label ?? ''],
    ['Risk', riskLevel(log.action).label],
    [],
    ['REQUEST INFORMATION'],
    ['HTTP method', log.method ?? ''],
    ['URL', log.url ?? ''],
    ['IP address', log.ip_address ?? ''],
    ['User agent', log.user_agent ?? ''],
  ]
  const rows = changeRows(log)
  if (rows.length) {
    lines.push([], ['DATA CHANGES'], ['Attribute', 'Previous value', 'Updated value', 'Change type'])
    rows.forEach((row) => lines.push([row.key, text(row.old), text(row.new), row.type]))
  }

  const csv = lines.map((cells) => cells.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: `audit_log_${log.id}.csv` })
  link.click()
  URL.revokeObjectURL(url)
}
