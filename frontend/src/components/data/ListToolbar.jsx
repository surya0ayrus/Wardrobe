import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FilterSelect } from '@/components/data/FilterSelect'
import { Input } from '@/components/ui/inputs'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

/**
 * Search box + status filter, wired to useListParams().
 * Extra filters (e.g. state) go in as children; status={false} leaves out the status filter
 * (lists with no inactive rows).
 * On phones the filters fold away behind a "Filters" button to keep the list visible.
 */
export function ListToolbar({ params, setParam, searchPlaceholder = 'Search…', status = true, children }) {
  const [search, setSearch] = useState(params.search ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const debounced = useDebounce(search)
  const hasFilters = status || Boolean(children)
  const activeFilters = Object.entries(params).filter(([key, value]) => !['search', 'sort', 'page', 'per_page'].includes(key) && value !== '').length

  useEffect(() => {
    if ((params.search ?? '') !== debounced) setParam('search', debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex gap-2 sm:flex-1">
        <div className="relative flex-1 sm:min-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} className="pl-9" />
        </div>
        {hasFilters && <Button variant="secondary" className="relative sm:hidden" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
          <SlidersHorizontal className="size-4" /> Filters
          {activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-white">{activeFilters}</span>}
        </Button>}
      </div>
      {hasFilters && (
        <div className={cn('grid-cols-2 gap-2 sm:flex', showFilters ? 'grid' : 'hidden')}>
          {children}
          {status && (
            <FilterSelect
              name="status" params={params} setParam={setParam} placeholder="All status" className="sm:w-36"
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            />
          )}
        </div>
      )}
    </div>
  )
}
