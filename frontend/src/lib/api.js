import axios from 'axios'

/**
 * One shared HTTP client for the whole app.
 * Sends the session cookie and the XSRF token that Laravel Sanctum expects.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

/** Must be called once before login so Laravel sets the XSRF cookie. */
export function fetchCsrfCookie() {
  return axios.get('/sanctum/csrf-cookie', { withCredentials: true })
}

/** Readable message from any API error. */
export function errorMessage(error) {
  const data = error?.response?.data
  if (data?.errors) return Object.values(data.errors)[0]?.[0]
  return data?.message || error?.message || 'Something went wrong.'
}

// 419 (stale XSRF token) -> get a fresh token and retry once.
// Session expired -> back to login. Password change pending -> change password page.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const path = window.location.pathname

    // The XSRF-TOKEN cookie can go stale, e.g. when another local app on localhost overwrote it
    // (cookies are shared across ports) or after a long idle. The session itself may be fine.
    if (status === 419 && error.config && !error.config.retriedAfterCsrf) {
      await fetchCsrfCookie()
      return api({ ...error.config, retriedAfterCsrf: true })
    }

    if ((status === 401 || status === 419) && path !== '/login') {
      window.location.assign('/login')
    }
    if (error.response?.data?.code === 'password_change_required' && path !== '/change-password') {
      window.location.assign('/change-password')
    }
    return Promise.reject(error)
  },
)
