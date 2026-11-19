import type { ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BarShapeProps } from 'recharts'
import { pct } from '../format'
import { C } from '../palette'
import { Legend, Swatch } from './ui'

export interface Series { key: string; label: string; color: string }
export type Datum = { label: string; title?: string } & Record<string, number | string | undefined>

const AXIS_TICK = { fill: 'var(--ink-3)', fontSize: 12 }
const num = (v: unknown) => (typeof v === 'number' ? v : 0)

function TipCard({ title, rows, total }: { title: string; rows: { label: string; color: string; value: string }[]; total?: string }) {
  return (
    <div className="max-w-72 min-w-44 rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] shadow-[0_4px_14px_rgba(21,35,29,0.10)]">
      <div className="mb-1.5 font-medium text-ink">{title}</div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-ink-2">
            <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="flex-1">{r.label}</span>
            <span className="font-medium text-ink">{r.value}</span>
          </li>
        ))}
      </ul>
      {total && (
        <div className="mt-1.5 flex justify-between gap-4 border-t border-line pt-1.5 font-medium text-ink"><span>Total</span><span>{total}</span></div>
      )}
    </div>
  )
}

/** One series over time: a 2px line over a light wash, with a crosshair readout. */
export function TrendArea({ data, name, color = C.s1, format, axisFormat, height = 240 }: {
  data: Datum[]; name: string; color?: string; format: (n: number) => string; axisFormat: (n: number) => string; height?: number
}) {
  return (
    <div style={{ height }} role="img" aria-label={`${name} over time. The table below lists the same figures.`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={AXIS_TICK} minTickGap={28} tickMargin={6} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => axisFormat(v).replace(/ /g, '\u00a0')} width={66} />
          <Tooltip cursor={{ stroke: 'var(--ink-3)', strokeWidth: 1 }} isAnimationActive={false}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as Datum | undefined
              if (!active || !d) return null
              return <TipCard title={d.title ?? d.label} rows={[{ label: name, color, value: format(num(d.value)) }]} />
            }} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} isAnimationActive={false}
            dot={data.length <= 24 ? { r: 3, fill: color, stroke: 'var(--surface)', strokeWidth: 2 } : false}
            activeDot={{ r: 4.5, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Columns over time or over a short ordered scale: stacked (parts of a total) or side by side (two measures to compare). */
export function Columns({ data, series, stacked, format, axisFormat, height = 260, name }: {
  data: Datum[]; series: Series[]; stacked?: boolean; format: (n: number) => string; axisFormat: (n: number) => string; height?: number; name: string
}) {
  const topKey = (d: Datum) => {
    for (let i = series.length - 1; i >= 0; i--) if (num(d[series[i].key]) > 0) return series[i].key
    return undefined
  }
  const shape = (key: string) => (p: BarShapeProps) => {
    const closes = !stacked || topKey(p.payload as Datum) === key
    const h = num(p.height)
    // A 2px gap in the surface colour separates stacked segments.
    const gap = stacked && !closes && h > 4 ? 2 : 0
    return <Rectangle {...p} y={num(p.y) + gap} height={Math.max(0, h - gap)} radius={closes ? [4, 4, 0, 0] : 0} />
  }
  return (
    <div>
      {series.length > 1 && <Legend items={series} />}
      <div style={{ height }} role="img" aria-label={`${name}. The table below lists the same figures.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="24%" barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={AXIS_TICK} minTickGap={12} tickMargin={6} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => axisFormat(v).replace(/ /g, '\u00a0')} width={66} />
            <Tooltip cursor={{ fill: 'var(--bg)' }} isAnimationActive={false}
              content={({ active, payload }) => {
                const d = payload?.[0]?.payload as Datum | undefined
                if (!active || !d) return null
                return (
                  <TipCard title={d.title ?? d.label}
                    rows={series.map((s) => ({ label: s.label, color: s.color, value: format(num(d[s.key])) }))}
                    total={stacked && series.length > 1 ? format(series.reduce((a, s) => a + num(d[s.key]), 0)) : undefined} />
                )
              }} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId={stacked ? 'stack' : undefined} fill={s.color}
                maxBarSize={24} shape={shape(s.key)} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export interface BarRow { key: string; label: string; values: number[]; note?: string }

/**
 * Ranked horizontal bars, one row per item, every bar on the same baseline. Each value is printed at the end of its
 * bar, so nothing depends on hover. Rows past `max` are folded into "Other".
 */
export function BarList({ rows, series, format, max = 8, sort = true, otherLabel = 'Other' }: {
  rows: BarRow[]; series: { label: string; color: string }[]; format: (n: number) => string; max?: number; sort?: boolean; otherLabel?: string
}) {
  let shown = sort ? [...rows].sort((a, b) => b.values[0] - a.values[0]) : rows
  if (shown.length > max) {
    const rest = shown.slice(max - 1)
    shown = [...shown.slice(0, max - 1), {
      key: '__other', label: `${otherLabel} (${rest.length})`, values: series.map((_, i) => rest.reduce((a, r) => a + r.values[i], 0)),
    }]
  }
  const top = Math.max(1, ...shown.flatMap((r) => r.values))
  const single = series.length === 1
  return (
    <div>
      {!single && <Legend items={series} />}
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate text-ink" title={r.label}>{r.label}</span>
              <span className={`tnum shrink-0 ${single ? 'font-medium text-ink' : 'text-ink-2'}`}>{single ? format(r.values[0]) : r.note}</span>
            </div>
            {single && r.note && <div className="text-xs text-ink-3">{r.note}</div>}
            <div className={`mt-1.5 ${single ? '' : 'space-y-[3px]'}`}>
              {series.map((s, i) => (
                <div key={s.label} className="flex items-center gap-2.5" title={`${r.label}: ${s.label} ${format(r.values[i])}`}>
                  <div className="h-2 min-w-0 flex-1">
                    <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(r.values[i] > 0 ? 0.6 : 0, (r.values[i] / top) * 100)}%`, background: s.color }} />
                  </div>
                  {!single && <span className="tnum w-[5.5rem] shrink-0 text-right text-xs text-ink">{format(r.values[i])}</span>}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One whole split into a few parts: a single tall bar, each part's share printed on it where it fits, names and amounts below. */
export function SplitBar({ parts, format }: { parts: { label: string; value: number; color: string; note?: string }[]; format: (n: number) => string }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  const live = parts.filter((p) => p.value > 0)
  return (
    <div>
      <div className="flex h-7 gap-0.5" role="img" aria-label={live.map((p) => `${p.label} ${format(p.value)}, ${pct(p.value, total)}`).join('; ')}>
        {live.map((p) => (
          <div key={p.label} className="flex min-w-0 items-center rounded-[4px] px-2 text-xs font-semibold text-white"
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${format(p.value)} (${pct(p.value, total)})`}>
            {p.value / total >= 0.14 ? pct(p.value, total) : ''}
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-[13px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-baseline gap-2">
            <span className="translate-y-px"><Swatch color={p.color} /></span>
            <span className="min-w-0 flex-1 text-ink-2">{p.label}{p.note && <span className="text-ink-3"> ({p.note})</span>}</span>
            <span className="tnum shrink-0 font-medium text-ink">{format(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Headline figures set as one ruled ledger rather than a row of separate cards. */
export function Ledger({ children, cols }: { children: ReactNode; cols: 3 | 4 }) {
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line ${cols === 4 ? 'lg:grid-cols-4' : 'md:grid-cols-3'}`}>
      {children}
    </div>
  )
}

export function Tile({ label, value, full, note, alert }: { label: string; value: string; full?: string; note?: ReactNode; alert?: boolean }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-center gap-1.5 text-[13px] text-ink-2">
        {alert && <span aria-hidden className="size-1.5 rounded-full bg-bad" />}
        {label}
      </div>
      <div className="figure mt-1 truncate text-[22px] leading-tight font-semibold text-ink sm:text-[26px]" title={full}>{value}</div>
      {note && <div className="mt-1 text-xs leading-snug text-ink-3">{note}</div>}
    </div>
  )
}
