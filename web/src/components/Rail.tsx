import type { LucideIcon } from 'lucide-react'

export interface NavItem { id: string; label: string; icon: LucideIcon }

function Crest() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="size-9 shrink-0">
      <rect width="32" height="32" rx="7" fill="var(--rail-2)" />
      <path d="M6 11.5 16 7l10 4.5L16 16z" fill="var(--chalk)" />
      <path d="M10 15.2v5.1c1.7 1.6 3.7 2.4 6 2.4s4.3-.8 6-2.4v-5.1L16 18z" fill="var(--rail-ink)" />
    </svg>
  )
}

/** Navigation: a dark green rail down the left on wide screens, a top bar with a scrolling row of sections on narrow ones. */
export function Rail({ items, current, onSelect }: { items: NavItem[]; current: string; onSelect: (id: string) => void }) {
  return (
    <div className="on-rail sticky top-0 z-20 bg-rail text-rail-ink lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 lg:px-5 lg:pt-6 lg:pb-6">
        <Crest />
        <div className="min-w-0">
          <div className="font-display text-xl leading-tight font-semibold lg:text-[22px]">MyUni</div>
          <div className="text-xs text-rail-ink-2">Registrar and finance office</div>
        </div>
      </div>
      <nav aria-label="Sections" className="no-scrollbar overflow-x-auto lg:flex-1 lg:overflow-y-auto lg:px-3">
        <ul className="flex gap-1 px-3 lg:flex-col lg:gap-0.5 lg:px-0">
          {items.map((it) => {
            const active = it.id === current
            return (
              <li key={it.id} className="shrink-0">
                <a href={`#${it.id}`} aria-current={active ? 'page' : undefined}
                  onClick={(e) => { e.preventDefault(); onSelect(it.id) }}
                  className={`relative flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-md lg:py-2.5 ${
                    active ? 'text-white lg:bg-rail-2' : 'text-rail-ink-2 hover:text-white lg:hover:bg-rail-2/60'}`}>
                  <it.icon aria-hidden className="hidden size-[18px] shrink-0 lg:block" strokeWidth={1.8} />
                  {it.label}
                  {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-chalk lg:inset-x-auto lg:inset-y-2 lg:left-0 lg:h-auto lg:w-[3px]" />}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <p className="hidden px-5 py-5 text-xs leading-relaxed text-rail-ink-2 lg:block">Figures come from the university ERP and follow the filters at the top of the page.</p>
    </div>
  )
}
