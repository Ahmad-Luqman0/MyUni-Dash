import type { LucideIcon } from 'lucide-react'

export interface NavItem { id: string; label: string; icon: LucideIcon }

/** Navigation: a white rail down the left on wide screens carrying the university logo, a top bar with a scrolling row of sections on narrow ones. */
export function Rail({ items, current, onSelect }: { items: NavItem[]; current: string; onSelect: (id: string) => void }) {
  return (
    <div className="on-rail sticky top-0 z-20 border-b border-line bg-rail text-rail-ink lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 lg:block lg:px-5 lg:pt-6 lg:pb-5">
        <img src="/myuni-logo.png" alt="My University" width={600} height={181} className="h-10 w-auto lg:h-auto lg:w-full" />
        <div className="text-right text-xs text-rail-ink-2 lg:mt-3 lg:border-t lg:border-line lg:pt-3 lg:text-left">Registrar and finance office</div>
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
                    active ? 'text-accent-deep lg:bg-rail-2' : 'text-rail-ink-2 hover:text-ink lg:hover:bg-bg'}`}>
                  <it.icon aria-hidden className="hidden size-[18px] shrink-0 lg:block" strokeWidth={1.8} />
                  {it.label}
                  {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-accent lg:inset-x-auto lg:inset-y-2 lg:left-0 lg:h-auto lg:w-[3px]" />}
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
