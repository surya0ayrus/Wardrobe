import { ActiveStatus, Section } from '@/components/CrudViewPage'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDateTime } from '@/lib/format'

/**
 * The one layout for every view page (/<module>/:id), opened by clicking a row in a list:
 * a narrow column (status, identifiers) and a wide one (details), each a stack of label/value
 * sections, with Back at the top. Read-only: editing is only from the list (its pencil icon).
 *
 *   <RecordView title={item.value} back={{ to, label }}
 *     side={[{ title: 'Status', fields: [...] }]} main={[{ title: 'Details', columns: 2, fields: [...] }]} record={item} />
 *
 * With `record`, a Status entry is added to the first side section and a "Record" section
 * (created / updated by and when) to the main column.
 */
export function RecordView({ title, subtitle, back, side = [], main = [], record }) {

  const [first, ...otherSide] = side.length ? side : [{ title: 'Status', fields: [] }]
  const sideSections = record
    ? [{ ...first, fields: [{ label: 'Status', value: <ActiveStatus record={record} /> }, ...first.fields] }, ...otherSide]
    : side
  const mainSections = record ? [...main, auditSection(record)] : main

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        back={back}
      />
      <div className="grid items-start gap-4 lg:grid-cols-4">
        <div className="grid gap-4">
          {sideSections.map((section) => <Section key={section.title} {...section} />)}
        </div>
        <div className="grid gap-4 lg:col-span-3">
          {mainSections.map((section) => <Section key={section.title} {...section} />)}
        </div>
      </div>
    </>
  )
}

function auditSection(record) {
  const by = (who, when) => (when ? `${formatDateTime(when)}${who?.name ? ` · ${who.name}` : ''}` : null)
  return {
    title: 'Record',
    columns: 2,
    fields: [
      { label: 'Created', value: by(record.created_by, record.created_at) },
      { label: 'Last updated', value: by(record.updated_by, record.updated_at) },
    ],
  }
}
