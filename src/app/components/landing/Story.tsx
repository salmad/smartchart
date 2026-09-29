import { useRef, useState, type ReactNode } from 'react'
import type { Style } from '@/engine/types'
import { Cta } from './Cta'
import { Film } from './Film'
import { LiveSlide, MENU } from './LiveSlide'
import { Head } from './parts'

/** The answer, as an outcome: every slide in the gallery, designed once, so a deck never drifts. */
export function Answer() {
  const strip = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const onScroll = () => {
    const el = strip.current
    if (el) setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }
  // One card at a time, like a carousel's paddles.
  const page = (dir: 1 | -1) => {
    const el = strip.current, card = el?.querySelector('li')
    if (el && card) el.scrollBy({ left: dir * (card.clientWidth + 24), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  return (
    <section aria-labelledby="answer" className="site-night" data-night>
      <div className="site-section">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Head id="answer" title="Every slide you need."
            lede="Trends, bridges, comparisons, plans, key figures. Each one designed once and reused, so slide thirty looks like slide one." />
          <div className="flex gap-2 max-[700px]:hidden">
            <Paddle label="Previous" disabled={edge.start} onClick={() => page(-1)}>‹</Paddle>
            <Paddle label="Next" disabled={edge.end} onClick={() => page(1)}>›</Paddle>
          </div>
        </div>
        <ul ref={strip} onScroll={onScroll} className="-mx-10 flex snap-x snap-mandatory scroll-px-10 gap-6 overflow-x-auto px-10 pb-2 [scrollbar-width:none] max-[700px]:-mx-4 max-[700px]:scroll-px-4 max-[700px]:px-4" aria-label="Every slide in the gallery">
          {MENU.map(({ id, name, group }, i) => (
            <li key={id} className="grid w-[min(640px,84vw)] flex-none snap-start gap-3">
              <LiveSlide id={id} className="rounded-[14px] shadow-[0_0_0_1px_rgba(243,238,228,.1)]" />
              <span className="flex gap-3 text-[14px] text-[#A39B8E]"><b className="font-medium tabular-nums text-[#F3EEE4]">{i + 1}/{MENU.length}</b>{group} · {name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Paddle({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="grid size-11 place-items-center rounded-full bg-[#F3EEE4]/10 text-[22px] leading-none text-[#F3EEE4] transition-colors hover:bg-[#F3EEE4]/20 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-[#F3EEE4]/10">
      <span aria-hidden className="-mt-0.5">{children}</span>
    </button>
  )
}

/** The solution, revealed right after the problem: a line of words, then the product at work. */
export function How() {
  return (
    <section aria-labelledby="how" className="site-section">
      <Head id="how" center title={<>Ask in plain words.<br /> Get a checked slide.</>} />
      <div className="mx-auto w-full max-w-[1200px]"><Film /></div>
    </section>
  )
}

/* Use cases, split by what the deck asks the room for: money, a yes, or trust in the numbers. Each with a real slide. */
const USES: [id: string, ask: string, title: string, text: string, style: Style][] = [
  ['cards-value', 'Fund it', 'The raise', 'Seed deck or investor update: the market, the model, the ask.', 'pitch'],
  ['table-notes', 'Approve it', 'The business case', 'The 12-page proposal nobody will read, as ten slides the execs will.', 'consulting'],
  ['chart-mix', 'Trust it', 'The board or quarterly review', 'What moved, why it moved, and what happens next.', 'consulting'],
]

/** What it is for: three decks, one per thing the room is asked to do. */
export function Who() {
  return (
    <section aria-labelledby="who" className="site-section">
      <Head id="who" center title="For decks that ask for something."
        lede="Money, a yes, or trust in the numbers. Made for founders, operators and ex-consultants with no slide team." />
      <div className="grid grid-cols-3 gap-6 max-[1000px]:grid-cols-1">
        {USES.map(([id, ask, title, text, style]) => (
          <div key={id} className="site-card grid content-start gap-6 p-3 pb-7">
            <LiveSlide id={id} deckStyle={style} className="rounded-[12px]" />
            <div className="grid gap-2 px-4">
              <span className="font-mono text-[12px] text-type-3">{ask}</span>
              <h3 className="text-[19px] font-semibold tracking-[-.015em]">{title}</h3>
              <p className="max-w-[40ch] text-[15px] leading-[1.55] text-type-2">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="grid justify-items-center"><Cta /></div>
    </section>
  )
}
