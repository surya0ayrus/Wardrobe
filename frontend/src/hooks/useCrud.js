import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, errorMessage } from '@/lib/api'

/**
 * Everything a module needs to talk to its API, e.g. useCrud('departments'):
 *
 *   const { useList, useRecord, save, remove, setStatus } = useCrud('departments')
 *   const list = useList({ search: 'abc', page: 2 })   // paginated list
 *   const department = useRecord(id)                    // one record
 *   save.mutate({ id: uuid, ...values })                // create (no id) or update; records are
 *                                                       // addressed by uuid (users: by id)
 *   remove.mutate(uuid)                                 // soft delete: gone from the app for good
 *   setStatus.mutate({ id, is_active })                // the Active switch in lists
 *
 * Lists and records are cached; saving refreshes them automatically.
 */
export function useCrud(resource, { label = 'Record' } = {}) {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [resource] })
    queryClient.invalidateQueries({ queryKey: ['lookups'] })
    queryClient.invalidateQueries({ queryKey: ['activity-logs'] })
  }
  const onError = (error) => toast.error(errorMessage(error))

  const save = useMutation({
    mutationFn: ({ id, ...values }) =>
      (id ? api.put(`/${resource}/${id}`, values) : api.post(`/${resource}`, values)).then((res) => res.data.data),
    onSuccess: (_, values) => {
      toast.success(`${label} ${values.id ? 'updated' : 'created'}.`)
      refresh()
    },
    onError: (error) => error.response?.status !== 422 && onError(error),
  })

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/${resource}/${id}`),
    onSuccess: () => {
      toast.success(`${label} deleted.`)
      refresh()
    },
    onError,
  })

  const setStatus = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/${resource}/${id}/status`, { is_active }),
    onSuccess: (_, { is_active }) => {
      toast.success(`${label} ${is_active ? 'activated' : 'deactivated'}.`)
      refresh()
    },
    onError,
  })

  return { useList: (params) => useList(resource, params), useRecord: (id) => useRecord(resource, id), save, remove, setStatus }
}

function useList(resource, params) {
  return useQuery({
    queryKey: [resource, 'list', params],
    queryFn: () => api.get(`/${resource}`, { params }).then((res) => res.data),
    placeholderData: keepPreviousData, // keep old rows visible while the next page loads
  })
}


//QueryKey - is used to uniquely identify the query in the cache.
//QueryFn - is the function that makes the API call and returns the data.

function useRecord(resource, id) {
  return useQuery({
    queryKey: [resource, 'record', id], // id is the record's uuid (one cache entry per record)
    queryFn: () => api.get(`/${resource}/${id}`).then((res) => res.data.data),
    enabled: !!id,
  })
}
