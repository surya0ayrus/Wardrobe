import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IdCard, Lock, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { RequirePermission } from '@/auth/guards'
import { useAuth } from '@/auth/useAuth'
import { FormField } from '@/components/form/fields'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/inputs'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { api, errorMessage } from '@/lib/api'
import { PermissionMatrix } from './PermissionMatrix'

/**
 * Role name + permission matrix:
 * /roles/:id is the read-only view (opened from the list, with an Edit button),
 * /roles/:id/edit and /roles/create are the forms.
 */
export default function RoleFormPage() {
  const { id } = useParams()

  const matrix = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get('/permissions').then((res) => res.data),
    staleTime: Infinity,
  })
  const role = useQuery({
    queryKey: ['roles', 'record', id],
    queryFn: () => api.get(`/roles/${id}`).then((res) => res.data.data),
    enabled: !!id,
  })

  if (matrix.isLoading || (id && role.isLoading)) return <FullPageSpinner />
  if (role.isError) return <p className="p-8 text-center text-muted">Role not found.</p>

  return (
    <RequirePermission permission={id ? 'view_role' : 'create_role'}>
      <RoleForm key={id ?? 'new'} role={role.data} matrix={matrix.data} />
    </RequirePermission>
  )
}

function RoleForm({ role, matrix }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { can, user } = useAuth()
  const { pathname } = useLocation()
  const locked = !!role?.is_super_admin
  const viewing = !!role && !pathname.endsWith('/edit')
  // Only the SuperAdmin may change the Admin role.
  const adminRoleLocked = !!role?.is_admin && !user.is_super_admin
  // The view page, the edit page without the update permission, or the Admin role for a non-SuperAdmin: show it, no changes.
  const readOnly = !locked && !!role && (viewing || !can('update_role') || adminRoleLocked)
  const backTo = '/roles' // Back, Cancel and Save always return to the list
  const [name, setName] = useState(role?.name ?? '')
  const [selected, setSelected] = useState(() => new Set(role?.permissions ?? []))
  const [nameError, setNameError] = useState(null)

  const total = useMemo(
    () => matrix.groups.reduce((n, g) => n + g.resources.reduce((m, r) => m + r.permissions.length, 0), 0),
    [matrix],
  )
  const allNames = () => [
    ...matrix.groups.flatMap((g) => g.resources.flatMap((r) => r.permissions.map((p) => p.name))),
  ]

  const save = useMutation({
    mutationFn: (payload) => (role ? api.put(`/roles/${role.uuid}`, payload) : api.post('/roles', payload)).then((res) => res.data.data),
    onSuccess: () => {
      toast.success(role ? 'Role updated.' : 'Role created.')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['lookups'] })
      navigate('/roles')
    },
    onError: (error) => {
      const message = error.response?.data?.errors?.name?.[0]
      if (message) setNameError(message)
      else toast.error(errorMessage(error))
    },
  })

  const submit = (event) => {
    event.preventDefault()
    if (!name.trim()) return setNameError('Enter a role name.')
    setNameError(null)
    save.mutate({ name: name.trim(), permissions: [...selected] })
  }

  return (
    <form onSubmit={submit} className="pb-4">
      <PageHeader
        title={role ? role.name : 'Add role'}
        subtitle={role ? `${role.users_count ?? 0} user${role.users_count === 1 ? '' : 's'} with this role` : 'Name the role, then tick what it may do.'}
        back={{ to: backTo, label: 'roles' }}
      />

      {locked && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p><span className="font-semibold">SuperAdmin always has full access</span> and cannot be edited or deleted. Create other roles (e.g. HR Admin, Supervisor) for everyone else.</p>
        </div>
      )}

      {adminRoleLocked && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p><span className="font-semibold">Only the Super Admin can change the Admin role.</span> You can see its permissions here.</p>
        </div>
      )}


      {role?.is_default && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-50 p-4 text-sm text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p><span className="font-semibold">The everyday role for normal users.</span> Tick what a normal user may do. Its name is fixed and it cannot be deleted; change a person's roles on the Users page.</p>
        </div>
      )}

      <div className="space-y-4">
        <Section icon={IdCard} title="Role information" description="Basic details about this role">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Role name" required error={nameError} htmlFor="role-name"
              hint="A clear name, e.g. Supervisor, Accountant, Viewer"
            >
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={locked || readOnly || !!role?.is_default} aria-invalid={!!nameError} placeholder="e.g. HR Admin" autoFocus={!role} />
            </FormField>
            <FormField label="Guard" hint="Authentication guard for this role" htmlFor="role-guard">
              <Input id="role-guard" value="web" disabled />
            </FormField>
          </div>
        </Section>

        <Section
          icon={ShieldCheck}
          title="Permissions"
          description={locked || readOnly
            ? 'What this role may do in each module.'
            : 'Click a column header to toggle that action for every module, or “All” to toggle a whole row.'}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink tabular-nums">{locked ? total : selected.size}</span> of {total} permissions selected
            </p>
            {!locked && !readOnly && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelected(new Set(allNames()))}>Select all</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear all</Button>
              </div>
            )}
          </div>
          <PermissionMatrix matrix={matrix} selected={selected} onChange={setSelected} locked={locked} readOnly={readOnly} />
        </Section>
      </div>

      {!locked && !readOnly && (
        <div className="sticky bottom-0 z-10 -mx-3 mt-4 flex justify-end gap-2 border-t border-border bg-card/90 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <Button variant="secondary" onClick={() => navigate(backTo)}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>{role ? 'Save changes' : 'Create role'}</Button>
        </div>
      )}
    </form>
  )
}
