import { useEffect, useState } from 'react'
import { getJson } from './api'

export interface Loaded<T> { data: T | null; loading: boolean; error: string | null }

/**
 * Loads a URL and reloads when it (or the Refresh counter) changes. A request that is no longer wanted is aborted,
 * so a slow answer for old filters can never overwrite a newer one. The previous data stays in place while reloading.
 * A null url means "not ready yet" (a parent filter is still loading).
 */
export function useData<T>(url: string | null, reload: number): Loaded<T> {
  const [done, setDone] = useState<{ data: T | null; error: string | null; url: string | null; reload: number }>({ data: null, error: null, url: null, reload: -1 })
  useEffect(() => {
    if (!url) return
    const ac = new AbortController()
    getJson<T>(url, ac.signal)
      .then((data) => { if (!ac.signal.aborted) setDone({ data, error: null, url, reload }) })
      .catch((e: Error) => { if (!ac.signal.aborted) setDone({ data: null, error: e.message, url, reload }) })
    return () => ac.abort()
  }, [url, reload])
  const loading = !url || done.url !== url || done.reload !== reload
  return { data: url ? done.data : null, loading, error: loading ? null : done.error }
}

/** Sum numeric fields of rows that share a key. Groups come back in first-seen order. */
export function rollup<T, F extends keyof T>(rows: T[], key: (r: T) => string, fields: F[]): Array<{ key: string; first: T } & Record<F, number>> {
  type Group = { key: string; first: T } & Record<F, number>
  const map = new Map<string, Group>()
  for (const r of rows) {
    const k = key(r)
    let g = map.get(k)
    if (!g) {
      g = { key: k, first: r } as Group
      for (const f of fields) (g as Record<F, number>)[f] = 0
      map.set(k, g)
    }
    for (const f of fields) (g as Record<F, number>)[f] += Number(r[f]) || 0
  }
  return [...map.values()]
}

export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + (f(r) || 0), 0)
