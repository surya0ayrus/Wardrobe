import { useQuery } from '@tanstack/react-query'
import { ArrowRight, History, UserCheck, UserX, Users, Activity } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { DonutChart, SERIES, NEUTRAL } from '@/components/charts'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, PageHeader } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { actionLabel, actionTone } from '@/lib/activity'
import { formatDateTime, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

/**
 * The home page. GET /dashboard sends one block per module the user may see (users,
 * recent_activity); add a block there and a section here for each new module.
 */
export default function DashboardPage() {
  const { user, currentCompany } = useAuth()
  const [hello] = useState(greeting)
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((res) => res.data),
    staleTime: 60_000,
  })
  const empty = !isLoading && !data?.users && !data?.recent_activity

  return (
    <div className="space-y-6">
      <PageHeader title={`${hello}, ${user.name.split(' ')[0]}`} subtitle={currentCompany?.name} />

      {isLoading && <CardsSkeleton />}
      {data?.users && <UserCards users={data.users} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {data?.users && (
          <Panel title="Users by status">
            {data.users.total === 0 ? <EmptyState icon={Users} title="No users yet" /> : (
              <DonutChart caption="Users by status" centerLabel="users" slices={[
                { label: 'Active', value: data.users.active, color: SERIES[0], to: '/users?status=active' },
                { label: 'Inactive', value: data.users.inactive, color: NEUTRAL, to: '/users?status=inactive' },
              ]} />
            )}
          </Panel>
        )}
        {data?.recent_activity && <RecentActivity rows={data.recent_activity} className={data?.users ? 'lg:col-span-2' : 'lg:col-span-3'} />}
      </div>
      {empty && <EmptyState title="Welcome" message="Ask an administrator for access to the modules you need." />}
    </div>
  )
}

const TONES = {
  neutral: 'bg-subtle text-muted',
  success: 'bg-primary-soft text-primary-ink',
  info: 'bg-chart-1/15 text-chart-1',
  danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

function UserCards({ users }) {
  const cards = [
    ['total', 'Users', 'In this company', Users, 'neutral', '/users'],
    ['active', 'Active', 'Can sign in', UserCheck, 'success', '/users?status=active'],
    ['inactive', 'Inactive', 'Switched off', UserX, 'danger', '/users?status=inactive'],
    ['active_this_week', 'Signed in', 'Last 7 days', Activity, 'info', '/users?sort=-last_login_at'],
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([key, label, hint, Icon, tone, to]) => (
        <StatCard key={key} to={to} label={label} hint={hint} value={users[key] ?? 0} icon={Icon} tone={tone} />
      ))}
    </div>
  )
}

function StatCard({ to, label, hint, value, icon: Icon, tone }) {
  return (
    <Link to={to} className="card flex items-start gap-3.5 px-4 py-4 transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md">
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', TONES[tone])} aria-hidden><Icon className="size-5" /></span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-2xl leading-tight font-bold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted">{hint}</p>
      </div>
    </Link>
  )
}

/** The newest activity log entries; a row opens its detail. */
function RecentActivity({ rows, className }) {
  return (
    <Panel title="Recent activity" className={className} action={<PanelLink to="/activity-logs">View all</PanelLink>}>
      {rows.length === 0 ? <EmptyState icon={History} title="Nothing logged yet" /> : (
        <ul className="-mx-2 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.uuid}>
              <Link to={`/activity-logs/${row.uuid}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-subtle/60">
                <Badge tone={actionTone(row.action)} className="shrink-0">{actionLabel(row.action)}</Badge>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{row.user?.name ?? 'System'}</span>
                  {row.module && <span className="text-muted"> · {humanize(row.module)} #{row.record_id}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{formatDateTime(row.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => <span key={i} className="skeleton block h-[5.5rem] rounded-xl" />)}
    </div>
  )
}

function Panel({ title, subtitle, action, className, children }) {
  return (
    <section className={cn('card flex flex-col', className)}>
      <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="flex-1 px-5 pb-5">{children}</div>
    </section>
  )
}

function PanelLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-primary-ink hover:underline">
      {children} <ArrowRight className="size-3.5" />
    </Link>
  )
}
