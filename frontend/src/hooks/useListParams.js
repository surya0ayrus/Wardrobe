import { useCallback, useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router'

/**
 * List state (search, filters, sort, page) kept in the URL,
 * so refresh / back / sharing a link keeps the same view.
 * Every list starts newest first (sort "-id") unless a page says otherwise.
 */
export function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { state } = useLocation() // kept when a filter changes: where Back goes (useBack)

  const params = useMemo(
    () => ({ page: 1, sort: '-id', ...defaults, ...Object.fromEntries(searchParams) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams],
  )

  /** setParam('status', 'active') – any change except page resets to page 1. */
  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === '' || value === null || value === undefined) next.delete(key)
      else next.set(key, value)
      if (key !== 'page') next.delete('page')
      return next
    }, { replace: true, state })
  }, [setSearchParams, state])

  return { params, setParam }
}
