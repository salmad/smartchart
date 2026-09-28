import { useRef, useState, type ReactNode } from 'react'
import type { Style } from '@/engine/types'
import { Cta } from './Cta'
import { LiveSlide, MENU } from './LiveSlide'

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
          <div className="site-head">
            <h2 id="answer" className="site-h2">Every slide a case needs.</h2>
            <p className="site-lede">
              Trends, bridges, comparisons, plans, key numbers. Each designed once and used on every slide,
              so slide thirty looks like slide one.
            </p>
          </div>
          <div className="flex gap-2 max-[700px]:hidden">
            <Paddle label="Previous" disabled={edge.start} onClick={() => page(-1)}>‹</Paddle>
            <Paddle label="Next" disabled={edge.end} onClick={() => page(1)}>›</Paddle>
          </div>
        </div>
        <ul ref={strip} onScroll={onScroll} className="-mx-10 flex snap-x snap-mandatory scroll-px-10 gap-6 overflow-x-auto px-10 pb-2 [scrollbar-width:none] max-[700px]:-mx-4 max-[700px]:scroll-px-4 max-[700px]:px-4" aria-label="Every slide in the gallery">
          {MENU.map(({ id, name, group }, i) => (
            <li key={id} className="grid w-[min(640px,84vw)] flex-none snap-start gap-3">
              <LiveSlide id={id} className="rounded-xl shadow-[0_0_0_1px_rgba(243,238,228,.1)]" />
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

const STEPS: [string, string][] = [
  ['Paste it', 'Your doc, your notes or your numbers. Say what the room should take away.'],
  ['Refine it', '“Make the title sharper.” “Show it as a bridge.” “Add the plan.” Only what you asked changes, and the laws still hold.'],
  ['Present it', 'Full screen, straight from the app. Walk in with a deck that argues your point.'],
]

export function How() {
  return (
    <section aria-labelledby="how" className="site-section">
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-16 max-[900px]:grid-cols-1 max-[900px]:gap-10">
        <div className="grid gap-10">
          <div className="grid gap-4">
            <h2 id="how" className="site-h2">You bring the thinking. We do the rest.</h2>
            <p className="site-lede">No layouts to pick, no boxes to nudge. A finished slide in a minute.</p>
          </div>
          <ol className="grid gap-8">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[40px_1fr] gap-x-4">
                <span className="font-display text-[28px] font-extrabold leading-none text-type-3 [font-stretch:78%]">{i + 1}</span>
                <div className="grid gap-1">
                  <h3 className="text-[17px] font-semibold tracking-[-.01em]">{title}</h3>
                  <p className="max-w-[40ch] text-[15px] leading-[1.55] text-type-2">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule pt-6 text-[15px] text-type-2">
            <span className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[12px] font-medium text-type">Soon</span>
            Export to PowerPoint and PDF, share links, and connect your own agents: your research in Claude or Gemini, your slides from Occam.
          </p>
          <Cta />
        </div>
        <figure className="grid gap-4">
          <blockquote className="justify-self-end rounded-[18px_18px_4px_18px] bg-white px-4 py-3 text-[15px] leading-[1.5] text-type shadow-[0_0_0_1px_rgba(18,18,17,.08)]">
            The loan book grows from £10m to £120m by 2030. Show it against the £100m plan.
          </blockquote>
          <LiveSlide id="chart-cagr" className="rounded-xl shadow-[0_24px_60px_-28px_rgba(18,18,17,.45)]" />
        </figure>
      </div>
    </section>
  )
}

const PEOPLE: [string, string, string, Style][] = [
  ['cards-value', 'Founders', 'Your raise, your investor update, your board meeting. Look like you have a strategy team.', 'pitch'],
  ['table-notes', 'Operators', 'Your business case lives in a 12-page doc nobody will read. Turn it into ten slides they will.', 'consulting'],
  ['waterfall-notes', 'Ex-consultants', 'The standard you were trained to, without the late nights.', 'consulting'],
]

/** Who it is for, each with a real slide; the same components in either writing style. */
export function Who() {
  const [style, setStyle] = useState<Style | null>(null)
  return (
    <section aria-labelledby="who" className="site-section">
      <div className="site-head flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-4">
          <h2 id="who" className="site-h2">For whoever has to make the case.</h2>
          <p className="site-lede">Two writing styles, one set of laws. Consulting argues in the title. Pitch lands one bold claim.</p>
        </div>
        <div role="group" aria-label="Writing style" className="flex rounded-full bg-paper-2 p-1">
          {([[null, 'Mixed'], ['consulting', 'All consulting'], ['pitch', 'All pitch']] as [Style | null, string][]).map(([v, label]) => (
            <button key={label} type="button" aria-pressed={style === v} onClick={() => setStyle(v)}
              className="h-9 rounded-full px-4 text-[13px] text-type-2 transition-colors aria-pressed:bg-white aria-pressed:text-type aria-pressed:shadow-sm">{label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-8 max-[1000px]:grid-cols-1">
        {PEOPLE.map(([id, title, text, own]) => (
          <div key={id} className="grid content-start gap-4">
            <LiveSlide id={id} deckStyle={style ?? own} className="rounded-xl shadow-[0_18px_44px_-24px_rgba(18,18,17,.4)]" />
            <div className="grid gap-1">
              <h3 className="text-[17px] font-semibold tracking-[-.01em]">{title}</h3>
              <p className="max-w-[40ch] text-[15px] leading-[1.55] text-type-2">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <Cta />
    </section>
  )
}
