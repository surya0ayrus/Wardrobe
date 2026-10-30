import { X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { RequirePermission } from '@/auth/guards'
import { DataTable } from '@/components/data/DataTable'
import { FilterSelect } from '@/components/data/FilterSelect'
import { Pagination } from '@/components/data/Pagination'
import { Badge } from '@/components/ui/Badge'
import { DatePicker } from '@/components/ui/DatePicker'
import { PageHeader } from '@/components/ui/PageHeader'
import { useCrud } from '@/hooks/useCrud'
import { useListParams } from '@/hooks/useListParams'
import { ACTION_NAMES, actionLabel, actionTone, riskLevel } from '@/lib/activity'
import { formatDateTime, humanize } from '@/lib/format'

// Morph names from AppServiceProvider; add each new module here.
const modules = ['user', 'company', 'role']

const columns = [
  { key: 'created_at', header: 'When', primary: true, priority: 1, className: 'whitespace-nowrap', render: (row) => formatDateTime(row.created_at) },
  { key: 'user', header: 'User', priority: 2, render: (row) => row.user?.name ?? 'System' },
  { key: 'action', header: 'Action', priority: 1, render: (row) => <Badge tone={actionTone(row.action)}>{actionLabel(row.action)}</Badge> },
  { key: 'module', header: 'Module', priority: 3, render: (row) => (row.module ? `${humanize(row.module)} #${row.record_id}` : '—') },
  { key: 'risk', header: 'Risk', priority: 4, render: (row) => { const risk = riskLevel(row.action); return <Badge tone={risk.tone}>{risk.label}</Badge> } },
  { key: 'ip_address', header: 'IP', priority: 5, render: (row) => <span className="text-muted">{row.ip_address ?? '—'}</span> },
]

export default function ActivityLogsPage() {
  const navigate = useNavigate()
  const { params, setParam } = useListParams()
  const list = useCrud('activity-logs').useList(params)

  // Filters that come from links ("Related activities", "full history of this record").
  const chips = [
    params.user_id && { label: `User #${params.user_id}`, clear: () => setParam('user_id', '') },
    params.record_id && { label: `${humanize(params.module ?? 'record')} #${params.record_id}`, clear: () => setParam('record_id', '') },
  ].filter(Boolean)

  return (
    <RequirePermission permission="view_activity_log">
      <PageHeader title="Activity logs" subtitle="Who changed what, and when. Click a row for the full detail." />
      <div className="card overflow-hidden">
        <div className="grid grid-cols-2 gap-2 border-b border-border p-3 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect name="module" params={params} setParam={setParam} options={modules.map((m) => ({ value: m, label: humanize(m) }))} placeholder="All modules" />
          <FilterSelect name="action" params={params} setParam={setParam} options={ACTION_NAMES.map((a) => ({ value: a, label: actionLabel(a) }))} placeholder="All actions" />
          <DatePicker value={params.date_from ?? null} onChange={(v) => setParam('date_from', v ?? '')} placeholder="From date" aria-label="From date" fromYear={2026} className="sm:w-44" />
          <DatePicker value={params.date_to ?? null} onChange={(v) => setParam('date_to', v ?? '')} placeholder="To date" aria-label="To date" fromYear={2026} className="sm:w-44" />
          {chips.map((chip) => (
            <span key={chip.label} className="col-span-2 inline-flex w-fit items-center gap-1 rounded-full bg-primary-soft py-1 pr-1 pl-3 text-sm text-primary-ink">
              {chip.label}
              <button type="button" onClick={chip.clear} className="rounded-full p-0.5 hover:bg-primary/15" aria-label={`Remove filter ${chip.label}`}><X className="size-3.5" /></button>
            </span>
          ))}
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.data}
          isLoading={list.isFetching}
          onRowClick={(row) => navigate(`/activity-logs/${row.uuid}`)}
          emptyTitle="No activity found"
        />
        <Pagination data={list.data} onPage={(page) => setParam('page', page)} />
      </div>
    </RequirePermission>
  )
}
