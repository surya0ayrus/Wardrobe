import { AtSign, Clock, Mail, Phone } from 'lucide-react'
import { useParams } from 'react-router'
import { RequirePermission } from '@/auth/guards'
import { RecordView } from '@/components/RecordView'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/PageHeader'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useCrud } from '@/hooks/useCrud'
import { formatDateTime } from '@/lib/format'

/** /users/:id — one login, read-only (opened from the list). */
export default function UserViewPage() {
  const { id } = useParams()
  const { data: user, isLoading, isError } = useCrud('users').useRecord(id)

  return (
    <RequirePermission permission="view_user">
      {isLoading ? <FullPageSpinner /> : isError ? <EmptyState title="User not found" /> : (
        <RecordView
          title={user.name}
          subtitle={`@${user.username}`}
          back={{ to: '/users', label: 'users' }}
          record={user}
          side={[{ title: 'Status & Access', fields: [
            { label: 'Password', value: user.is_first_login ? 'Default (must change at next login)' : 'Set by the user' },
            { label: 'Last login', value: user.last_login_at ? formatDateTime(user.last_login_at) : 'Never', icon: Clock },
          ] }]}
          main={[
            { title: 'Login details', columns: 3, fields: [
              { label: 'Username', value: user.username, icon: AtSign, copy: true },
              { label: 'Email', value: user.email, icon: Mail, copy: true },
              { label: 'Phone', value: user.phone, icon: Phone, copy: true },
            ] },
            { title: 'Roles & companies', columns: 2, fields: [
              { label: 'Roles', value: user.roles?.length ? <span className="flex flex-wrap gap-1">{user.roles.map((r) => <Badge key={r.id}>{r.name}</Badge>)}</span> : null },
              { label: 'Companies', value: user.companies?.length ? <span className="flex flex-wrap gap-1">{user.companies.map((c) => <Badge key={c.id} tone="teal">{c.short_name} · {c.name}</Badge>)}</span> : null },
            ] },
          ]}
        />
      )}
    </RequirePermission>
  )
}
