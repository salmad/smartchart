import type { ReactNode } from 'react'
import { DefaultColumns, Nudging } from './ProblemArt'
import { SlopSlide } from './SlopSlide'
import { Em, Head } from './parts'

const STUDY = 'https://www.empowersuite.com/hubfs/Marketing/Downloads/PowerPoint%20Studie%202020/Englisch/The%20Ultimate%20Global%20PowerPoint%20Study%20-%20empower.pdf'

/** The problem and what it costs, in one row: the standard tools are ugly and tedious, AI is inconsistent slop. Shown, not told. */
export function Problems() {
  return (
    <section aria-labelledby="problems" className="site-section">
      <Head id="problems" kicker="The problem" center
        title={<>Slide tools look cheap. <Em>AI looks like slop.</Em></>}
        lede="And the room judges the slide before it hears your point." />
      <div className="grid grid-cols-3 gap-6 max-[900px]:grid-cols-1">
        <Problem tag="Standard tools" title="Ugly by default."
          text="Stock colours, a legend to decode, a label on every bar. Your one number is in there somewhere.">
          <DefaultColumns className="block size-full" />
        </Problem>
        <Problem tag="Standard tools" title="Tedious to fix."
          text={<>An hour a slide on the aligns. Office workers spend 7 hours a week in slide software, a third of it formatting.<Ref /></>}>
          <Nudging className="block size-full" />
        </Problem>
        <Problem tag="AI tools" title="Slop, every time different."
          text="A wall of bullets, a stock picture, text off the edge. A new layout on every slide, and nobody checks the numbers.">
          <SlopSlide className="block size-full" />
        </Problem>
      </div>
      <p className="text-center text-[12px] text-type-3">1. empower, “The Ultimate Global PowerPoint Study”, 1,102 office workers, 2020.</p>
    </section>
  )
}

function Ref() {
  return <a href={STUDY} className="ml-0.5 align-super text-[11px] text-type-3 hover:text-type-2" aria-label="Source: empower PowerPoint study, 2020">1</a>
}

function Problem({ tag, title, text, children }: { tag: string; title: string; text: ReactNode; children: ReactNode }) {
  return (
    <div className="site-card grid content-start gap-6 p-3 pb-7">
      <div className="aspect-video overflow-hidden rounded-[12px] bg-white shadow-[0_0_0_1px_rgba(18,18,17,.08)]" aria-hidden>{children}</div>
      <div className="grid gap-2 px-4">
        <span className="font-mono text-[12px] text-type-3">{tag}</span>
        <h3 className="font-display text-[26px] font-extrabold leading-none tracking-[-.01em] [font-stretch:78%]">{title}</h3>
        <p className="max-w-[40ch] text-[15px] leading-[1.55] text-type-2">{text}</p>
      </div>
    </div>
  )
}
