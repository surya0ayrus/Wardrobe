import { Columns3 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/inputs'
import { useClickOutside } from '@/hooks/useClickOutside'

/**
 * "Columns" button: tick which columns of a list to show. Columns with `locked` always show.
 *   const [visible, setVisible] = useVisibleColumns('users', columns)
 *   <ColumnPicker columns={columns} visible={visible} onChange={setVisible} />
 */
export function ColumnPicker({ columns, visible, onChange }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(box, close, open)
  const toggle = (key) => onChange(visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key])

  return (
    <div ref={box} className="relative">
      <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full sm:w-auto">
        <Columns3 className="size-4" /> Columns
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-60 rounded-xl border border-border bg-card p-2 shadow-xl">
          <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wider text-muted uppercase">Show columns</p>
          <ul className="max-h-72 overflow-y-auto">
            {columns.map((c) => (
              <li key={c.key}>
                <label className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${c.locked ? 'text-muted' : 'cursor-pointer hover:bg-subtle'}`}>
                  <Checkbox checked={c.locked || visible.includes(c.key)} disabled={c.locked} onChange={() => toggle(c.key)} />
                  {c.header}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onChange(columns.map((c) => c.key))} className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-primary-ink hover:bg-subtle">
            Show all
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * The columns a person chose for a list, remembered in this browser (localStorage, per list).
 * Falls back to every column when nothing is stored or storage is unavailable.
 */
export function useVisibleColumns(list, columns) {
  const key = `columns:${list}`
  const all = columns.map((c) => c.key)
  const [visible, setVisible] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key))
      return Array.isArray(saved) ? saved.filter((k) => all.includes(k)) : all
    } catch {
      return all
    }
  })
  const save = (next) => {
    setVisible(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* private window: keep it for this visit only */ }
  }
  return [visible, save]
}
