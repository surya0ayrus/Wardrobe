import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '@/auth/useAuth'
import { PasswordField, TextField } from '@/components/form/fields'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/inputs'
import { errorMessage } from '@/lib/api'
import { APP_NAME } from '@/lib/app'
import { applyServerErrors } from '@/lib/forms'
import { AuthShell } from './AuthShell'

const schema = z.object({
  login: z.string().trim().min(1, 'Enter your username or email.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean(),
})

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { login: '', password: '', remember: false } })

  const submit = form.handleSubmit(async (values) => {
    try {
      // Unticked, the session ends after SESSION_LIFETIME minutes idle.
      const session = await login(values)
      navigate(session.user.must_change_password ? '/change-password' : location.state?.from ?? '/', { replace: true })
    } catch (error) {
      if (!applyServerErrors(form, error)) toast.error(errorMessage(error))
    }
  })

  return (
    <AuthShell title="Welcome back" tagline={`Sign in to ${APP_NAME}`}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <TextField form={form} name="login" placeholder="Enter your username or email" aria-label="Username or email" autoComplete="username" autoCapitalize="none" autoFocus />
        <PasswordField form={form} name="password" placeholder="Enter your password" aria-label="Password" autoComplete="current-password" />
        <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
          <Checkbox {...form.register('remember')} />
          Remember me
        </label>
        <Button type="submit" className="h-12 w-full" loading={form.formState.isSubmitting}>Login</Button>
      </form>
    </AuthShell>
  )
}
