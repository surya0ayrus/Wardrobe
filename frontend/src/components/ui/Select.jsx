import { useLayoutEffect, useRef, useState } from 'react'
import ReactSelect, { createFilter } from 'react-select'
import AsyncSelect from 'react-select/async'
import { cn } from '@/lib/utils'

/**
 * Dropdown built on react-select, styled with the app's colour tokens (light + dark).
 * Works with plain values instead of option objects:
 *
 *   <Select value={stateId} onChange={setStateId} options={[{ value: 1, label: 'Tamil Nadu' }]} />
 *   <Select isMulti value={[1, 2]} onChange={setIds} options={…} />
 *   <Select loadOptions={(text) => fetch…} selected={{ value, label }} />   // searches the server
 *   <Select options={[{ label: 'PPE', options: [{ value, label }] }]} />    // grouped under headings
 *
 * Search appears automatically when there are more than 6 options. It looks at the label and its
 * group heading only (typing "Suzlon" lists Suzlon's models), never at the value: values are ids
 * and uuids, so react-select's default would match "4" or "a" against nearly every option.
 * The menu opens as a fixed layer on top of the page (outside its card), so cards, dialogs and
 * the sticky Save bar of form pages never cut it off or cover it. Inside a modal <dialog> the
 * menu goes into the dialog: the browser draws an open modal above everything else on the page,
 * so a menu left on <body> would open hidden behind it.
 */
export function Select({
  value,
  onChange,
  options = [],
  loadOptions,
  selected,
  isMulti = false,
  isClearable = true,
  isSearchable,
  placeholder = 'Select…',
  invalid = false,
  size = 'md',
  className,
  ...props
}) {
  const wrapper = useRef(null)
  const [portal, setPortal] = useState(null)
  useLayoutEffect(() => setPortal(wrapper.current.closest('dialog') ?? document.body), [])

  const same = (a, b) => String(a) === String(b)
  // Each grouped option remembers its heading, for search.
  const choices = options.map((option) => (option.options ? { ...option, options: option.options.map((child) => ({ ...child, group: option.label })) } : option))
  const flat = choices.flatMap((option) => option.options ?? [option]) // grouped options too

  const current = loadOptions
    ? selected ?? null
    : isMulti
      ? flat.filter((option) => (value ?? []).some((v) => same(v, option.value)))
      : flat.find((option) => value !== null && value !== undefined && value !== '' && same(option.value, value)) ?? null

  const change = (picked) => {
    if (isMulti) onChange((picked ?? []).map((option) => option.value))
    else onChange(picked?.value ?? null, picked)
  }

  const shared = {
    value: current,
    onChange: change,
    isMulti,
    isClearable,
    placeholder,
    unstyled: true,
    classNamePrefix: 'rs',
    menuPosition: 'fixed',
    menuPortalTarget: portal,
    // Set here, not as a class: react-select puts z-index: 1 inline on the portal.
    styles: { menuPortal: (base) => ({ ...base, zIndex: 60 }) },
    menuPlacement: 'auto',
    closeMenuOnSelect: !isMulti,
    // The menu is a fixed layer: close it when the page scrolls, but not when the menu itself scrolls.
    closeMenuOnScroll: (event) => !(event.target instanceof Element && event.target.closest('.rs__menu')),
    classNames: selectClassNames({ invalid, size }),
    ...props,
  }

  return (
    // Enter never submits the form from here: react-select lets it through when the menu is closed
    // (e.g. a second Enter after picking), which would show every error of an unfinished form.
    <div ref={wrapper} className={className} onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}>
      {loadOptions ? (
        <AsyncSelect {...shared} loadOptions={loadOptions} defaultOptions cacheOptions />
      ) : (
        <ReactSelect filterOption={searchLabel} {...shared} options={choices} isSearchable={isSearchable ?? flat.length > 6} />
      )}
    </div>
  )
}

const searchLabel = createFilter({ stringify: (option) => `${option.data.group ?? ''} ${option.label}` })

function selectClassNames({ invalid, size }) {
  return {
    groupHeading: () => 'px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase',
    control: ({ isFocused, isDisabled }) => cn(
      'cursor-pointer rounded-lg border bg-card px-3 text-base text-ink shadow-xs transition-colors sm:text-sm',
      size === 'sm' ? 'min-h-9' : 'min-h-10',
      isFocused ? 'border-primary ring-4 ring-primary/10' : 'border-border hover:border-muted/40',
      invalid && 'border-danger ring-danger/10',
      isDisabled && 'cursor-not-allowed bg-subtle opacity-70',
    ),
    valueContainer: () => 'gap-1 py-1',
    placeholder: () => 'text-muted/80 truncate',
    singleValue: () => 'text-ink truncate',
    input: () => 'text-ink',
    indicatorsContainer: () => 'gap-0.5 text-muted',
    dropdownIndicator: ({ isFocused }) => cn('p-1 hover:text-ink', isFocused && 'text-ink'),
    clearIndicator: () => 'p-1 hover:text-danger',
    indicatorSeparator: () => 'my-2 w-px bg-border',
    multiValue: () => 'items-center rounded-full bg-primary-soft py-0.5 pr-0.5 pl-2.5 text-xs text-primary-ink',
    multiValueLabel: () => 'pr-1',
    multiValueRemove: () => 'rounded-full p-0.5 hover:bg-primary/15',
    menu: () => 'z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card text-ink shadow-xl shadow-black/5',
    menuList: () => 'max-h-64 p-1',
    option: ({ isFocused, isSelected }) => cn(
      'cursor-pointer rounded-md px-2.5 py-2 text-sm',
      isSelected ? 'bg-primary-soft font-medium text-primary-ink' : isFocused && 'bg-subtle',
    ),
    noOptionsMessage: () => 'px-3 py-2 text-sm text-muted',
    loadingMessage: () => 'px-3 py-2 text-sm text-muted',
  }
}
