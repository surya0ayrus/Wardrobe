const KEY = 'app-preferences' // also read by index.html (theme before React loads)

export const DEFAULT_PREFERENCES = { nav_style: 'top', theme: 'system' }

/** Last known preferences from this browser (the server copy wins once loaded). */
export function readStoredPreferences() {
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function storePreferences(preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences))
  } catch {
   
  }
}

/** 'light' | 'dark' | 'system' -> is dark right now? */
export function isDarkTheme(theme) {
  return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}
