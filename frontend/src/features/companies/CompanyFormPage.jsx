import { zodResolver } from '@hookform/resolvers/zod'
import { Building2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { RequirePermission } from '@/auth/guards'
import { FormPage } from '@/components/FormPage'
import { PhoneField, TextareaField, TextField } from '@/components/form/fields'
import { EmptyState } from '@/components/ui/PageHeader'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useCrud } from '@/hooks/useCrud'
import { applyServerErrors } from '@/lib/forms'

const optional = (max) => z.string().trim().max(max)

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the company name.').max(255),
  short_name: z.string().trim().min(1, 'Enter a short name.').max(20),
  email: z.union([z.literal(''), z.email('Enter a valid email.')]),
  phone: optional(20),
  gstin: optional(20),
  pan: optional(20),
  address: optional(1000),
  city: optional(100),
  pincode: optional(10),
})

const FIELDS = ['name', 'short_name', 'email', 'phone', 'gstin', 'pan', 'address', 'city', 'pincode']

/** Add (/companies/create) or edit (/companies/:id/edit). New companies start active. */
export default function CompanyFormPage() {
  const { id } = useParams()
  const { data: company, isLoading, isError } = useCrud('companies').useRecord(id)

  return (
    <RequirePermission permission={id ? 'update_company' : 'create_company'}>
      {id && isLoading ? <FullPageSpinner /> : isError ? <EmptyState title="Company not found" /> : <CompanyForm company={company} />}
    </RequirePermission>
  )
}

function CompanyForm({ company }) {
  const navigate = useNavigate()
  const { save } = useCrud('companies', { label: 'Company' })
  const back = { to: '/companies', label: 'companies' }

  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: Object.fromEntries(FIELDS.map((key) => [key, company?.[key] ?? ''])),
  })

  const onSubmit = async (values) => {
    try {
      // Empty optional fields are saved as null.
      await save.mutateAsync({ id: company?.uuid, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])) })
      navigate(back.to) // Back, Cancel and Save always return to the list
    } catch (error) {
      applyServerErrors(form, error)
    }
  }

  return (
    <FormPage
      form={form}
      onSubmit={onSubmit}
      saving={save.isPending}
      title={company ? `Edit ${company.name}` : 'Add company'}
      back={back}
      icon={Building2}
      section="Company details"
      sectionDescription="Name, contact details and registration numbers."
      submitLabel={company ? 'Save changes' : 'Add company'}
      onCancel={() => navigate(back.to)}
    >
      <TextField form={form} name="name" label="Name" required autoFocus placeholder="e.g. Acme Industries Pvt Ltd" />
      <TextField form={form} name="short_name" label="Short name" required placeholder="e.g. ACME" hint="Shown in the company switcher; saved in capitals." />
      <TextField form={form} name="email" label="Email" type="email" />
      <PhoneField form={form} name="phone" label="Phone" />
      <TextField form={form} name="gstin" label="GSTIN" />
      <TextField form={form} name="pan" label="PAN" />
      <TextareaField form={form} name="address" label="Address" className="sm:col-span-2" />
      <TextField form={form} name="city" label="City" />
      <TextField form={form} name="pincode" label="Pincode" inputMode="numeric" />
    </FormPage>
  )
}
