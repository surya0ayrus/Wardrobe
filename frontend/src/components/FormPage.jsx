import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Section } from '@/components/ui/Section'

/**
 * The one layout for every add / edit page (/<module>/create, /<module>/:id/edit),
 * so all forms look and behave the same: title with a back link, the fields in a
 * section card, and Cancel / Save in a bar that stays visible at the bottom.
 *
 *   <FormPage form={form} onSubmit={save} saving={isPending} title="Add item" back={{ to, label }}
 *     icon={ListChecks} section="Item details" submitLabel="Add item" onCancel={() => navigate(to)}>
 *     <TextField … />
 *   </FormPage>
 *
 * Status (Active) is never on the form: new records start active and are switched from the list.
 */
export function FormPage({ form, onSubmit, saving, title, subtitle, back, icon, section, sectionDescription, submitLabel, onCancel, children }) {
  const submit = form.handleSubmit(onSubmit, () => toast.error('Please check the highlighted fields.'))

  return (
    <form onSubmit={submit} noValidate className="pb-4">
      {/* No title when the page already has one (e.g. a tab of Settings). */}
      {title && <PageHeader title={title} subtitle={subtitle} back={back} />}

      {/* Long forms leave out `section` and pass their own <Section>s as children. */}
      {section ? (
        <Section icon={icon} title={section} description={sectionDescription}>
          <div className="grid gap-4 sm:grid-cols-2">{children}</div>
        </Section>
      ) : <div className="space-y-4">{children}</div>}

      <div className="sticky bottom-0 z-10 -mx-3 mt-4 flex justify-end gap-2 border-t border-border bg-card/90 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  )
}
