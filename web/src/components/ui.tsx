import { useContext, type ReactNode } from 'react'
import { RotateCw, SearchX, ServerCrash } from 'lucide-react'
import type { Loaded } from '../useData'
import { DashContext } from '../context'

export function Card({ title, subtitle, action, children, className = '' }: {
  title?: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            {title && <h3 className="text-[17px] leading-snug font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  )
}

const control = 'h-10 w-full min-w-0 rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors hover:border-ink-3 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent disabled:bg-bg disabled:text-ink-3'

export function Select({ value, onChange, disabled, children }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; children: ReactNode
}) {
  return (
    <span className="select-wrap block min-w-0">
      <select className={`${control} truncate pr-8`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </span>
  )
}

export function DateInput({ value, onChange, min, max }: { value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return <input type="date" className={control} value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />
}

export function Button({ children, onClick, disabled, quiet }: { children: ReactNode; onClick: () => void; disabled?: boolean; quiet?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors disabled:opacity-60 ${
        quiet ? 'border border-line bg-surface text-ink hover:border-ink-3' : 'bg-rail text-rail-ink hover:bg-rail-2'}`}>
      {children}
    </button>
  )
}

/** Two or three choices in a row, e.g. Monthly / Daily. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-md border border-line bg-bg p-0.5 text-[13px]">
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}
          className={`rounded-[5px] px-2.5 py-1 font-medium transition-colors ${v === value ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--border)]' : 'text-ink-2 hover:text-ink'}`}>
          {text}
        </button>
      ))}
    </div>
  )
}

export function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      {items.map((s) => <li key={s.label} className="flex items-center gap-1.5"><Swatch color={s.color} />{s.label}</li>)}
    </ul>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

/** Nothing matched. Says which filters are narrowing the view and offers to clear them. */
export function EmptyState({ noun, compact }: { noun: string; compact?: boolean }) {
  const { clearFilters, narrowed } = useContext(DashContext)
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'px-2 py-8' : 'rounded-lg border border-line bg-surface px-5 py-14'}`}>
      <SearchX aria-hidden className="size-6 text-ink-3" strokeWidth={1.6} />
      <p className={`mt-3 font-display font-semibold text-ink ${compact ? 'text-base' : 'text-xl'}`}>No {noun} match these filters</p>
      <p className="mt-1 max-w-md text-sm text-ink-2">
        {narrowed.length > 0
          ? <>The view is narrowed by {list(narrowed)}. Widen or clear {narrowed.length === 1 ? 'it' : 'them'} to see more.</>
          : <>Nothing is recorded for this company yet. Choose another company, or check back after the next posting.</>}
      </p>
      {narrowed.length > 0 && <div className="mt-4"><Button quiet onClick={clearFilters}>Clear filters</Button></div>}
    </div>
  )
}

function list(xs: string[]) {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

export function ErrorState({ noun, message, compact, onRetry }: { noun: string; message: string; compact?: boolean; onRetry?: () => void }) {
  const ctx = useContext(DashContext)
  return (
    <div role="alert" className={`flex flex-col items-center text-center ${compact ? 'px-2 py-8' : 'rounded-lg border border-line bg-surface px-5 py-14'}`}>
      <ServerCrash aria-hidden className="size-6 text-bad-ink" strokeWidth={1.6} />
      <p className={`mt-3 font-display font-semibold text-ink ${compact ? 'text-base' : 'text-xl'}`}>Could not load {noun}</p>
      <p className="mt-1 max-w-md text-sm text-ink-2">{message}</p>
      <div className="mt-4"><Button quiet onClick={onRetry ?? ctx.retry}><RotateCw aria-hidden className="size-4" />Retry</Button></div>
    </div>
  )
}

/**
 * The three states every block of data goes through. First load shows a skeleton; a reload keeps the previous
 * figures on screen, dimmed, so nothing jumps; an empty answer and a failed one each say what to do next.
 */
export function Loadable<T>({ state, noun, compact, skeleton, isEmpty, children }: {
  state: Loaded<T>; noun: string; compact?: boolean; skeleton: ReactNode
  isEmpty?: (data: T) => boolean; children: (data: T) => ReactNode
}) {
  if (state.error) return <ErrorState noun={noun} message={state.error} compact={compact} />
  if (state.data === null) return <div aria-busy="true" aria-label={`Loading ${noun}`}>{skeleton}</div>
  const empty = isEmpty ? isEmpty(state.data) : Array.isArray(state.data) && state.data.length === 0
  if (empty) return <EmptyState noun={noun} compact={compact} />
  return <div aria-busy={state.loading} className={`transition-opacity ${state.loading ? 'opacity-55' : ''}`}>{children(state.data)}</div>
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div style={{ height }} className="flex items-end gap-3 pt-2">
      {[52, 70, 44, 86, 62, 78, 50, 92].map((h, i) => <div key={i} className="skeleton flex-1" style={{ height: `${h}%` }} />)}
    </div>
  )
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-3 py-1">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
}
