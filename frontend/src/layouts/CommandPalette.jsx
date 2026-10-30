import { useQuery } from '@tanstack/react-query'
import { CornerDownLeft, Search, User } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { menuLeaves } from '@/layouts/navigation'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Quick jump (Ctrl+K / ⌘K): search pages and users, move with ↑ ↓, open with Enter.
 */
export function CommandPalette({ open, onClose }) {
  const dialog = useRef(null)
  const navigate = useNavigate()
  const { can } = useAuth()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const term = useDebounce(query.trim(), 250)

  useEffect(() => {
    const el = dialog.current
    if (open && !el.open) { el.showModal(); setQuery(''); setActive(0) }
    if (!open && el.open) el.close()
  }, [open])

  const pages = useMemo(() => menuLeaves()
    .filter((item) => !item.permission || can(item.permission))
    .filter((item) => [item.label, ...item.trail].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .map((item) => ({ key: item.to, label: item.label, hint: item.trail.join(' › ') || 'Page', icon: item.icon, to: item.to })), [can, query])

  const { data: users = [] } = useQuery({
    queryKey: ['lookups', 'users', term],
    queryFn: () => api.get('/lookups/users', { params: { search: term } }).then((res) => res.data),
    enabled: open && term.length >= 2 && can('view_user'),
  })

  const results = [
    ...pages,
    ...(term.length >= 2 ? users.map((person) => ({ key: `user-${person.id}`, label: person.name, hint: `@${person.username}`, icon: User, to: `/users/${person.id}` })) : []),
  ]
  const current = Math.min(active, Math.max(results.length - 1, 0))

  const go = (result) => {
    onClose()
    navigate(result.to)
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((current + 1) % Math.max(results.length, 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((current - 1 + results.length) % Math.max(results.length, 1)) }
    if (event.key === 'Enter' && results[current]) { event.preventDefault(); go(results[current]) }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="mx-auto mt-[12vh] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-2xl border border-border bg-card p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-page"
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-5 shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              placeholder="Search pages and users…"
              className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted/70"
              aria-label="Search"
            />
            <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted sm:block">Esc</kbd>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
            {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results for “{query}”</li>}
            {results.map((result, index) => {
              const Icon = result.icon
              return (
                <li key={result.key} role="option" aria-selected={index === current}>
                  <button
                    type="button"
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(result)}
                    className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm', index === current && 'bg-primary-soft text-primary-ink')}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate font-medium">{result.label}</span>
                    <span className="text-xs text-muted">{result.hint}</span>
                    {index === current && <CornerDownLeft className="size-3.5 text-muted" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </dialog>
  )
}
