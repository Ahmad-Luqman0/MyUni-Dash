const full = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** Rs 1,234,567 */
export const rs = (n: number) => `Rs ${full.format(n)}`
/** Rs 1.2M */
export const rsShort = (n: number) => `Rs ${compact.format(n)}`
export const count = (n: number) => full.format(n)
/** 12.9K on an axis */
export const countShort = (n: number) => (Math.abs(n) < 10000 ? full.format(n) : compact.format(n))
export const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '–')

const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const shortDayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
/** Mar 25 */
export const monthLabel = (iso: string) => monthFmt.format(new Date(iso))
/** 3 Mar 2025 */
export const dateLabel = (iso: string | null) => (iso ? dayFmt.format(new Date(iso)) : '–')
/** 3 Mar */
export const dayLabel = (iso: string) => shortDayFmt.format(new Date(iso))
/** "14 Mar to 17 Nov 2026" within one year; "14 Mar 2024 to 17 Nov 2026" when the two dates are in different years. */
export const rangeLabel = (from: string, to: string) =>
  `${from.slice(0, 4) === to.slice(0, 4) ? dayLabel(from) : dateLabel(from)} to ${dateLabel(to)}`

/** yyyy-mm-dd in local time */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** ERP names are often ALL CAPS ("BS COMPUTER SCIENCE"); show them in title case. Mixed-case names and short codes (BBA, LLB) stay as they are. */
export function nice(name: string | null | undefined): string {
  if (!name) return 'Not specified'
  const t = name.trim()
  if (t !== t.toUpperCase() || !/[A-Z]/.test(t) || !/\s/.test(t)) return t
  const small = new Set(['and', 'of', 'in', 'for', 'the'])
  return t.toLowerCase()
    .replace(/(^|[\s(/&-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
    .replace(/\b(Bs|Ms|Bba|Mba|Llb|Dpt|It|Ai|Mphil|Phd)\b/g, (w) => (w === 'Mphil' ? 'MPhil' : w === 'Phd' ? 'PhD' : w.toUpperCase()))
    .replace(/\s(And|Of|In|For|The)\b/g, (w) => (small.has(w.trim().toLowerCase()) ? w.toLowerCase() : w))
}
