import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { RequirePermission } from '@/auth/guards'
import { useAuth } from '@/auth/useAuth'
import { DataTable } from '@/components/data/DataTable'
import { ListToolbar } from '@/components/data/ListToolbar'
import { Pagination } from '@/components/data/Pagination'
import { StatusToggle } from '@/components/data/StatusToggle'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { useCrud } from '@/hooks/useCrud'
import { useListParams } from '@/hooks/useListParams'

/**
 * /companies — the reference list page: search, Active filter, sort, pagination, row click opens
 * the view page, pencil / bin for edit / delete. Copy this folder to start a new module.
 */
export default function CompaniesPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { params, setParam } = useListParams({ sort: '-id' })
  const { useList, remove } = useCrud('companies', { label: 'Company' })
  const list = useList(params)
  const [deleting, setDeleting] = useState(null)

  const columns = [
    { key: 'sno', header: 'S.No', priority: 3, className: 'w-20 tabular-nums text-muted', render: (_, index) => (list.data?.meta?.from ?? 1) + index },
    { key: 'short_name', header: 'Short name', sortable: true, priority: 2, className: 'w-36 font-mono text-xs', render: (row) => row.short_name },
    { key: 'name', header: 'Name', sortable: true, primary: true, priority: 1, render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'city', header: 'City', priority: 4, render: (row) => row.city || '—' },
    { key: 'users_count', header: 'Users', priority: 3, className: 'w-24 tabular-nums', render: (row) => row.users_count ?? 0 },
    { key: 'is_active', header: 'Status', priority: 4, className: 'w-40', render: (row) => <StatusToggle resource="companies" permission="company" record={row} label="Company" /> },
  ]

  const actions = (can('update_company') || can('delete_company')) ? (row) => (
    <>
      {can('update_company') && <Button variant="ghost" size="icon" title="Edit" onClick={() => navigate(`/companies/${row.uuid}/edit`)}><Pencil className="size-4" /></Button>}
      {can('delete_company') && <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleting(row)}><Trash2 className="size-4 text-danger" /></Button>}
    </>
  ) : undefined

  return (
    <RequirePermission permission="view_company">
      <PageHeader
        title="Companies"
        actions={can('create_company') && <Button onClick={() => navigate('/companies/create')}><Plus className="size-4" /> Add company</Button>}
      />

      <div className="card overflow-hidden">
        <ListToolbar params={params} setParam={setParam} searchPlaceholder="Search name, short name, email, city…" />
        <DataTable
          columns={columns}
          rows={list.data?.data}
          isLoading={list.isFetching}
          sort={params.sort}
          onSort={(value) => setParam('sort', value)}
          onRowClick={(row) => navigate(`/companies/${row.uuid}`)}
          actions={actions}
          emptyTitle="No companies yet"
          emptyMessage={can('create_company') ? 'Use "Add company" to add the first one.' : undefined}
        />
        <Pagination data={list.data} onPage={(page) => setParam('page', page)} onPerPage={(n) => setParam('per_page', n)} />
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete company?"
        message={`"${deleting?.name}" will be removed and cannot be brought back. To hide it for now, switch it to Inactive instead.`}
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.uuid, { onSuccess: () => setDeleting(null) })}
      />
    </RequirePermission>
  )
}
