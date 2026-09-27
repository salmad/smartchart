import type { ReactNode } from 'react'
import { DefaultChart } from './DefaultChart'

/** The problem three ways, each shown rather than told. */
export function Problems() {
  return (
    <section aria-labelledby="problems" className="site-section">
      <div className="site-head">
        <h2 id="problems" className="site-h2">Slide tools hand you a blank page and a box of defaults.</h2>
        <p className="site-lede">So every deck ends up with the same three problems.</p>
      </div>
      <div className="grid grid-cols-3 gap-x-8 gap-y-12 max-[900px]:grid-cols-1">
        <Problem title="Defaults are noise." text="Four colours, a legend to decode and a grid behind every bar. The point is in there somewhere.">
          <DefaultChart className="block size-full" />
        </Problem>
        <Problem title="Every slide starts from zero." text="Fonts, sizes and colours drift from slide to slide, until the deck reads as if five people wrote it.">
          <Drift />
        </Problem>
        <Problem title="AI tools improvise." text="They invent a new layout for every prompt. Text spills out of its box and no two slides agree.">
          <Spill />
        </Problem>
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
