import {
  Building2, History, LayoutDashboard, Settings2, ShieldCheck, Users, UsersRound,
} from 'lucide-react'

/**
 * The app menu as a tree. A leaf has `to` (and usually a `permission`);
 * a group has `children`. Leaves the user may not see are hidden, and so are
 * groups that end up empty. Breadcrumbs and the Ctrl+K search are built from it too.
 */
export const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Administration',
    icon: Settings2,
    children: [
      {
        label: 'Organization',
        icon: Building2,
        children: [
          { to: '/companies', label: 'Companies', icon: Building2, permission: 'view_company' },
        ],
      },
      {
        label: 'User management',
        icon: UsersRound,
        children: [
          { to: '/users', label: 'Users', icon: Users, permission: 'view_user' },
          { to: '/roles', label: 'Roles & permissions', icon: ShieldCheck, permission: 'view_role' },
          { to: '/activity-logs', label: 'Activity logs', icon: History, permission: 'view_activity_log' },
        ],
      },
    ],
  },
]

/** The menu without the leaves `can` rejects, and without empty groups. */
export function visibleMenu(items, can) {
  return items
    .map((item) => (item.children ? { ...item, children: visibleMenu(item.children, can) } : item))
    .filter((item) => (item.children ? item.children.length > 0 : !item.permission || can(item.permission)))
}

export function menuLeaves(items = navigation, trail = []) {
  return items.flatMap((item) => (item.children
    ? menuLeaves(item.children, [...trail, item.label])
    : [{ ...item, trail }]))
}

export function isActive(item, pathname) {
  if (item.children) return item.children.some((child) => isActive(child, pathname))
  return item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)
}
