import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { useAuth } from '@/auth/useAuth'
import { isDarkTheme } from '@/lib/preferences'

/**
 * Puts the .dark class on <html> from the user's theme choice.
 * With "system" it follows the phone / PC setting live.
 * Also renders the toast area in the matching theme.
 */
export function ThemeSync() {
  const { preferences } = useAuth()
  const theme = preferences.theme
  const [dark, setDark] = useState(() => isDarkTheme(theme))

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const next = isDarkTheme(theme)
      document.documentElement.classList.toggle('dark', next)
      setDark(next)
    }
    apply()
    if (theme !== 'system') return undefined
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return <Toaster position="top-right" offset={{ top: 72 }} mobileOffset={{ top: 72 }} richColors closeButton theme={dark ? 'dark' : 'light'} />
}
