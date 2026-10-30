import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { AuthContext } from '@/auth/useAuth'
import { api, errorMessage, fetchCsrfCookie } from '@/lib/api'
import { readStoredPreferences, storePreferences } from '@/lib/preferences'

/**
 * Holds the logged-in session: user, roles, permissions, companies.
 * Everything else reads it through useAuth() / useCan().
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient()

  // Drop cached data from the previous user / company, but keep the session entry itself.
  const clearData = useCallback(
    () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' }),
    [queryClient],
  )


  

  const { data: session, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: () => api.get('/auth/me').then((res) => res.data).catch(() => null),
    staleTime: Infinity,
    retry: false,
  })


  const login = useCallback(async (values) => {
    await fetchCsrfCookie()
    const { data } = await api.post('/auth/login', values)
    clearData()
    queryClient.setQueryData(['session'], data)
    return data
  }, [queryClient, clearData])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => { })
    clearData()
    queryClient.setQueryData(['session'], null)
  }, [queryClient, clearData])

  const setSession = useCallback((data) => queryClient.setQueryData(['session'], data), [queryClient])

  /** Switching company: every cached list belongs to the old company, so drop them. */
  const switchCompany = useCallback(async (companyId) => {
    await api.put('/auth/company', { company_id: companyId })
    clearData()
    queryClient.setQueryData(['session'], (current) => ({ ...current, current_company_id: companyId }))
  }, [queryClient, clearData])

  const preferences = useMemo(
    () => ({ ...readStoredPreferences(), ...session?.preferences }),
    [session?.preferences],
  )

  // Keep a copy in the browser, so the theme is right even before /auth/me answers.
  useEffect(() => storePreferences(preferences), [preferences])

  /** setPreference('theme', 'dark'): applies at once, then saves to the server. */
  const setPreference = useCallback(async (key, value) => {
    const previous = queryClient.getQueryData(['session'])
    queryClient.setQueryData(['session'], (current) => current && { ...current, preferences: { ...current.preferences, [key]: value } })
    try {
      await api.put('/auth/preferences', { [key]: value })
    } catch (error) {
      queryClient.setQueryData(['session'], previous)
      toast.error(errorMessage(error))
    }
  }, [queryClient])

  const value = useMemo(() => {
    const permissions = new Set(session?.permissions ?? [])
    const isSuperAdmin = !!session?.user?.is_super_admin
    return {
      session,
      user: session?.user ?? null,
      isLoading,
      companies: session?.companies ?? [],
      currentCompany: session?.companies?.find((c) => c.id === session.current_company_id) ?? null,
      can: (permission) => isSuperAdmin || permissions.has(permission),
      preferences,
      setPreference,
      login,
      logout,
      setSession,
      switchCompany,
    }
  }, [session, isLoading, login, logout, setSession, switchCompany, preferences, setPreference])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
