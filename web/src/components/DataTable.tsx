import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { count } from '../format'

export interface Column<T> {
  key: string
  header: string
  /** What to show in the cell. */
  cell: (row: T) => ReactNode
  /** What to sort by; leave out for a column that cannot be sorted. */
  sort?: (row: T) => number | string
  align?: 'right'
  /** Keep this column from wrapping. */
  nowrap?: boolean
}

/** How many rows a page can hold; the reader picks one under the table. */
const PAGE_SIZES = [10, 25, 50, 100]

/** A table that sorts, searches and pages in the browser, and scrolls sideways inside its own frame on narrow screens. */
export function DataTable<T>({ columns, rows, rowKey, initialSort, search, searchLabel, pageSize: firstPageSize = 10, caption }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T, i: number) => string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  /** Text of a row that the search box looks through. */
  search?: (row: T) => string; searchLabel?: string
  /** Rows per page to start with; the reader can change it. */
  pageSize?: number; caption: string
}) {
  const [sortBy, setSortBy] = useState(initialSort ?? null)
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(firstPageSize)
  const sizes = PAGE_SIZES.includes(firstPageSize) ? PAGE_SIZES : [...PAGE_SIZES, firstPageSize].sort((a, b) => a - b)

  const sorted = useMemo(() => {
    const t = term.trim().toLowerCase()
    const out = t && search ? rows.filter((r) => search(r).toLowerCase().includes(t)) : [...rows]
    const col = sortBy && columns.find((c) => c.key === sortBy.key)
    if (col?.sort) {
      const f = col.sort, dir = sortBy!.dir === 'asc' ? 1 : -1
      out.sort((a, b) => {
        const x = f(a), y = f(b)
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir
      })
    }
    return out
  }, [rows, columns, sortBy, term, search])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize)

  function toggle(c: Column<T>) {
    setPage(0)
    setSortBy((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.align === 'right' ? 'desc' : 'asc' }))
  }

  return (
    <div>
      {search && (
        <label className="relative mb-3 block max-w-sm">
          <span className="sr-only">{searchLabel ?? 'Search the table'}</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input type="search" value={term} onChange={(e) => { setTerm(e.target.value); setPage(0) }} placeholder={searchLabel ?? 'Search the table'}
            className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent" />
        </label>
      )}
      <div className="-mx-4 overflow-x-auto sm:-mx-5" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-y border-line bg-bg/60">
              {columns.map((c) => {
                const active = sortBy?.key === c.key
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sortBy!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`px-3 py-0 text-[13px] font-medium text-ink-2 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {c.sort ? (
                      <button type="button" onClick={() => toggle(c)}
                        className={`inline-flex h-9 items-center gap-1 whitespace-nowrap hover:text-ink ${c.align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-ink' : ''}`}>
                        {c.header}
                        {active
                          ? (sortBy!.dir === 'asc' ? <ArrowUp aria-hidden className="size-3.5" /> : <ArrowDown aria-hidden className="size-3.5" />)
                          : <span aria-hidden className="size-3.5" />}
                      </button>
                    ) : <span className="inline-flex h-9 items-center whitespace-nowrap">{c.header}</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={rowKey(r, current * pageSize + i)} className="border-b border-line/70 hover:bg-bg/50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 align-top text-ink first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5 ${c.align === 'right' ? 'text-right whitespace-nowrap' : ''} ${c.nowrap ? 'whitespace-nowrap' : ''}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-ink-2">Nothing matches “{term}”. Check the spelling or search for something shorter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px] text-ink-2">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span aria-live="polite">
            {sorted.length === 0 ? 'No rows' : `Rows ${count(current * pageSize + 1)} to ${count(Math.min(sorted.length, (current + 1) * pageSize))} of ${count(sorted.length)}`}
          </span>
          {rows.length > sizes[0] && (
            <label className="flex items-center gap-2">
              Rows per page
              <span className="select-wrap block">
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
                  className="h-9 rounded-md border border-line bg-surface pr-8 pl-2.5 text-[13px] text-ink hover:border-ink-3 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent">
                  {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </span>
            </label>
          )}
        </span>
        {pages > 1 && (
          <span className="flex items-center gap-1">
            <PageButton label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden className="size-4" /></PageButton>
            <span className="px-1.5">Page {current + 1} of {count(pages)}</span>
            <PageButton label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight aria-hidden className="size-4" /></PageButton>
          </span>
        )}
      </div>
    </div>
  )
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:border-ink-3 disabled:opacity-40">
      {children}
    </button>
  )
}
