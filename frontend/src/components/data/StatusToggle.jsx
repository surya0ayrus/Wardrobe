import { useAuth } from '@/auth/useAuth'
import { Switch } from '@/components/ui/inputs'
import { useCrud } from '@/hooks/useCrud'

/**
 * The Active switch in a list row: PATCH /{resource}/{id}/status.
 * Read-only without update_{permission}. Records are addressed by uuid (users, which have none, by id).
 */
export function StatusToggle({ resource, permission, record, label = 'Record' }) {
  const { can } = useAuth()
  const { setStatus } = useCrud(resource, { label })

  return (
    // Keep the click from also opening the row.
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <Switch
        checked={record.is_active}
        disabled={!can(`update_${permission}`) || setStatus.isPending}
        onChange={(is_active) => setStatus.mutate({ id: record.uuid ?? record.id, is_active })}
        label={<span className="text-xs text-muted">{record.is_active ? 'Active' : 'Inactive'}</span>}
      />
    </span>
  )
}
