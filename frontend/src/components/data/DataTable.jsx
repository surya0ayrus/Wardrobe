import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Minus, Plus } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'

export function DataTable({ columns, rows = [], isLoading, actions, actionsHeader = '', onRowClick, sort, onSort, emptyTitle, emptyMessage }) {
  const width = useViewportWidth()
  const [expanded, setExpanded] = useState({})
  const [box, setBox] = useState(null) // the scroll box (a callback ref: it appears once rows load)
  const boxWidth = useElementWidth(box)
  // Columns hidden on top of the screen-size rule because they do not fit the table's space.
  const [squeezed, setSqueezed] = useState(0)

  const columnDefs = useMemo(() => [
    ...columns.map((column) => ({
      id: column.key,
      accessorFn: (row) => row[column.key], 
      header: column.header,
      enableSorting: !!column.sortable,
      cell: ({ row }) => (column.render ? column.render(row.original, row.index) : row.original[column.key] ?? '—'),
      meta: { className: column.className, priority: column.priority ?? (column.hideOnMobile ? 3 : 1) },
    })),
    ...(actions ? [{ id: ACTIONS, header: actionsHeader, enableSorting: false, cell: ({ row }) => actions(row.original), meta: { priority: 1, className: 'text-right' } }] : []),
  ], [columns, actions, actionsHeader])


  // By screen size first (each priority from its width), then — while the table is still wider
  // than its space — the least important visible columns: highest priority number, rightmost first.
  // Priority 1 (and the actions) always stay. Hidden columns go into the row's +/− details.
  const columnVisibility = useMemo(() => {
    const visible = Object.fromEntries(columnDefs.map((def) => [def.id, width >= MIN_WIDTH[def.meta.priority]]))
    columnDefs
      .map((def, index) => ({ def, index }))
      .filter(({ def }) => visible[def.id] && def.id !== ACTIONS && def.meta.priority > 1)
      .sort((a, b) => b.def.meta.priority - a.def.meta.priority || b.index - a.index)
      .slice(0, squeezed)
      .forEach(({ def }) => { visible[def.id] = false })
    return visible
  }, [columnDefs, width, squeezed])
  const canSqueeze = columnDefs.some((def) => columnVisibility[def.id] && def.id !== ACTIONS && def.meta.priority > 1)

  // Fit again from scratch when the space or the content really changes (by value: the page
  // rebuilds its column list on every render), then hide one more column per pass until the
  // table fits — all before the screen is painted.
  const fitKey = [boxWidth, width, columnDefs.map((def) => `${def.id}:${def.meta.priority}`).join(','), rows.map((row) => row.id).join(',')].join('|')
  const fittedFor = useRef(null)
  useLayoutEffect(() => {
    if (fittedFor.current !== fitKey) {
      fittedFor.current = fitKey
      if (squeezed) return setSqueezed(0)
    }
    if (box && box.scrollWidth > box.clientWidth + 1 && canSqueeze) setSqueezed(squeezed + 1)
  }, [box, fitKey, squeezed, canSqueeze])

  const sorting = useMemo(() => (sort ? [{ id: sort.replace(/^-/, ''), desc: sort.startsWith('-') }] : []), [sort])

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    state: { sorting, columnVisibility, expanded },
    onExpandedChange: setExpanded,
    getRowCanExpand: () => Object.values(columnVisibility).some((visible) => !visible),
    // Sorting and paging are done by the server: TanStack only reports the click.
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
    sortDescFirst: false, // first click on a header sorts A → Z
    onSortingChange: (updater) => {
      const [next] = typeof updater === 'function' ? updater(sorting) : updater
      if (next && onSort) onSort(`${next.desc ? '-' : ''}${next.id}`)
    },
  })

  if (isLoading && rows.length === 0) {
    return <SkeletonRows columns={columns.length} />
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle ?? 'No records found'} message={emptyMessage} />
  }

  const pad = 'px-3 sm:px-5'
  const visibleCount = table.getVisibleLeafColumns().length

  return (
    <div ref={setBox} className={cn('overflow-x-auto transition-opacity', isLoading && 'opacity-60')}>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b border-border bg-subtle/50 text-left text-[11px] tracking-wider text-muted uppercase">
              {group.headers.map((header) => (
                <th key={header.id} className={cn(pad, 'py-2.5 font-semibold', header.column.columnDef.meta?.className)}>
                  {header.column.getCanSort() && onSort
                    ? <SortButton column={header.column} label={flexRender(header.column.columnDef.header, header.getContext())} />
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const isOpen = row.getCanExpand() && row.getIsExpanded()
            const cells = row.getVisibleCells()
            return (
              <Fragment key={row.id}>
                <tr
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn('border-b border-border transition-colors hover:bg-subtle/60', isOpen && 'border-b-0 bg-subtle/40', onRowClick && 'cursor-pointer')}
                >
                  {cells.map((cell, i) => {
                    const isActions = cell.column.id === ACTIONS
                    const content = flexRender(cell.column.columnDef.cell, cell.getContext())
                    return (
                      <td
                        key={cell.id}
                        className={cn(pad, isActions ? 'py-2 text-right whitespace-nowrap' : 'py-3 align-middle', cell.column.columnDef.meta?.className)}
                        onClick={isActions ? (e) => e.stopPropagation() : undefined}
                      >
                        {isActions ? <div className="inline-flex gap-1">{content}</div>
                          : i === 0 && row.getCanExpand() ? (
                            // The first visible cell carries the +/− button when some columns are hidden.
                            <span className="flex items-center gap-2">
                              <ExpandButton expanded={isOpen} onClick={row.getToggleExpandedHandler()} />
                              <span className="min-w-0">{content}</span>
                            </span>
                          ) : content}
                      </td>
                    )
                  })}
                </tr>
                {isOpen && (
                  <tr className="border-b border-border bg-subtle/40">
                    <td colSpan={visibleCount} className={cn(pad, 'pt-0 pb-3')}>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 pl-8 text-sm">
                        {row.getAllCells().filter((cell) => !cell.column.getIsVisible()).map((cell) => (
                          <div key={cell.id} className="contents">
                            <dt className="text-xs font-semibold tracking-wider text-muted uppercase">{cell.column.columnDef.header}</dt>
                            <dd className="min-w-0">{flexRender(cell.column.columnDef.cell, cell.getContext())}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const ACTIONS = '__actions'

/** Screen width from which each priority's columns are shown (Tailwind's sm / md / lg / xl). */
const MIN_WIDTH = { 1: 0, 2: 640, 3: 768, 4: 1024, 5: 1280 }

/** An element's width, updated when it changes (e.g. the sidebar opens or closes). */
function useElementWidth(el) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])
  return width
}

/** Current window width, updated on resize. */
function useViewportWidth() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1440 : window.innerWidth))
  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return width
}

function ExpandButton({ expanded, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      aria-expanded={expanded}
      title={expanded ? 'Hide details' : 'Show details'}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full text-white transition-colors',
        expanded ? 'bg-danger' : 'bg-primary',
      )}
    >
      {expanded ? <Minus className="size-3" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={3} />}
    </button>
  )
}

/** Grey placeholder rows while the first page loads. */
function SkeletonRows({ columns }) {
  return (
    <div className="divide-y divide-border" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-5 py-4">
          <span className="skeleton size-8 shrink-0 rounded-full" />
          {Array.from({ length: Math.min(columns, 4) }, (_, col) => (
            <span key={col} className="skeleton h-3.5 flex-1" style={{ maxWidth: `${[180, 120, 100, 80][col]}px` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Header button: click to sort ascending, again for descending (TanStack toggles, the server sorts). */
function SortButton({ column, label }) {
  const direction = column.getIsSorted()

  return (
    <button type="button" onClick={column.getToggleSortingHandler()} className="inline-flex items-center gap-1 uppercase hover:text-ink">
      {label}
      {direction === 'desc' ? <ArrowDown className="size-3.5" /> : direction === 'asc' ? <ArrowUp className="size-3.5" /> : null}
    </button>
  )
}
