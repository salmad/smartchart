import type { ReactNode } from 'react'
import { Cta } from './Cta'
import { SlopSlide } from './SlopSlide'

/* The maker's own words about the pain, from docs/product/USERS.md. Voice of customer, never praise of Occam. */
const QUOTES: [string, string][] = [
  ['Just think it’s insane how much time gets spent formatting slides.', 'https://news.ycombinator.com/item?id=39430872'],
  ['messes up one trivial formatting detail and his boss makes him redo the entire thing.', 'https://news.ycombinator.com/item?id=17263428'],
]
const STUDY = 'https://www.empowersuite.com/hubfs/Marketing/Downloads/PowerPoint%20Studie%202020/Englisch/The%20Ultimate%20Global%20PowerPoint%20Study%20-%20empower.pdf'

/** The problem three ways, each shown rather than told; then the night before, what it costs, and the maker's own words. */
export function Problems() {
  return (
    <section aria-labelledby="problems" className="site-section">
      <div className="site-head">
        <h2 id="problems" className="site-h2">You have the thinking. The slides take the evening.</h2>
        <p className="site-lede">The room decides in seconds, and it judges the slide before it hears your point.</p>
      </div>
      <div className="grid grid-cols-3 gap-x-8 gap-y-12 max-[900px]:grid-cols-1">
        <Problem title="Docs pasted into slides." text="A wall of bullets and a stock picture. The point is in there somewhere.">
          <SlopSlide className="block size-full" />
        </Problem>
        <Problem title="Every slide drifts." text="An hour a slide, fixing fonts and edges. And the deck still looks like five people made it.">
          <Drift />
        </Problem>
        <Problem title="AI slides that say nothing." text="Ask a chatbot for slides: a new layout every time, text off the page, and nobody checked any of it.">
          <Spill />
        </Problem>
      </div>
      {/* Agitate: the night before, in the maker's own situation (USERS.md), then the cost of doing nothing. */}
      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-16 gap-y-10 border-t border-rule pt-12 max-[900px]:grid-cols-1">
        <div className="grid content-start gap-5">
          <p className="font-display text-[clamp(30px,3.2vw,46px)] font-extrabold leading-[1] tracking-[-.015em] [font-stretch:78%]">It’s 11pm. The deck is due at 9.</p>
          <p className="max-w-[54ch] text-[17px] leading-[1.6] text-type-2">
            You’ve re-aligned the same chart three times, and your point is still buried on slide seven. Tomorrow the room skims your
            titles, loses the thread by slide three, and the idea you spent weeks on becomes “let’s revisit next quarter.”
          </p>
          <p className="max-w-[54ch] text-[17px] leading-[1.6] text-type-2">
            It’s not just tonight. It’s <b className="font-semibold text-type">7 hours a week</b> in PowerPoint, a third of it formatting.
            <a href={STUDY} className="ml-0.5 align-super text-[11px] text-type-3 hover:text-type-2" aria-label="Source: empower PowerPoint study, 2020">1</a>{' '}
            And every deck is a verdict on you, not just the idea.
          </p>
        </div>
        <div className="grid content-start gap-8">
          {QUOTES.map(([q, url]) => (
            <figure key={url} className="grid gap-2">
              <blockquote className="font-display text-[clamp(22px,2vw,28px)] font-bold leading-[1.15] tracking-[-.01em] [font-stretch:78%]">“{q}”</blockquote>
              <figcaption className="text-[13px] text-type-3">— <a href={url} className="underline decoration-rule underline-offset-4 hover:text-type-2">on Hacker News</a></figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="grid gap-4">
        <Cta />
        <p className="text-[12px] text-type-3">1. empower, “The Ultimate Global PowerPoint Study”, 1,102 office workers, 2020.</p>
      </div>
    </section>
  )
}

function Problem({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-5">
      <div className="aspect-video overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(18,18,17,.08)]" aria-hidden>{children}</div>
      <div className="grid gap-1.5">
        <h3 className="text-[17px] font-semibold tracking-[-.01em] text-type">{title}</h3>
        <p className="max-w-[36ch] text-[15px] leading-[1.55] text-type-2">{text}</p>
      </div>
    </div>
  )
}

/** Three slides of one deck that share nothing: typeface, colour, size and alignment all differ. */
function Drift() {
  return (
    <div className="grid size-full grid-cols-3 items-center gap-2.5 bg-paper-2 p-4">
      <div className="grid aspect-[3/4] content-start gap-1.5 rounded bg-white p-2 shadow-sm">
        <b className="text-center font-serif text-[13px] leading-tight text-[#1F4E9A]">Market Overview</b>
        <i className="mx-auto h-1 w-4/5 rounded bg-[#C9D6EA]" /><i className="mx-auto h-1 w-3/5 rounded bg-[#C9D6EA]" />
        <i className="mt-1 h-8 rounded bg-[#7FA6DE]" />
      </div>
      <div className="grid aspect-[3/4] content-start gap-1.5 rounded bg-[#1D2B3A] p-2 shadow-sm">
        <b className="font-sans text-[15px] font-black uppercase leading-none text-[#F5C542]">KEY WINS!!</b>
        <i className="h-1 w-full rounded bg-[#51657A]" /><i className="h-1 w-4/5 rounded bg-[#51657A]" /><i className="h-1 w-2/3 rounded bg-[#51657A]" />
        <i className="mt-1 h-6 w-2/3 rounded-full bg-[#3FB58B]" />
      </div>
      <div className="grid aspect-[3/4] content-start gap-1.5 rounded bg-[#FFF8EE] p-2 text-right shadow-sm">
        <b className="font-mono text-[10px] leading-tight text-[#8A3FB8]">next steps &amp; roadmap</b>
        <i className="ml-auto h-1 w-3/4 rounded bg-[#E6D2F0]" /><i className="ml-auto h-1 w-1/2 rounded bg-[#E6D2F0]" />
        <i className="mt-1 grid h-8 grid-cols-3 gap-0.5"><i className="rounded-sm bg-[#E86A92]" /><i className="rounded-sm bg-[#F2A65A]" /><i className="rounded-sm bg-[#6CC3D5]" /></i>
      </div>
    </div>
  )
}

/** A generated slide whose body text runs out of its box and over the footer. */
function Spill() {
  return (
    <div className="relative grid size-full content-start gap-2 bg-white p-5 font-sans">
      <b className="text-[15px] font-bold leading-tight text-[#222]">Our Strategic Priorities for the Next Fiscal Year and Beyond</b>
      <div className="relative h-[46%] rounded border-2 border-dashed border-[#D9534F]/70 p-2">
        <p className="text-[11px] leading-[1.45] text-[#444]">
          We will accelerate growth by expanding into new markets, deepening relationships with existing customers,
          investing in product innovation, optimising our cost base, and building a world-class team that lives our values
          every single day while also exploring strategic partnerships and potential acquisitions where appropriate.
        </p>
      </div>
      <span className="absolute bottom-3 right-4 text-[10px] text-[#999]">Confidential · Page 7</span>
    </div>
  )
}
