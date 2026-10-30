import { format, isValid, parseISO } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { useClickOutside } from '@/hooks/useClickOutside'
import { DATE_TIME_FORMAT } from '@/lib/format'
import { cn } from '@/lib/utils'

const THIS_YEAR = new Date().getFullYear()

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const pad = (n) => String(n).padStart(2, '0')

/**
 * Date field with a calendar popup (react-day-picker).
 * Value in / out is "yyyy-MM-dd" (what the API uses); it is shown as dd/MM/yyyy.
 * With `withTime`, hour and minute selects sit under the calendar; the value is then
 * "yyyy-MM-ddTHH:mm" and it is shown as 23-10-2026, 05:10PM. `minDate` / `maxDate` grey out the
 * days before / after them.
 *
 *   <DatePicker value={date} onChange={setDate} fromYear={1950} />
 *   <DatePicker withTime minDate={new Date()} value={start} onChange={setStart} />
 */
export function DatePicker({ value, onChange, id, placeholder, invalid = false, fromYear = 1950, toYear, minDate, maxDate, withTime = false, disabled, className, ...props }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const wrapper = useRef(null)
  const trigger = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(wrapper, close, open)

  const date = value ? parseISO(value) : undefined
  const selected = date && isValid(date) ? date : undefined
  const lastYear = toYear ?? THIS_YEAR + 1
  const valueFormat = withTime ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd'

  // A new day keeps the chosen time; the first pick starts at the current time (to 5 minutes).
  const pickDay = (day) => {
    if (!day) return onChange(null)
    if (!withTime) {
      onChange(format(day, valueFormat))
      return close()
    }
    const time = selected ?? new Date()
    const next = new Date(day)
    next.setHours(time.getHours(), Math.floor(time.getMinutes() / 5) * 5, 0, 0)
    onChange(format(next, valueFormat))
  }
  const setTime = (hours, minutes) => {
    const next = new Date(selected)
    next.setHours(hours, minutes, 0, 0)
    onChange(format(next, valueFormat))
  }

  // Place the calendar under the field, or above it when there is no room below.
  useLayoutEffect(() => {
    if (!open) return undefined
    const place = () => {
      const rect = trigger.current.getBoundingClientRect()
      const height = withTime ? 430 : 360
      const above = rect.bottom + height > window.innerHeight && rect.top > height
      setPosition({
        top: above ? rect.top - height - 4 : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      })
    }
    place()
    const onScroll = (event) => !wrapper.current?.contains(event.target) && close()
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, close])

  return (
    <div ref={wrapper} className={cn('relative', className)}>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-lg border bg-card pr-9 pl-3 text-left text-base shadow-xs transition-colors sm:text-sm',
          'focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none',
          invalid ? 'border-danger' : 'border-border hover:border-muted/40',
          disabled && 'bg-subtle opacity-70',
        )}
        {...props}
      >
        <CalendarDays className="size-4 shrink-0 text-muted" />
        <span className={cn('truncate', selected ? 'text-ink' : 'text-muted/80')}>
          {selected ? format(selected, withTime ? DATE_TIME_FORMAT : 'dd/MM/yyyy') : placeholder ?? (withTime ? 'dd-mm-yyyy, --:--' : 'dd/mm/yyyy')}
        </span>
      </button>
      {selected && !disabled && (
        <button type="button" onClick={() => onChange(null)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted hover:text-danger" aria-label="Clear date">
          <X className="size-4" />
        </button>
      )}

      {open && position && (
        <div role="dialog" aria-label={withTime ? 'Choose date and time' : 'Choose date'} className="fixed z-50 rounded-2xl border border-border bg-card p-2 text-ink shadow-2xl shadow-black/10" style={position}>
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={pickDay}
            disabled={[minDate && { before: minDate }, maxDate && { after: maxDate }].filter(Boolean)}
            captionLayout="dropdown"
            startMonth={minDate && minDate.getFullYear() > fromYear ? new Date(minDate.getFullYear(), minDate.getMonth()) : new Date(fromYear, 0)}
            endMonth={maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth()) : new Date(lastYear, 11)}
            weekStartsOn={1}
            autoFocus
          />
          {withTime && (
            <div className="flex items-center gap-2 border-t border-border px-2 pt-2">
              <span className="text-sm text-muted">Time</span>
              <select
                aria-label="Hour" disabled={!selected} value={selected ? selected.getHours() : ''}
                onChange={(e) => setTime(Number(e.target.value), selected.getMinutes())}
                className="h-9 rounded-lg border border-border bg-card px-2 text-sm disabled:opacity-50"
              >
                {!selected && <option value="">--</option>}
                {HOURS.map((h) => <option key={h} value={h}>{pad(h % 12 || 12)} {h < 12 ? 'AM' : 'PM'}</option>)}
              </select>
              <span className="text-muted">:</span>
              <select
                aria-label="Minute" disabled={!selected} value={selected ? selected.getMinutes() - (selected.getMinutes() % 5) : ''}
                onChange={(e) => setTime(selected.getHours(), Number(e.target.value))}
                className="h-9 rounded-lg border border-border bg-card px-2 text-sm disabled:opacity-50"
              >
                {!selected && <option value="">--</option>}
                {MINUTES.map((m) => <option key={m} value={m}>{pad(m)}</option>)}
              </select>
              <button type="button" onClick={close} className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover">Done</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
