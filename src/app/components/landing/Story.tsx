import { useRef, useState, type ReactNode } from 'react'
import type { Style } from '@/engine/types'
import { LiveSlide, MENU } from './LiveSlide'
import { CHECK_COUNT, TASTE } from './taste'

/** The answer: a closed menu of seven components, designed once, that the agent fills and never redraws. */
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
            <h2 id="answer" className="site-h2">Designed once. Configured forever.</h2>
            <p className="site-lede">
              SmartChart’s agent never draws a slide. It picks one of seven components a designer built and reviewed,
              and fills them with your words and numbers. The design lives in code, so it can’t drift.
            </p>
          </div>
          <div className="flex gap-2 max-[700px]:hidden">
            <Paddle label="Previous" disabled={edge.start} onClick={() => page(-1)}>‹</Paddle>
            <Paddle label="Next" disabled={edge.end} onClick={() => page(1)}>›</Paddle>
          </div>
        </div>
        <ul ref={strip} onScroll={onScroll} className="-mx-10 flex snap-x snap-mandatory scroll-px-10 gap-6 overflow-x-auto px-10 pb-2 [scrollbar-width:none] max-[700px]:-mx-4 max-[700px]:scroll-px-4 max-[700px]:px-4" aria-label="The seven components">
          {MENU.map(({ id, name }, i) => (
            <li key={id} className="grid w-[min(640px,84vw)] flex-none snap-start gap-3">
              <LiveSlide id={id} className="rounded-xl shadow-[0_0_0_1px_rgba(243,238,228,.1)]" />
              <span className="flex gap-3 text-[14px] text-[#A39B8E]"><b className="font-medium tabular-nums text-[#F3EEE4]">{i + 1}/{MENU.length}</b>{name}</span>
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
  ['Describe it', 'Paste numbers, notes or a table, and say what the slide should argue.'],
  ['It picks the component', 'A chart, a table, a big number, steps or cards, then an action title that states the so-what.'],
  ['It measures every slide', 'At 1920 × 1080, before you see it. Anything that doesn’t fit goes back to be fixed.'],
]

export function How() {
  return (
    <section aria-labelledby="how" className="site-section">
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-16 max-[900px]:grid-cols-1 max-[900px]:gap-10">
        <div className="grid gap-10">
          <h2 id="how" className="site-h2">From a sentence to a finished slide.</h2>
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

/** Taste as a spec sheet: numbers the engine checks, not adjectives. */
export function Taste() {
  return (
    <section aria-labelledby="taste" className="site-section">
      <div className="site-head">
        <h2 id="taste" className="site-h2">Taste, quantified.</h2>
        <p className="site-lede">
          Good design is usually a matter of opinion. Here it is {CHECK_COUNT} checks every slide is held to,
          plus a measurement of every line at full size. A slide ships only when it passes.
        </p>
      </div>
      <dl className="grid grid-cols-4 gap-x-8 max-[1000px]:grid-cols-2 max-[520px]:grid-cols-1">
        {TASTE.map((r) => (
          <div key={r.value} className="grid content-start gap-3 border-t border-type py-7">
            <dt className="font-display text-[clamp(40px,4.4vw,60px)] font-extrabold leading-none tracking-[-.01em] [font-stretch:78%]">{r.value}</dt>
            <dd className="max-w-[30ch] text-[15px] leading-[1.5] text-type-2">{r.rule}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const CASES: [string, string, string, string][] = [
  ['waterfall', 'Board update', 'Where the growth came from, as a bridge the board reads in one glance.', 'consulting'],
  ['number', 'Seed pitch', 'The problem as one number investors remember.', 'pitch'],
  ['table', 'Finance review', 'Unit economics in a table that is typeset, not pasted.', 'consulting'],
]

export function UseCases() {
  const [style, setStyle] = useState<Style | null>(null)
  return (
    <section aria-labelledby="cases" className="site-section">
      <div className="site-head flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-4">
          <h2 id="cases" className="site-h2">For the decks that matter.</h2>
          <p className="site-lede">Two writing styles on the same components. Consulting puts the argument in the title; Pitch keeps it to one bold claim.</p>
        </div>
        <div role="group" aria-label="Writing style" className="flex rounded-full bg-paper-2 p-1">
          {([[null, 'Mixed'], ['consulting', 'All consulting'], ['pitch', 'All pitch']] as [Style | null, string][]).map(([v, label]) => (
            <button key={label} type="button" aria-pressed={style === v} onClick={() => setStyle(v)}
              className="h-9 rounded-full px-4 text-[13px] text-type-2 transition-colors aria-pressed:bg-white aria-pressed:text-type aria-pressed:shadow-sm">{label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-8 max-[1000px]:grid-cols-1">
        {CASES.map(([id, title, text, own]) => (
          <div key={id} className="grid content-start gap-4">
            <LiveSlide id={id} deckStyle={style ?? (own as Style)} className="rounded-xl shadow-[0_18px_44px_-24px_rgba(18,18,17,.4)]" />
            <div className="grid gap-1">
              <h3 className="text-[17px] font-semibold tracking-[-.01em]">{title}</h3>
              <p className="max-w-[40ch] text-[15px] leading-[1.55] text-type-2">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
