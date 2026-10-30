import { Select } from '@/components/ui/Select'

/**
 * List filter dropdown tied to a URL parameter (useListParams).
 *   <FilterSelect name="state_id" params={params} setParam={setParam} options={…} placeholder="All states" />
 */
export function FilterSelect({ name, params, setParam, options, placeholder, className = 'sm:w-44', onChange }) {
  return (
    <Select
      aria-label={placeholder}
      value={params[name] ?? null}
      onChange={(value) => { setParam(name, value ?? ''); onChange?.(value) }}
      options={options}
      placeholder={placeholder}
      className={className}
    />
  )
}
