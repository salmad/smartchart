import { GROUPS, STARTERS, type Starter } from '@/engine/starters'
import type { Style, Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { Tile } from './Tile'

interface Props { deckStyle: Style; theme: Theme; accent: string | null; onStyle: (s: Style) => void; onPick: (s: Starter) => void }

const STYLES: [Style, string, string][] = [
  ['consulting', 'Consulting', 'the argument in the title, the evidence below.'],
  ['pitch', 'Pitch', 'one bold claim, big numbers, little text.'],
]

/** The empty state: every starter, live in the chosen style, palette and accent. Picking one starts a deck. */
export function Gallery({ deckStyle: style, theme, accent, onStyle, onPick }: Props) {
  return (
    <div className="min-h-0 overflow-y-auto px-8 pb-16 pt-9 max-[900px]:order-1 max-[900px]:overflow-visible max-[900px]:px-4 max-[900px]:pt-6">
      <div className="mx-auto grid max-w-[1400px] gap-10">
        <header className="grid gap-5">
          <div className="grid gap-1.5">
            <h2 className="text-[22px] font-semibold tracking-[-.01em]">Start from a slide</h2>
            <p className="max-w-[640px] text-ink-2">Pick one. It opens as your first slide, then tell the chat what to change: your numbers, your words, a different chart.</p>
          </div>
          <div role="group" aria-label="Writing style" className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
            {STYLES.map(([id, name, line]) => (
              <button key={id} type="button" aria-pressed={style === id} onClick={() => onStyle(id)}
                className={cn('rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors',
                  style === id ? 'border-line-2 bg-raise text-ink' : 'border-line text-ink-3 hover:text-ink-2')}>
                <b className="font-medium text-ink">{name}:</b> {line}
              </button>
            ))}
          </div>
        </header>
        {GROUPS.map((g) => (
          <section key={g.id} className="grid gap-4">
            <h3 className="font-mono text-[11px] font-medium uppercase leading-none tracking-[.1em] text-ink-3">{g.label}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(420px,1fr))] gap-5 max-[900px]:grid-cols-1">
              {STARTERS.filter((s) => s.group === g.id).map((s) => <Tile key={s.id} starter={s} deckStyle={style} theme={theme} accent={accent} onPick={onPick} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
