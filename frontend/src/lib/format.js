import { format } from 'date-fns'

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/** 30 Sep 2026 */
export function formatDate(value) {
  return value ? dateFormat.format(new Date(value)) : '—'
}

/** 30 Sep 2026, 01:30 pm */
export function formatDateTime(value) {
  return value ? dateTimeFormat.format(new Date(value)) : '—'
}

/** date-fns pattern of date-times: 23-10-2026, 05:10PM */
export const DATE_TIME_FORMAT = 'dd-MM-yyyy, hh:mma'

/** 23-10-2026, 05:10PM (the date-time picker) */
export function formatDateTimeNumeric(value) {
  return value ? format(new Date(value), DATE_TIME_FORMAT) : '—'
}

/** "view_user" -> "View user" */
export function humanize(text) {
  if (!text) return ''
  const words = String(text).replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
