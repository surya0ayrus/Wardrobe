import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { FullPageSpinner } from '@/components/ui/Spinner'

/** Pages that need a logged-in user (and a changed password). */
export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.must_change_password) return <Navigate to="/change-password" replace />

  return <Outlet />
}

/** Login page: skip it when already logged in. */
export function GuestOnly() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <FullPageSpinner />
  if (user) return <Navigate to="/" replace />

  return <Outlet />
}

/** Wraps a page that needs a permission; shows a message instead of the page. */
export function RequirePermission({ permission, children }) {
  const { can } = useAuth()

  if (!can(permission)) {
    return (
      <div className="card p-8 text-center">
        <p className="font-medium">You do not have access to this page.</p>
        <p className="mt-1 text-sm text-muted">Ask an administrator for the “{permission}” permission.</p>
      </div>
    )
  }

  return children
}

/** Shows children only with the permission: <Can permission="create_user">…</Can> */
export function Can({ permission, children }) {
  const { can } = useAuth()
  return can(permission) ? children : null
}

/** Logged in, password change allowed (the change-password page itself). */
export function RequireLogin() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
