import {
  Check, ChevronDown, ChevronRight, KeyRound, LogOut, Menu, Monitor, Moon, PanelLeft, PanelTop, Search, Sun, X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/auth/useAuth'
import { Logo, LogoMark } from '@/components/ui/Logo'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useClickOutside } from '@/hooks/useClickOutside'
import { CommandPalette } from '@/layouts/CommandPalette'
import { isActive, navigation, visibleMenu } from '@/layouts/navigation'
import { useBreadcrumbs } from '@/layouts/useBreadcrumbs'
import { errorMessage } from '@/lib/api'
import { isDarkTheme } from '@/lib/preferences'
import { cn } from '@/lib/utils'


export default function AppLayout() {
  const { preferences } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const topBar = preferences.nav_style === 'top'

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={cn('min-h-dvh', !topBar && 'lg:pl-64')}>
      {/* Slide-out menu (phones always; desktop in sidebar mode) */}
      <div
        className={cn('fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden', menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card transition-transform lg:w-64',
          menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          topBar ? 'lg:hidden' : 'lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-5">
          <Logo className="min-w-0" />
          <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-subtle lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <SidebarMenu onNavigate={() => setMenuOpen(false)} />
        <SidebarProfile />
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-card/75 px-3 backdrop-blur-xl sm:px-6">
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-subtle lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        {topBar && (
          <>
            <Link to="/" className="mr-6 hidden shrink-0 lg:block"><Logo /></Link>
            <TopMenu />
          </>
        )}
        <LogoMark className="size-7 text-sm lg:hidden" />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <SearchButton onClick={() => setSearchOpen(true)} />
          <ThemeToggle />
          <CompanySwitcher />
          <UserMenu />
        </div>
      </header>

      <main key={pathname} className="w-full animate-page p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
        {/* The trail sits above the page (below the header) in both layouts. */}
        {/* <Breadcrumbs /> */}
        <Outlet />
      </main>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

/** Menu tree the user may see (leaves filtered by permission, empty groups dropped). */
function useMenu() {
  const { can } = useAuth()
  return visibleMenu(navigation, can)
}

/** Keys ("Administration/Masters") of every group in the menu tree. */
function groupKeys(items, path = []) {
  return items.flatMap((item) => (item.children
    ? [[...path, item.label].join('/'), ...groupKeys(item.children, [...path, item.label])]
    : []))
}

const related = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)

/**
 * Accordion: only the groups leading to the current page are open. Opening another group
 * closes the ones beside it (anything not above or below it); going to another page starts
 * again from that page's groups. Choices are kept per page, not remembered across visits.
 */
function useOpenGroups(items, pathname) {
  const [state, setState] = useState({ pathname, keys: {} })
  const keys = state.pathname === pathname ? state.keys : {}

  const toggle = useCallback((key, value) => setState((current) => {
    const base = current.pathname === pathname ? current.keys : {}
    const next = { ...base, [key]: value }
    if (value) {
      for (const other of groupKeys(items)) {
        if (!related(other, key)) next[other] = false
      }
    }
    return { pathname, keys: next }
  }), [items, pathname])

  return [keys, toggle]
}

function SidebarMenu({ onNavigate }) {
  const items = useMenu()
  const { pathname } = useLocation()
  const [open, toggle] = useOpenGroups(items, pathname)

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
      {items.map((item) => (
        <SidebarItem key={item.label} item={item} depth={0} path={[]} pathname={pathname} open={open} toggle={toggle} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

/** One menu entry: a link, or a group that expands to show its children. */
function SidebarItem({ item, depth, path, pathname, open, toggle, onNavigate }) {
  const Icon = item.icon
  const row = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors'

  if (item.children) {
    const key = [...path, item.label].join('/')
    const active = isActive(item, pathname)
    const expanded = open[key] ?? active // your choice on this page, else open only on the current page's path

    return (
      <div>
        <button
          type="button"
          onClick={() => toggle(key, !expanded)}
          aria-expanded={expanded}
          className={cn(row, 'font-medium hover:bg-subtle', active ? 'text-ink' : 'text-muted hover:text-ink')}
        >
          <Icon className={cn('shrink-0', depth === 0 ? 'size-4.5' : 'size-4', active ? 'text-primary-ink' : 'text-muted/80')} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted/70 transition-transform', !expanded && '-rotate-90')} />
        </button>
        {expanded && (
          <div className="mt-0.5 ml-[1.1rem] space-y-0.5 border-l border-border pl-2">
            {item.children.map((child) => (
              <SidebarItem key={child.label} item={child} depth={depth + 1} path={[...path, item.label]} pathname={pathname} open={open} toggle={toggle} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive: current }) => cn(
        row, 'group font-medium',
        current ? 'bg-primary-soft text-primary-ink' : 'text-muted hover:bg-subtle hover:text-ink',
      )}
    >
      {({ isActive: current }) => (
        <>
          <Icon className={cn('shrink-0', depth === 0 ? 'size-4.5' : 'size-4', current ? 'text-primary-ink' : 'text-muted/80 group-hover:text-ink')} />
          <span className="flex-1">{item.label}</span>
          {current && <span className="size-1.5 rounded-full bg-accent" />}
        </>
      )}
    </NavLink>
  )
}

/** Who is logged in, at the bottom of the sidebar. */
function SidebarProfile() {
  const { user, session, currentCompany } = useAuth()
  const role = session?.roles?.[0]

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-xl bg-subtle/70 p-2.5">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted">{[role, currentCompany?.short_name].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    </div>
  )
}

// function Breadcrumbs() {
//   const crumbs = useBreadcrumbs()
//   if (crumbs.length === 0) return null

//   return (
//     <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
//       {crumbs.map((crumb, index) => {
//         const last = index === crumbs.length - 1
//         return (
//           <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
//             {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted/60" />}
//             {crumb.to && !last ? (
//               <Link to={crumb.to} className="truncate text-muted hover:text-ink">{crumb.label}</Link>
//             ) : (
//               <span className={cn('truncate', last ? 'font-medium text-ink' : 'text-muted')}>{crumb.label}</span>
//             )}
//           </span>
//         )
//       })}
//     </nav>
//   )
// }

/** Desktop top bar: links, and one dropdown per group (sub-groups shown as columns). */
function TopMenu() {
  const items = useMenu()
  const { pathname } = useLocation()
  const linkClass = (active) => cn(
    'relative flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-subtle',
    active ? 'text-primary-ink after:absolute after:inset-x-3 after:-bottom-[14px] after:h-0.5 after:rounded-full after:bg-primary' : 'text-muted hover:text-ink',
  )

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((item) => (item.children
        ? <TopMenuGroup key={item.label} group={item} className={linkClass(isActive(item, pathname))} />
        : <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive: current }) => linkClass(current)}>{item.label}</NavLink>
      ))}
    </nav>
  )
}

function TopMenuGroup({ group, className }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)

  const sections = group.children.some((child) => child.children)
    ? group.children.map((child) => (child.children ? child : { label: '', children: [child] }))
    : [{ label: '', children: group.children }]

  const link = ({ to, label, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      onClick={close}
      className={({ isActive: current }) => cn('flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm', current ? 'bg-primary-soft font-medium text-primary-ink' : 'text-ink hover:bg-subtle')}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted"><Icon className="size-4" /></span>
      {label}
    </NavLink>
  )

  // A sub-group inside a section (e.g. Masters → Items): a normal row with ›, opening a flyout
  // with its links on hover (or click, for touch screens).
  const entry = (child) => (child.children
    ? <MenuFlyout key={child.label} group={child} link={link} active={isActive(child, pathname)} />
    : link(child))

  return (
    <div className="relative" ref={ref}>
      <button type="button" className={className} onClick={() => setOpen(!open)} aria-expanded={open}>
        {group.label}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <MenuPanel className={cn('left-0 grid gap-2 overflow-visible', COLUMNS[Math.min(sections.length, 3)])}>
          {sections.map((section) => (
            <div key={section.label || 'items'}>
              {section.label && <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{section.label}</p>}
              <div className="space-y-0.5">{section.children.map(entry)}</div>
            </div>
          ))}
        </MenuPanel>
      )}
    </div>
  )
}

/** Width and columns of a header dropdown, by its number of sections. */
const COLUMNS = { 1: 'w-64', 2: 'w-[32rem] grid-cols-2 p-3', 3: 'w-[46rem] grid-cols-3 p-3' }

/**
 * A menu row that opens its sub-links in a small panel to the right (e.g. Masters → Items →
 * Categories / Items). Opens on hover, and on click for touch screens; the transparent padding
 * between row and panel keeps it open while the pointer moves across.
 */
function MenuFlyout({ group, link, active }) {
  const [open, setOpen] = useState(false)
  const Icon = group.icon

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm',
          active ? 'bg-primary-soft font-medium text-primary-ink' : 'text-ink hover:bg-subtle',
          open && !active && 'bg-subtle',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted"><Icon className="size-4" /></span>
        <span className="flex-1">{group.label}</span>
        <ChevronRight className="size-4 text-muted" />
      </button>
      {open && (
        <div className="absolute top-0 left-full z-40 pl-2">
          <div role="menu" aria-label={group.label} className="w-52 space-y-0.5 rounded-xl border border-border bg-card p-1.5 shadow-xl shadow-black/10 animate-page">
            {group.children.map(link)}
          </div>
        </div>
      )}
    </div>
  )
}

/** Floating menu panel used by the header dropdowns. */
function MenuPanel({ className, children }) {
  return (
    <div className={cn('absolute z-30 mt-2 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl shadow-black/5 animate-page', className)}>
      {children}
    </div>
  )
}

function SearchButton({ onClick }) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted transition-colors hover:bg-subtle hover:text-ink sm:w-56 sm:border sm:border-border sm:bg-subtle/50"
    >
      <Search className="size-4" />
      <span className="hidden flex-1 text-left sm:block">Search…</span>
      <kbd className="hidden rounded border border-border bg-card px-1.5 text-[11px] font-medium sm:block">{mac ? '⌘' : 'Ctrl'} K</kbd>
    </button>
  )
}

/** One-click light / dark switch (the full choice incl. System is in the user menu). */
function ThemeToggle() {
  const { preferences, setPreference } = useAuth()
  const dark = isDarkTheme(preferences.theme)
  return (
    <button
      type="button"
      onClick={() => setPreference('theme', dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink"
    >
      {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </button>
  )
}

/** Shown only for people who work for more than one company. */
function CompanySwitcher() {
  const { companies, currentCompany, switchCompany } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)

  if (companies.length === 0) return null
  const badge = 'flex h-9 items-center gap-1.5 rounded-lg bg-primary-soft px-3 text-sm font-semibold text-primary-ink ring-1 ring-primary/15 ring-inset'
  if (companies.length === 1) return <span className={badge}>{currentCompany?.short_name}</span>

  const change = async (companyId) => {
    close()
    if (companyId === currentCompany?.id) return
    try {
      await switchCompany(companyId)
      navigate('/')
      toast.success('Company switched.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Switch company" className={cn(badge, 'hover:bg-primary/15')}>
        {currentCompany?.short_name}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <MenuPanel className="right-0 w-72">
          <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Switch company</p>
          {companies.map((company) => (
            <button key={company.id} type="button" onClick={() => change(company.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-subtle">
              <span className="flex h-7 w-12 items-center justify-center rounded-md bg-primary-soft text-xs font-bold text-primary-ink">{company.short_name}</span>
              <span className="flex-1 truncate">{company.name}</span>
              {company.id === currentCompany?.id && <Check className="size-4 text-primary-ink" />}
            </button>
          ))}
        </MenuPanel>
      )}
    </div>
  )
}

function Avatar({ user, size = 'size-9' }) {
  const initials = user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return user.photo_url
    ? <img src={user.photo_url} alt="" className={cn('shrink-0 rounded-full object-cover ring-2 ring-card', size)} />
    : <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-secondary text-xs font-semibold text-white ring-2 ring-card', size)}>{initials}</span>
}

const layoutOptions = [
  { value: 'side', label: 'Sidebar', icon: PanelLeft },
  { value: 'top', label: 'Top bar', icon: PanelTop },
]

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function UserMenu() {
  const { user, logout, preferences, setPreference } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-subtle sm:rounded-lg sm:pr-2" aria-expanded={open} aria-label="Account menu">
        <Avatar user={user} size="size-8" />
        <ChevronDown className="hidden size-4 text-muted sm:block" />
      </button>
      {open && (
        <MenuPanel className="right-0 w-72 p-0">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email ?? `@${user.username}`}</p>
            </div>
          </div>

          <div className="space-y-3 border-b border-border px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Appearance</p>
            <div className="hidden space-y-1.5 lg:block">
              <p className="text-xs text-muted">Menu layout</p>
              <SegmentedControl label="Menu layout" value={preferences.nav_style} onChange={(value) => setPreference('nav_style', value)} options={layoutOptions} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Theme</p>
              <SegmentedControl label="Theme" value={preferences.theme} onChange={(value) => setPreference('theme', value)} options={themeOptions} />
            </div>
          </div>

          <div className="p-1.5">
            <button type="button" onClick={() => { close(); navigate('/change-password') }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-subtle">
              <KeyRound className="size-4 text-muted" /> Change password
            </button>
            <button type="button" onClick={() => logout().then(() => navigate('/login'))} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-500/10">
              <LogOut className="size-4" /> Log out
            </button>
          </div>
        </MenuPanel>
      )}
    </div>
  )
}
