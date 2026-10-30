import { Building2, Hash, Mail, MapPin, Phone, Users } from 'lucide-react'
import { useParams } from 'react-router'
import { RequirePermission } from '@/auth/guards'
import { RecordView } from '@/components/RecordView'
import { EmptyState } from '@/components/ui/PageHeader'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useCrud } from '@/hooks/useCrud'

/** /companies/:id — one company, read-only (opened from the list; edited from the list's pencil). */
export default function CompanyViewPage() {
  const { id } = useParams()
  const { data: company, isLoading, isError } = useCrud('companies').useRecord(id)

  return (
    <RequirePermission permission="view_company">
      {isLoading ? <FullPageSpinner /> : isError ? <EmptyState title="Company not found" /> : (
        <RecordView
          title={company.name}
          subtitle={company.short_name}
          back={{ to: '/companies', label: 'companies' }}
          record={company}
          side={[{ title: 'Status & Identifiers', fields: [
            { label: 'Short name', value: company.short_name, bold: true, copy: true },
            { label: 'Users', value: String(company.users_count ?? 0), icon: Users },
          ] }]}
          main={[
            { title: 'Company details', columns: 3, fields: [
              { label: 'Name', value: company.name, icon: Building2, copy: true },
              { label: 'Email', value: company.email, icon: Mail, copy: true },
              { label: 'Phone', value: company.phone, icon: Phone, copy: true },
              { label: 'GSTIN', value: company.gstin, icon: Hash, copy: true },
              { label: 'PAN', value: company.pan, icon: Hash, copy: true },
            ] },
            { title: 'Address', columns: 3, fields: [
              { label: 'Address', value: company.address, icon: MapPin, span: 'full' },
              { label: 'City', value: company.city },
              { label: 'Pincode', value: company.pincode },
            ] },
          ]}
        />
      )}
    </RequirePermission>
  )
}
