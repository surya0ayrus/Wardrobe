import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '@/auth/useAuth'
import { PasswordField } from '@/components/form/fields'
import { Button } from '@/components/ui/Button'
import { applyServerErrors } from '@/lib/forms'
import { api, errorMessage } from '@/lib/api'
import { AuthShell } from './AuthShell'

const schema = z.object({
  current_password: z.string().min(1, 'Enter your current password.'),
  password: z.string()
    .min(8, 'At least 8 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
  password_confirmation: z.string(),
}).refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'Passwords do not match.' })

export default function ChangePasswordPage() {
  const { user, setSession, logout } = useAuth()
  const navigate = useNavigate()
  const forced = user.must_change_password
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { current_password: '', password: '', password_confirmation: '' } })

  const submit = form.handleSubmit(async (values) => {
    try {
      const { data } = await api.put('/auth/password', values)
      setSession(data)
      toast.success('Password changed.')
      navigate('/', { replace: true })
    } catch (error) {
      if (!applyServerErrors(form, error)) toast.error(errorMessage(error))
    }
  })

  return (
    <AuthShell
      title={forced ? 'Set your password' : 'Change password'}
      subtitle={forced ? `Welcome, ${user.name}. Please choose your own password to continue.` : undefined}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordField form={form} name="current_password" label={forced ? 'Temporary password' : 'Current password'} autoComplete="current-password" />
        <PasswordField form={form} name="password" label="New password" autoComplete="new-password" hint="At least 8 characters, with letters and numbers." />
        <PasswordField form={form} name="password_confirmation" label="Confirm new password" autoComplete="new-password" />
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Save password</Button>
        {forced ? (
          <Button variant="ghost" className="w-full" onClick={() => logout().then(() => navigate('/login'))}>Log out</Button>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>Cancel</Button>
        )}
      </form>
    </AuthShell>
  )
}
