import { GROUPS, STARTERS, type Starter } from '@/engine/starters'
import type { Style, Theme } from '@/engine/types'
import { StartPrompt } from './StartPrompt'
import { Tile } from './Tile'

interface Props {
  deckStyle: Style; theme: Theme; accent: string | null; live: boolean
  onStyle: (s: Style) => void; onPick: (s: Starter) => void; onSend: (text: string) => void
  locked?: { text: string; action: string; onAction: () => void }
}

/** A new deck: one question and one prompt first; examples below, grouped by what the slide has to do. */
export function Gallery({ deckStyle: style, theme, accent, live, onStyle, onPick, onSend, locked }: Props) {
  return (
    <div className="min-h-0 overflow-y-auto px-8 pb-16 pt-[min(12vh,112px)] max-[900px]:order-1 max-[900px]:overflow-visible max-[900px]:px-4 max-[900px]:pt-8">
      <div className="mx-auto grid max-w-[1400px] gap-20 max-[900px]:gap-12">
        <header className="mx-auto grid w-full max-w-[720px] gap-6">
          <h2 className="text-center text-[32px] font-semibold leading-[1.15] tracking-[-.02em] max-[900px]:text-left max-[900px]:text-[24px]">What should this slide say?</h2>
          <StartPrompt deckStyle={style} onStyle={onStyle} onSend={onSend} live={live} locked={locked} />
        </header>
        <div className="grid gap-12">
          <h2 className="text-[13px] font-medium text-ink-2">Or start from an example, and change it in your own words</h2>
          {GROUPS.map((g) => (
            <section key={g.id} className="grid gap-4">
              <h3 className="text-[15px] font-medium text-ink">{g.label}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-5 max-[900px]:grid-cols-1">
                {STARTERS.filter((s) => s.group === g.id).map((s) => <Tile key={s.id} starter={s} deckStyle={style} theme={theme} accent={accent} onPick={onPick} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
