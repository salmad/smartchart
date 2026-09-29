import { plain } from '@/engine/slides/schema'
import { STARTERS } from '@/engine/starters'
import { Cta } from './Cta'
import { LiveSlide } from './LiveSlide'
import { Em, Head } from './parts'
import { Razor } from './Razor'

const DEMO = 'chart-notes'

/** The method: one slide shown as the argument it was built from, why beauty is the test, and the razor that runs on every slide. */
export function Rigour() {
  const s = STARTERS.find((x) => x.id === DEMO)?.consulting
  if (!s) throw new Error(`no starter ${DEMO}`)
  const reasons = (s.notes ?? []).map((n) => ({ title: plain(n.title ?? ''), text: plain(n.text ?? '') }))
  return (
    <section aria-labelledby="rigour" className="site-section">
      <Head id="rigour" center title={<>Your point, <Em>argued like a proof.</Em></>}
        lede="Each slide is built like a proof: a claim, the reasons that hold it, your numbers as the evidence. The claim becomes the title, the reasons the notes, the numbers the chart." />

      {/* One slide as its argument: the pyramid on the left becomes the slide on the right. */}
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-10 max-[1000px]:grid-cols-1">
        <figure className="grid gap-3" aria-label="The argument behind the slide">
          <figcaption className="font-mono text-[12px] text-type-3">01 · The argument</figcaption>
          <div className="site-card p-5">
            <p className="text-[12px] font-medium text-type-3">Claim</p>
            <p className="mt-1 text-[16px] font-semibold leading-[1.35]">{plain(s.title)}</p>
          </div>
          <ol className="grid grid-cols-3 gap-3 max-[520px]:grid-cols-1">
            {reasons.map((r, i) => (
              <li key={r.title} className="site-card grid content-start gap-1.5 p-4">
                <p className="text-[12px] font-medium text-type-3">Reason {i + 1}</p>
                <p className="text-[14px] font-semibold leading-[1.3]">{r.title}</p>
                <p className="text-[13px] leading-[1.45] text-type-2">{r.text}</p>
              </li>
            ))}
          </ol>
          <p className="text-[13px] text-type-3">Evidence: the chart, drawn from the numbers you gave.</p>
        </figure>
        <figure className="grid gap-3">
          <figcaption className="font-mono text-[12px] text-type-3">02 · The slide</figcaption>
          <LiveSlide id={DEMO} className="site-lift rounded-[14px]" />
        </figure>
      </div>

      {/* Why beauty is the test, then the razor that applies it. */}
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-16 border-t border-rule pt-16 max-[1000px]:grid-cols-1 max-[1000px]:gap-10">
        <div className="grid content-start gap-6">
          <p className="font-mono text-[12px] text-type-3">03 · The test</p>
          <blockquote className="font-display text-[clamp(34px,3.4vw,48px)] font-normal leading-[1] tracking-[-.02em] [font-stretch:78%] [text-wrap:balance]">
            If it isn’t beautiful, <Em>it’s probably wrong.</Em>
          </blockquote>
          <p className="max-w-[46ch] text-[16px] leading-[1.6] text-type-2">
            Physicists trust the simple equation. Consultants trust the clean slide. Both mean something exact by it:
            one point, few words, reasons that don’t overlap and leave nothing out.
          </p>
          <p className="max-w-[46ch] text-[16px] leading-[1.6] text-type-2">
            So when a slide looks cluttered, the thinking behind it usually is. Occam cuts until nothing is left to remove.
            Code checks what can be measured, a model judges the rest, and a slide that fails goes back to the agent, not to you.
          </p>
        </div>
        <Razor />
      </div>

      <figure className="site-card grid grid-cols-[minmax(0,1fr)_auto] items-end gap-10 p-12 max-[900px]:grid-cols-1 max-[700px]:p-6">
        <div className="grid gap-5">
          <blockquote className="max-w-[36ch] font-display text-[clamp(24px,2.3vw,32px)] font-normal leading-[1.15] tracking-[-.01em] [font-stretch:78%]">
            “I trained as a physicist, then spent years making consulting slides. Both taught me the same thing: an idea clicks when it
            is simple, and simple can be proved. So we wrote the proof down.”
          </blockquote>
          <figcaption className="text-[14px] text-type-2">Salim, founder of Occam</figcaption>
        </div>
        <Cta />
      </figure>
    </section>
  )
}
