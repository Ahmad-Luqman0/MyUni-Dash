import { useEffect, useRef } from 'react'
import type { Semester } from '../api'
import type { Loaded } from '../useData'
import { count, dateLabel, dayLabel, isoDate } from '../format'
import { Skeleton } from './ui'

const TODAY = isoDate(new Date())
const BAR_MAX = 52 // px, the tallest bar

/**
 * The semesters as a timeline, in date order. Each one carries a bar whose height is its registered students.
 * Choosing a semester filters the whole dashboard; "All semesters" clears it.
 */
export function SemesterStrip({ state, selected, onSelect, onRetry }: {
  state: Loaded<Semester[]>; selected: string | null; onSelect: (id: string | null) => void; onRetry: () => void
}) {
  // On a narrow screen the strip scrolls sideways; keep the chosen semester in sight.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = scroller.current, el = box?.querySelector<HTMLElement>('[data-on="true"]')
    if (box && el && (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth)) {
      box.scrollTo({ left: Math.max(0, el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2) })
    }
  }, [selected])

  if (state.error) {
    return (
      <section aria-label="Semesters" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-4 text-sm sm:px-5">
        <p className="text-ink-2"><span className="font-medium text-ink">Could not load the semesters.</span> {state.error}</p>
        <button type="button" onClick={onRetry} className="font-medium text-accent underline underline-offset-2">Retry</button>
      </section>
    )
  }
  if (!state.data) {
    return (
      <section aria-label="Semesters" aria-busy="true" className="flex gap-6 rounded-lg border border-line bg-surface px-5 py-4">
        {[30, 44, 18, 52, 22, 48].map((h, i) => (
          <div key={i} className={`flex-1 ${i > 1 ? 'hidden sm:block' : ''}`}>
            <div className="flex h-14 items-end"><div className="skeleton w-7" style={{ height: h }} /></div>
            <Skeleton className="mt-3 h-4 w-20" /><Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </section>
    )
  }
  const semesters = [...state.data].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
  if (semesters.length === 0) {
    return (
      <section aria-label="Semesters" className="rounded-lg border border-line bg-surface px-5 py-4 text-sm text-ink-2">
        <span className="font-medium text-ink">No semesters are set up for this company and campus.</span> Figures below cover the whole record.
      </section>
    )
  }
  const top = Math.max(1, ...semesters.map((s) => s.students))
  return (
    <section aria-label="Semesters" className={`rounded-lg border border-line bg-surface transition-opacity ${state.loading ? 'opacity-55' : ''}`}>
      <div ref={scroller} className="no-scrollbar relative flex overflow-x-auto" role="group" aria-label="Choose a semester">
        <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)}
          className={`group flex w-[124px] shrink-0 flex-col justify-end rounded-l-lg border-r border-line px-4 pt-3 pb-3 text-left transition-colors sm:w-[148px] sm:px-5 ${selected === null ? 'bg-chalk-soft' : 'hover:bg-bg'}`}>
          <span className="font-display text-base leading-tight font-semibold text-ink">All semesters</span>
          <span className="mt-1 text-xs text-ink-2">{selected === null ? 'Showing the whole record' : 'Clear the semester'}</span>
          <span aria-hidden className={`mt-2.5 block h-[3px] w-8 rounded-full ${selected === null ? 'bg-chalk' : 'bg-transparent'}`} />
        </button>
        {semesters.map((s, i) => {
          const on = s.id === selected
          const inSession = s.startDate && s.endDate && s.startDate.slice(0, 10) <= TODAY && TODAY <= s.endDate.slice(0, 10)
          const h = Math.max(s.students > 0 ? 3 : 0, Math.round((s.students / top) * BAR_MAX))
          return (
            <button key={s.id} type="button" aria-pressed={on} data-on={on} onClick={() => onSelect(on ? null : s.id)}
              title={on ? 'Click again to show all semesters' : `Show only ${s.code}`}
              className={`group relative min-w-[136px] flex-1 px-3 pt-3 pb-3 text-left transition-colors last:rounded-r-lg sm:px-4 ${on ? 'bg-chalk-soft' : 'hover:bg-bg'}`}>
              <span className="flex h-14 items-end gap-2">
                <span aria-hidden className="rise block w-7 rounded-t-[4px] transition-colors"
                  style={{ height: h, animationDelay: `${i * 45}ms`, background: on ? 'var(--rail)' : selected === null ? 'var(--s1)' : 'var(--s1-soft)' }} />
                <span className="pb-0.5 text-[13px] leading-tight text-ink-2"><span className="font-semibold text-ink">{count(s.students)}</span><br />students</span>
              </span>
              {/* the timeline: one continuous rule with a tick at each semester's start */}
              <span aria-hidden className={`absolute inset-x-0 top-[68px] h-px ${on ? 'bg-transparent' : 'bg-line'}`} />
              <span aria-hidden className={`absolute top-[67px] h-[3px] rounded-full ${on ? 'inset-x-0 bg-chalk' : 'left-3 w-7 bg-transparent sm:left-4'}`} />
              <span className="mt-3 block font-display text-base leading-tight font-semibold text-ink">{s.code}</span>
              <span className="mt-0.5 block text-xs whitespace-nowrap text-ink-2">
                {s.startDate && s.endDate ? `${dayLabel(s.startDate)} to ${dateLabel(s.endDate)}` : 'Dates not set'}
              </span>
              <span className="mt-1 block h-4 text-xs text-ink-3">
                {s.isAdmissionOpen ? 'Admissions open' : inSession ? 'In session' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
