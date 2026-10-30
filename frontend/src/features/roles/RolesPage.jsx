import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Can, RequirePermission } from '@/auth/guards'
import { useAuth } from '@/auth/useAuth'
import { DataTable } from '@/components/data/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { useCrud } from '@/hooks/useCrud'
import { formatDateTime } from '@/lib/format'

export default function RolesPage() {
  const navigate = useNavigate()
  const { can, user } = useAuth()
  const { useList, remove } = useCrud('roles', { label: 'Role' })
  const list = useList({})
  const [deleting, setDeleting] = useState(null)

  const columns = [
    { key: 'name', header: 'Role', primary: true, priority: 1, render: (row) => (
      <span className="inline-flex items-center gap-2 font-medium">
        {row.name}
        {row.is_super_admin && <Badge tone="amber"><Lock className="size-3" />Full access</Badge>}
        {row.is_default && <Badge tone="teal">Default for new users</Badge>}
      </span>
    ) },
    { key: 'permissions_count', header: 'Permissions', priority: 2, render: (row) => (row.is_super_admin ? 'All' : row.permissions_count) },
    { key: 'users_count', header: 'Users', priority: 2 },
    { key: 'updated_at', header: 'Updated', priority: 4, render: (row) => <span className="text-muted">{formatDateTime(row.updated_at)}</span> },
  ]

  // SuperAdmin is never edited; the Admin role only by the SuperAdmin. Locked roles show a padlock (view only).
  const actions = (row) => {
    const locked = row.is_super_admin || (row.is_admin && !user.is_super_admin)
    return (
      <>
        <Button variant="ghost" size="icon" title={locked ? 'View' : 'Edit permissions'} onClick={() => navigate(locked ? `/roles/${row.uuid}` : `/roles/${row.uuid}/edit`)}>
          {locked ? <Lock className="size-4" /> : <Pencil className="size-4" />}
        </Button>
        {!locked && !row.is_default && can('delete_role') && (
          <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleting(row)}><Trash2 className="size-4 text-danger" /></Button>
        )}
      </>
    )
  }

  return (
    <RequirePermission permission="view_role">
      <PageHeader
        title="Roles & permissions"
        subtitle="Click a role to edit what it may do."
        actions={<Can permission="create_role"><Button onClick={() => navigate('/roles/create')}><Plus className="size-4" /> Add role</Button></Can>}
      />
      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          rows={list.data?.data}
          isLoading={list.isFetching}
          actions={actions}
          onRowClick={can('view_role') ? (row) => navigate(`/roles/${row.uuid}`) : undefined}
          emptyMessage="Create your first role with “Add role”."
        />
      </div>
      <ConfirmDialog
        open={!!deleting}
        title="Delete role?"
        message={`“${deleting?.name}” will be deleted permanently.`}
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.uuid, { onSuccess: () => setDeleting(null) })}
      />
    </RequirePermission>
  )
}
