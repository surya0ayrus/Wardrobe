import { zodResolver } from '@hookform/resolvers/zod'
import { UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { RequirePermission } from '@/auth/guards'
import { useAuth } from '@/auth/useAuth'
import { FormPage } from '@/components/FormPage'
import { MultiSelectField } from '@/components/form/MultiSelectField'
import { PhoneField, TextField } from '@/components/form/fields'
import { EmptyState } from '@/components/ui/PageHeader'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useCrud } from '@/hooks/useCrud'
import { useLookup } from '@/hooks/useLookup'
import { applyServerErrors } from '@/lib/forms'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the name.').max(255),
  username: z.string().trim().min(3, 'At least 3 characters.').max(50).regex(/^[A-Za-z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only.'),
  email: z.union([z.literal(''), z.email('Enter a valid email.')]),
  phone: z.string().trim().max(20),
  role_ids: z.array(z.number()).min(1, 'Select at least one role.'),
  company_ids: z.array(z.number()).min(1, 'Select at least one company.'),
})

/**
 * Add (/users/create) or edit (/users/:id/edit) a login. New users get the default password
 * and must change it at first login.
 */
export default function UserFormPage() {
  const { id } = useParams()
  const { data: user, isLoading, isError } = useCrud('users').useRecord(id)

  return (
    <RequirePermission permission={id ? 'update_user' : 'create_user'}>
      {id && isLoading ? <FullPageSpinner /> : isError ? <EmptyState title="User not found" /> : <UserForm user={user} />}
    </RequirePermission>
  )
}

function UserForm({ user }) {
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const { save } = useCrud('users', { label: 'User' })
  const { data: roles = [], isLoading: rolesLoading } = useLookup('roles')
  const { data: companies = [], isLoading: companiesLoading } = useLookup('companies')
  const back = { to: '/users', label: 'users' }

  // Only a SuperAdmin may give out the SuperAdmin and Admin roles.
  const roleOptions = roles
    .filter((role) => me.is_super_admin || !['SuperAdmin', 'Admin'].includes(role.name))
    .map((role) => ({ value: role.id, label: role.name }))
  const companyOptions = companies.map((c) => ({ value: c.id, label: `${c.short_name} · ${c.name}` }))

  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      name: user?.name ?? '',
      username: user?.username ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      role_ids: user?.roles?.map((r) => r.id) ?? [],
      company_ids: user?.companies?.map((c) => c.id) ?? [],
    },
  })

  const onSubmit = async (values) => {
    try {
      await save.mutateAsync({ id: user?.id, ...values, email: values.email || null, phone: values.phone || null })
      navigate(back.to)
    } catch (error) {
      applyServerErrors(form, error)
    }
  }

  return (
    <FormPage
      form={form}
      onSubmit={onSubmit}
      saving={save.isPending}
      title={user ? `Edit ${user.name}` : 'Add user'}
      back={back}
      icon={UserRound}
      section="Login details"
      sectionDescription={user ? 'Who they are, what they may do, and which companies they work for.' : 'The new user signs in with the default password and must change it at first login.'}
      submitLabel={user ? 'Save changes' : 'Add user'}
      onCancel={() => navigate(back.to)}
    >
      <TextField form={form} name="name" label="Name" required autoFocus />
      <TextField form={form} name="username" label="Username" required autoCapitalize="none" hint="Used to sign in; saved in lower case." />
      <TextField form={form} name="email" label="Email" type="email" hint="Can also be used to sign in." />
      <PhoneField form={form} name="phone" label="Phone" />
      <MultiSelectField form={form} name="role_ids" label="Roles" required options={roleOptions} loading={rolesLoading} />
      <MultiSelectField form={form} name="company_ids" label="Companies" required options={companyOptions} loading={companiesLoading} hint="The companies this user can switch to." />
    </FormPage>
  )
}
