import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'

/**
 * "← Back" button, shown at the right of a page header. Goes to `to` (the module's list page),
 * or runs `go` instead (useBack: back to the page this one was opened from).
 *   <BackLink to="/users" label="users" />
 *   <BackLink {...useBack('/companies', 'companies')} />
 */
export function BackLink({ to, go, label, className }) {
  const navigate = useNavigate()

  return (
    <Button
      variant="secondary"
      title={`Back to ${label}`}
      onClick={go ?? (() => navigate(to))}
      className={className}
    >
      <ArrowLeft className="size-4" /> Back
    </Button>
  )
}
