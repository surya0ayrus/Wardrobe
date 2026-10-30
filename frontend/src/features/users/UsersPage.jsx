import { useMutation } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { RequirePermission } from '@/auth/guards'
import { useAuth } from '@/auth/useAuth'
import { DataTable } from '@/components/data/DataTable'
import { FilterSelect } from '@/components/data/FilterSelect'
import { ListToolbar } from '@/components/data/ListToolbar'
import { Pagination } from '@/components/data/Pagination'
import { StatusToggle } from '@/components/data/StatusToggle'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { useCrud } from '@/hooks/useCrud'
import { useListParams } from '@/hooks/useListParams'
import { useLookup } from '@/hooks/useLookup'
import { api, errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { toOptions } from '@/lib/options'
import { UserAvatar } from './UserAvatar'

const columns = [
  {
    key: 'name', header: 'Name', sortable: true, primary: true, priority: 1,
    render: (row) => (
      <span className="flex items-center gap-3">
        <UserAvatar user={row} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{row.name}</span>
          <span className="block text-xs text-muted">@{row.username}</span>
        </span>
      </span>
    ),
  },
  { key: 'email', header: 'Email', priority: 3, render: (row) => row.email || '—' },
  {
    key: 'roles', header: 'Roles', priority: 2,
    render: (row) => (row.roles?.length
      ? <span className="flex flex-wrap gap-1">{row.roles.map((r) => <Badge key={r.id}>{r.name}</Badge>)}</span>
      : <span className="text-muted">No role</span>),
  },
  {
    key: 'companies', header: 'Companies', priority: 4,
    render: (row) => <span className="flex flex-wrap gap-1">{row.companies?.map((c) => <Badge key={c.id} tone="teal">{c.short_name}</Badge>)}</span>,
  },
  { key: 'last_login_at', header: 'Last login', sortable: true, priority: 5, className: 'whitespace-nowrap', render: (row) => (row.last_login_at ? formatDateTime(row.last_login_at) : <span className="text-muted">Never</span>) },
  { key: 'is_active', header: 'Status', priority: 4, className: 'w-40', render: (row) => <StatusToggle resource="users" permission="user" record={row} label="User" /> },
]

/** /users — logins of the current company (SuperAdmins also see logins without a company). */
export default function UsersPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { params, setParam } = useListParams({ sort: '-id' })
  const list = useCrud('users', { label: 'User' }).useList(params)
  const { data: roles = [] } = useLookup('roles')
  const [resetting, setResetting] = useState(null)

  const reset = useMutation({
    mutationFn: (user) => api.post(`/users/${user.id}/reset-password`),
    onSuccess: (_, user) => {
      toast.success(`${user.name} must set a new password at the next login.`)
      setResetting(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const actions = can('update_user') ? (row) => (
    <>
      <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/users/${row.id}/edit`)}><Pencil className="size-4" /></Button>
      <Button variant="ghost" size="icon" title="Reset password" onClick={() => setResetting(row)}><KeyRound className="size-4" /></Button>
    </>
  ) : undefined

  return (
    <RequirePermission permission="view_user">
      <PageHeader
        title="Users"
        actions={can('create_user') && <Button onClick={() => navigate('/users/create')}><Plus className="size-4" /> Add user</Button>}
      />

      <div className="card overflow-hidden">
        <ListToolbar params={params} setParam={setParam} searchPlaceholder="Search name, username, email, phone…">
          <FilterSelect name="role_id" params={params} setParam={setParam} options={toOptions(roles).map((o) => ({ ...o, value: String(o.value) }))} placeholder="All roles" />
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={list.data?.data}
          isLoading={list.isFetching}
          sort={params.sort}
          onSort={(value) => setParam('sort', value)}
          onRowClick={(row) => navigate(`/users/${row.id}`)}
          actions={actions}
          emptyTitle="No users yet"
        />
        <Pagination data={list.data} onPage={(page) => setParam('page', page)} onPerPage={(n) => setParam('per_page', n)} />
      </div>

      <ConfirmDialog
        open={!!resetting}
        title="Reset password?"
        message={`${resetting?.name}'s password goes back to the default password, and they must choose a new one at the next login.`}
        confirmLabel="Reset password"
        tone="primary"
        loading={reset.isPending}
        onClose={() => setResetting(null)}
        onConfirm={() => reset.mutate(resetting)}
      />
    </RequirePermission>
  )
}
