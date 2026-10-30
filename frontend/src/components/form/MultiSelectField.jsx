import { SelectField } from '@/components/form/fields'

/**
 * Pick several items (searchable dropdown). Stores an array of ids.
 *   <MultiSelectField form={form} name="role_ids" label="Roles" options={[{ value: 1, label: 'HR Admin' }]} />
 */
export function MultiSelectField({ form, name, label, options = [], hint, loading, placeholder, required, className, onChange }) {
  return (
    <SelectField
      form={form}
      name={name}
      label={label}
      options={options}
      hint={hint}
      required={required}
      className={className}
      isMulti
      onChange={onChange}
      placeholder={loading ? 'Loading…' : placeholder ?? 'Select one or more…'}
    />
  )
}
