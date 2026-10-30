import { humanize } from '@/lib/format'

/**
 * Shared meaning of activity log actions: label, badge colour and risk level.
 * Used by the activity log list, the detail page and the History timelines.
 */
const ACTIONS = {
  created: { label: 'Created', tone: 'green' },
  updated: { label: 'Updated', tone: 'teal' },
  links_updated: { label: 'Links updated', tone: 'teal' },
  roles_updated: { label: 'Roles updated', tone: 'amber' },
  deleted: { label: 'Deleted', tone: 'red' },
  force_deleted: { label: 'Deleted permanently', tone: 'red' },
  restored: { label: 'Restored', tone: 'amber' },
  login: { label: 'Login', tone: 'teal' },
  logout: { label: 'Logout', tone: 'gray' },
  login_failed: { label: 'Login failed', tone: 'red' },
  password_changed: { label: 'Password changed', tone: 'amber' },
  password_reset: { label: 'Password reset', tone: 'amber' },
  imported: { label: 'Imported', tone: 'green' }, // bulk import (one entry per file)
}

export const ACTION_NAMES = Object.keys(ACTIONS)

export function actionLabel(action) {
  return ACTIONS[action]?.label ?? humanize(action)
}

export function actionTone(action) {
  return ACTIONS[action]?.tone ?? 'gray'
}

/** Failed logins high, deletes medium, changes low. */
export function riskLevel(action) {
  if (action === 'login_failed') return { label: 'High', tone: 'red' }
  if (['deleted', 'force_deleted', 'roles_updated', 'password_reset'].includes(action)) return { label: 'Medium', tone: 'amber' }
  if (['updated', 'links_updated', 'password_changed', 'restored'].includes(action)) return { label: 'Low', tone: 'teal' }
  return { label: 'Normal', tone: 'green' }
}

/** module (morph name) -> list path. Add each new module that has a view page. */
const recordPages = { role: 'roles', company: 'companies' }

/** Where a logged record can be opened in the app (its view page), by its public uuid (null = no page for it). */
export function recordPath(module, uuid) {
  return module && uuid && recordPages[module] ? `/${recordPages[module]}/${uuid}` : null
}

/**
 * Rows for the "Data changes" table:
 * only a new value = added, only an old value = removed, both = modified.
 */
export function changeRows(log) {
  const oldValues = log.old_values ?? {}
  const newValues = log.new_values ?? {}
  const keys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])]

  return keys.map((key) => {
    const hasOld = key in oldValues
    const hasNew = key in newValues
    return {
      key,
      old: oldValues[key],
      new: newValues[key],
      type: hasOld && hasNew ? 'modified' : hasNew ? 'added' : 'removed',
    }
  })
}
