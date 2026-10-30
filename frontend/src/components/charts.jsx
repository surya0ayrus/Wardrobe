import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

/*
 * Small dashboard charts in plain HTML (no chart library). Colours come from the
 * --color-chart-* tokens in index.css (validated for the light and dark card).
 * Every mark has a hover tooltip, and every chart a screen-reader table (inside a
 * hidden div: Firefox draws a table's <caption> outside a hidden table).
 */

/** A tooltip that follows the pointer: const tip = useTooltip(); <div {...tip.on('text')} /> … {tip.node} */
function useTooltip() {
  const [tip, setTip] = useState(null)
  const move = (content) => (event) => setTip({ content, x: event.clientX, y: event.clientY })

  return {
    on: (content) => ({ onPointerEnter: move(content), onPointerMove: move(content), onPointerLeave: () => setTip(null) }),
    node: tip && (
      <div
        role="tooltip"
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
        style={{ left: tip.x, top: tip.y }}
      >
        {tip.content}
      </div>
    ),
  }
}

const monthName = (ym, style = 'short') => new Date(`${ym}-01T00:00:00`).toLocaleString('en-IN', { month: style, ...(style === 'long' ? { year: 'numeric' } : {}) })

/**
 * Grouped columns, one group per month (e.g. records created and closed), with a legend.
 * rows: [{ month: 'YYYY-MM', created: 3, closed: 1 }]; series: [{ key, label, color: SERIES[0] }]
 * linkFor(row): where clicking a month goes (optional), with linkState as the link's state.
 */
export function MonthlyColumnsChart({ rows, series, caption, linkFor, linkState }) {
  const tip = useTooltip()
  const navigate = useNavigate()
  const max = Math.max(1, ...rows.flatMap((row) => series.map((s) => row[s.key])))
  const top = Math.max(2, Math.ceil(max / 2) * 2) // even, so the middle gridline is a whole number

  return (
    <figure>
      <ul className="mb-3 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs" aria-hidden>
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-[3px]', s.color.fill)} />{s.label}
          </li>
        ))}
      </ul>
      <div className="flex gap-3">
        <div className="flex h-52 flex-col justify-between text-right text-[11px] text-muted tabular-nums" aria-hidden>
          <span className="-translate-y-1/2">{top}</span>
          <span className="-translate-y-1/2">{top / 2}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-52" aria-hidden>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            <div className="absolute inset-x-0 bottom-0 border-t border-border" />
          </div>
          <div className="relative flex h-52 items-end gap-1">
            {rows.map((row) => (
              <div
                key={row.month}
                className={cn('group flex h-full flex-1 items-end justify-center gap-0.5', linkFor && 'cursor-pointer')}
                onClick={linkFor ? () => navigate(linkFor(row), { state: linkState }) : undefined}
                {...tip.on(`${monthName(row.month, 'long')} · ${series.map((s) => `${row[s.key]} ${s.label.toLowerCase()}`).join(' · ')}`)}
              >
                {series.map((s) => (
                  <div
                    key={s.key}
                    className={cn('w-full max-w-3 rounded-t-[3px] transition-[height,opacity] duration-500 group-hover:opacity-80', s.color.fill, row[s.key] === 0 && 'h-0')}
                    style={row[s.key] ? { height: `${(row[s.key] / top) * 100}%` } : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1 text-center text-[11px] text-muted" aria-hidden>
            {rows.map((row) => <span key={row.month} className="flex-1 truncate">{monthName(row.month)}</span>)}
          </div>
        </div>
      </div>
      {tip.node}
      <div className="sr-only">
        <table>
        <caption>{caption}</caption>
        <thead><tr><th>Month</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.month}><td>{linkFor ? <Link to={linkFor(row)} state={linkState}>{monthName(row.month, 'long')}</Link> : monthName(row.month, 'long')}</td>{series.map((s) => <td key={s.key}>{row[s.key]}</td>)}</tr>)}</tbody>
      </table>
      </div>
    </figure>
  )
}

/** Categorical colours in their checked order (written out in full so Tailwind generates them). */
export const SERIES = [
  { fill: 'bg-chart-1', stroke: 'stroke-chart-1' },
  { fill: 'bg-chart-2', stroke: 'stroke-chart-2' },
  { fill: 'bg-chart-3', stroke: 'stroke-chart-3' },
  { fill: 'bg-chart-4', stroke: 'stroke-chart-4' },
  { fill: 'bg-chart-5', stroke: 'stroke-chart-5' },
  { fill: 'bg-chart-6', stroke: 'stroke-chart-6' },
  { fill: 'bg-chart-7', stroke: 'stroke-chart-7' },
]
export const NEUTRAL = { fill: 'bg-chart-neutral', stroke: 'stroke-chart-neutral' }

/**
 * Donut (pie with the total in the middle). Each slice has a hover tooltip and a
 * legend line with its count and share, so no slice depends on colour alone.
 * slices: [{ label, value, color: SERIES[0], to? }] — a slice with `to` (and its legend line) is a
 * link, with linkState as its state.
 */
export function DonutChart({ slices, centerLabel, caption, linkState }) {
  const tip = useTooltip()
  const navigate = useNavigate()
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const pct = (value) => (total ? Math.round((value / total) * 100) : 0)
  const shown = slices.filter((s) => s.value > 0)
  const r = 38
  const C = 2 * Math.PI * r
  const gap = shown.length > 1 ? 1.2 : 0 // a thin card-coloured gap between slices
  let offset = 0

  return (
    <figure className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative size-44 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="14" className="stroke-subtle" />
          {shown.map((s) => {
            const length = (s.value / total) * C
            const dash = Math.max(0.5, length - gap)
            const el = (
              <circle
                key={s.label} cx="50" cy="50" r={r} fill="none" strokeWidth="14"
                strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
                className={cn(s.color.stroke, 'transition-opacity hover:opacity-80', s.to ? 'cursor-pointer' : 'cursor-default')}
                onClick={s.to ? () => navigate(s.to, { state: linkState }) : undefined}
                {...tip.on(`${s.label} · ${s.value} (${pct(s.value)}%)`)}
              />
            )
            offset += length
            return el
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-xs text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2 text-sm">
        {slices.map((s) => {
          const line = (
            <>
              <span className={cn('size-2.5 shrink-0 rounded-[3px]', s.color.fill)} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="font-medium tabular-nums">{s.value}</span>
              <span className="w-10 text-right text-xs text-muted tabular-nums">{pct(s.value)}%</span>
            </>
          )
          return (
            <li key={s.label} {...tip.on(`${s.label} · ${s.value} (${pct(s.value)}%)`)}>
              {s.to
                ? <Link to={s.to} state={linkState} className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-0.5 hover:bg-subtle">{line}</Link>
                : <span className="flex items-center gap-2 py-0.5">{line}</span>}
            </li>
          )
        })}
      </ul>
      {tip.node}
      <div className="sr-only">
        <table>
        <caption>{caption}</caption>
        <tbody>{slices.map((s) => <tr key={s.label}><th>{s.label}</th><td>{s.value}</td><td>{pct(s.value)}%</td></tr>)}</tbody>
      </table>
      </div>
    </figure>
  )
}
