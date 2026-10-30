import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { get, useController } from 'react-hook-form'
import { DatePicker } from '@/components/ui/DatePicker'
import { Input, Switch, Textarea } from '@/components/ui/inputs'
import { Select } from '@/components/ui/Select'
import { useLookup } from '@/hooks/useLookup'

/**
 * Form fields for react-hook-form. Each takes the `form` from useForm() and a `name`:
 *   <TextField form={form} name="name" label="Name" required />
 * Errors (from the schema or from the server) show under the field.
 */

/** Label + input + error message. */
export function FormField({ label, error, hint, required, htmlFor, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  )
}

function fieldError(form, name) {
  return get(form.formState.errors, name)?.message
}

/** Text input. An onBlur prop runs after the form's own blur handling (validation). */
export function TextField({ form, name, label, required, hint, type = 'text', className, onBlur, ...props }) {
  const error = fieldError(form, name)
  const field = form.register(name)
  return (
    <FormField label={label} error={error} hint={hint} required={required} htmlFor={name} className={className}>
      <Input
        id={name} type={type} aria-invalid={!!error} {...field} {...props}
        onBlur={async (e) => { await field.onBlur(e); onBlur?.(e) }}
      />
    </FormField>
  )
}

/**
 * Phone input. Anything can be typed; the form schema (optionalPhone) and the server
 * refuse to save it unless it is a valid number, and the error shows under the field.
 */
export function PhoneField(props) {
  return <TextField type="tel" inputMode="tel" autoComplete="tel" {...props} />
}

/** Password input with a show / hide button. */
export function PasswordField({ form, name, label, required, hint, className, ...props }) {
  const [visible, setVisible] = useState(false)
  const error = fieldError(form, name)
  return (
    <FormField label={label} error={error} hint={hint} required={required} htmlFor={name} className={className}>
      <div className="flex">
        <Input id={name} type={visible ? 'text' : 'password'} aria-invalid={!!error} className="rounded-r-none" {...form.register(name)} {...props} />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="flex w-11 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-border bg-card text-muted hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
        </button>
      </div>
    </FormField>
  )
}

export function TextareaField({ form, name, label, required, hint, className, ...props }) {
  const error = fieldError(form, name)
  return (
    <FormField label={label} error={error} hint={hint} required={required} htmlFor={name} className={className}>
      <Textarea id={name} aria-invalid={!!error} {...form.register(name)} {...props} />
    </FormField>
  )
}

/** Dropdown with fixed options: [{ value, label }]. */
export function SelectField({ form, name, label, options, required, hint, placeholder, className, onChange, isMulti }) {
  const { field, fieldState } = useController({ control: form.control, name })
  return (
    <FormField label={label} error={fieldState.error?.message} hint={hint} required={required} htmlFor={name} className={className}>
      <Select
        inputId={name}
        value={field.value}
        onChange={(value) => { field.onChange(value); onChange?.(value) }}
        onBlur={field.onBlur}
        options={options}
        placeholder={placeholder}
        isMulti={isMulti}
        isClearable={!required}
        invalid={!!fieldState.error}
      />
    </FormField>
  )
}

/**
 * Dropdown filled from /api/lookups/{lookup}.
 *   <LookupField form={form} name="department_id" lookup="departments" params={{ company_id }} />
 * With `requires`, the list waits until that value is set (e.g. departments need a company).
 */
export function LookupField({ form, name, label, lookup, params = {}, requires, required, hint, className, onChange, placeholder, optionLabel }) {
  const ready = requires === undefined || !!requires
  const { data = [], isLoading } = useLookup(lookup, params, { enabled: ready })
  const options = data.map((item) => ({
    value: item.id,
    label: optionLabel ? optionLabel(item) : item.code ? `${item.name} (${item.code})` : item.name,
  }))

  return (
    <SelectField
      form={form}
      name={name}
      label={label}
      options={options}
      required={required}
      hint={hint}
      className={className}
      onChange={onChange}
      placeholder={!ready ? 'Select the previous field first' : isLoading ? 'Loading…' : placeholder}
    />
  )
}

/**
 * Date with a calendar popup; the form value is "yyyy-MM-dd" or null. With `withTime` it also
 * has hour / minute and the value is "yyyy-MM-ddTHH:mm". `minDate` / `maxDate` limit the days.
 */
export function DateField({ form, name, label, required, hint, className, fromYear, toYear, minDate, maxDate, withTime }) {
  const { field, fieldState } = useController({ control: form.control, name })
  return (
    <FormField label={label} error={fieldState.error?.message} hint={hint} required={required} htmlFor={name} className={className}>
      <DatePicker id={name} value={field.value} onChange={field.onChange} invalid={!!fieldState.error} fromYear={fromYear} toYear={toYear} minDate={minDate} maxDate={maxDate} withTime={withTime} />
    </FormField>
  )
}

export function SwitchField({ form, name, label, hint }) {
  const { field } = useController({ control: form.control, name })
  return (
    <FormField hint={hint}>
      <Switch checked={!!field.value} onChange={field.onChange} label={label} />
    </FormField>
  )
}
