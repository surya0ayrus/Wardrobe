import { createBrowserRouter } from 'react-router'
import { GuestOnly, RequireAuth, RequireLogin } from '@/auth/guards'
import ErrorPage from '@/features/ErrorPage'
import AppLayout from '@/layouts/AppLayout'

const page = (load) => () => load().then((module) => ({ Component: module.default }))

export const router = createBrowserRouter([
  {
    // Last resort for anything outside the layout (login, guards).
    ErrorBoundary: ErrorPage,
    children: [
      {
        Component: GuestOnly,
        children: [{ path: '/login', lazy: page(() => import('@/features/auth/LoginPage')) }],
      },
      {
        Component: RequireLogin,
        children: [{ path: '/change-password', lazy: page(() => import('@/features/auth/ChangePasswordPage')) }],
      },
      {
        Component: RequireAuth,
        children: [{
          Component: AppLayout,
          children: [
            // A page that crashes or fails to load shows the error page inside the layout.
            {
              ErrorBoundary: ErrorPage,
              children: [
                { index: true, lazy: page(() => import('@/features/dashboard/DashboardPage')) },

                // Companies are the reference CRUD module: copy these four routes for a new module.
                { path: 'companies', lazy: page(() => import('@/features/companies/CompaniesPage')) },
                { path: 'companies/create', lazy: page(() => import('@/features/companies/CompanyFormPage')) },
                { path: 'companies/:id', lazy: page(() => import('@/features/companies/CompanyViewPage')) },
                { path: 'companies/:id/edit', lazy: page(() => import('@/features/companies/CompanyFormPage')) },

                { path: 'users', lazy: page(() => import('@/features/users/UsersPage')) },
                { path: 'users/create', lazy: page(() => import('@/features/users/UserFormPage')) },
                { path: 'users/:id', lazy: page(() => import('@/features/users/UserViewPage')) },
                { path: 'users/:id/edit', lazy: page(() => import('@/features/users/UserFormPage')) },
                { path: 'roles', lazy: page(() => import('@/features/roles/RolesPage')) },
                { path: 'roles/create', lazy: page(() => import('@/features/roles/RoleFormPage')) },
                { path: 'roles/:id', lazy: page(() => import('@/features/roles/RoleFormPage')) },
                { path: 'roles/:id/edit', lazy: page(() => import('@/features/roles/RoleFormPage')) },
                { path: 'activity-logs', lazy: page(() => import('@/features/activity-logs/ActivityLogsPage')) },
                { path: 'activity-logs/:id', lazy: page(() => import('@/features/activity-logs/ActivityLogViewPage')) },

                { path: '*', lazy: page(() => import('@/features/NotFoundPage')) },
              ],
            },
          ],
        }],
      },
    ],
  },
])
