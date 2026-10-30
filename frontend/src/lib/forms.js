/**
 * Puts Laravel 422 errors onto the matching fields (nested names like companies.0.department_id work too).
 * Returns true when the error was a validation error.
 */
export function applyServerErrors(form, error) {
  const errors = error?.response?.status === 422 ? error.response.data.errors : null
  if (!errors) return false

  Object.entries(errors).forEach(([name, messages], index) => {
    form.setError(name, { type: 'server', message: messages[0] }, { shouldFocus: index === 0 })
  })
  return true
}
