import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // reuse fetched data for 30s before refetching
      // Retry once only when the server or network failed; 4xx (not found, no access) will not change.
      retry: (failures, error) => failures < 1 && !(error?.response?.status < 500),
      refetchOnWindowFocus: false,
    },
  },
})
