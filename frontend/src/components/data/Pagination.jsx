import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const PER_PAGE_OPTIONS = [10, 25, 50, 100]

/**
 * Works with paginated response ({ meta, links }).
 * Shows "1–15 of 230", page numbers (from tablet width) and Previous / Next when the total is
 * known (normal pagination), and only Previous / Next for "simple" pagination (activity logs).
 * With onPerPage, also a "Rows per page" choice.
 */
export function Pagination({ data, onPage, onPerPage }) {
  const meta = data?.meta
  if (!meta) return null

  const page = meta.current_page
  const hasPrev = page > 1
  const hasNext = meta.last_page ? page < meta.last_page : !!data.links?.next
  if (!hasPrev && !hasNext && !meta.total) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-sm">
      <div className="flex items-center gap-4 text-muted">
        <span>{meta.total !== undefined ? (meta.total ? `${meta.from}–${meta.to} of ${meta.total}` : '') : `Page ${page}`}</span>
        {onPerPage && meta.per_page && (
          <label className="hidden items-center gap-2 sm:flex">
            Rows per page
            <select
              value={meta.per_page}
              onChange={(e) => onPerPage(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-card px-2 text-ink focus-visible:outline-2 focus-visible:outline-primary"
            >
              {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled={!hasPrev} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
        </Button>
        {meta.last_page > 1 && (
          <div className="hidden items-center gap-1 sm:flex">
            {pageNumbers(page, meta.last_page).map((n, i) => (n === null
              ? <span key={`gap-${i}`} className="px-1 text-muted">…</span>
              : (
                <button
                  key={n}
                  type="button"
                  onClick={() => onPage(n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={cn(
                    'h-8 min-w-8 rounded-md px-2 tabular-nums transition-colors',
                    n === page ? 'bg-primary font-medium text-white' : 'text-muted hover:bg-subtle hover:text-ink',
                  )}
                >
                  {n}
                </button>
              )))}
          </div>
        )}
        <Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => onPage(page + 1)} aria-label="Next page">
          <span className="hidden sm:inline">Next</span> <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

/** 1 … 4 5 [6] 7 8 … 20: first, last, and two either side of the current page (null = gap). */
function pageNumbers(current, last) {
  const pages = new Set([1, last])
  for (let n = current - 2; n <= current + 2; n++) if (n > 1 && n < last) pages.add(n)
  const sorted = [...pages].sort((a, b) => a - b)
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? [null, n] : [n]))
}
