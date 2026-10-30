import { useLocation } from 'react-router'
import { isActive, menuLeaves } from '@/layouts/navigation'

// Labels for path parts after a menu page (/companies/:id/edit -> Companies › View › Edit).
const extra = { create: 'Add', edit: 'Edit' }

export function useBreadcrumbs() {
  const { pathname } = useLocation()
  const leaf = menuLeaves().find((item) => isActive(item, pathname))
  if (!leaf) return []

  const crumbs = [...leaf.trail.map((label) => ({ label })), { label: leaf.label, to: leaf.to }]
  let path = leaf.to.replace(/\/$/, '')
  pathname.slice(leaf.to.length).split('/').filter(Boolean).forEach((part) => {
    path += `/${part}`
    crumbs.push({ label: extra[part] ?? 'View', to: path })
  })

  return crumbs
}
