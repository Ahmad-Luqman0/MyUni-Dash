import type { ReactNode } from 'react'
import type { Loaded } from '../useData'
import { nice } from '../format'
import { Card, ChartSkeleton, Loadable, RowsSkeleton, Skeleton } from '../components/ui'
import { degreeName } from './helpers'

/** Degree name over its code, for table cells. */
export function DegreeCell({ row }: { row: { degreeCode: string | null; degree: string | null; department?: string | null } }) {
  return (
    <span className="block min-w-40">
      <span className="block text-ink">{degreeName(row)}</span>
      {row.department && <span className="block text-xs text-ink-3">{nice(row.department)}</span>}
    </span>
  )
}

/** A card whose body loads on its own (used on the overview, where each card reads a different portion). */
export function Block<T>({ title, subtitle, state, noun, className, children }: {
  title: string; subtitle?: ReactNode; state: Loaded<T[]>; noun: string; className?: string; children: (rows: T[]) => ReactNode
}) {
  return (
    <Card title={title} subtitle={subtitle} className={className}>
      <Loadable state={state} noun={noun} compact skeleton={<ChartSkeleton height={220} />}>{children}</Loadable>
    </Card>
  )
}

export function LedgerSkeleton({ tiles, cols }: { tiles: number; cols: 3 | 4 }) {
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line ${cols === 4 ? 'lg:grid-cols-4' : 'md:grid-cols-3'}`}>
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} className="bg-surface px-4 py-4 sm:px-5"><Skeleton className="h-3.5 w-24" /><Skeleton className="mt-2.5 h-7 w-28" /><Skeleton className="mt-2.5 h-3 w-20" /></div>
      ))}
    </div>
  )
}

/** What a whole section looks like while its first answer is on the way. */
export function SectionSkeleton({ tiles = 4, cols = 4 }: { tiles?: number; cols?: 3 | 4 }) {
  return (
    <div className="space-y-4">
      <LedgerSkeleton tiles={tiles} cols={cols} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><Skeleton className="mb-5 h-5 w-48" /><ChartSkeleton height={220} /></Card>
        <Card><Skeleton className="mb-5 h-5 w-40" /><RowsSkeleton rows={7} /></Card>
      </div>
      <Card><Skeleton className="mb-5 h-5 w-32" /><RowsSkeleton rows={6} /></Card>
    </div>
  )
}

/** Shown in place of a comparison chart when only one semester is in view. */
export function Quiet({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-bg px-3 py-6 text-center text-sm text-ink-2">{children}</p>
}
