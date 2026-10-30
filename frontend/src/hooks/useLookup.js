import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Dropdown options from /api/lookups/{name}.
 *   useLookup('roles')
 * Pass enabled: false to wait (e.g. until another field is set).
 */
export function useLookup(name, params = {}, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['lookups', name, params],
    queryFn: () => api.get(`/lookups/${name}`, { params }).then((res) => res.data),
    staleTime: 5 * 60_000,
    enabled,
  })
}
