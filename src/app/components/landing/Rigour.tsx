import { plain } from '@/engine/slides/schema'
import { STARTERS } from '@/engine/starters'
import { Cta } from './Cta'
import { LiveSlide } from './LiveSlide'

/* Three laws, one per layer of a slide: what you argue, how you say it, how it looks. Kept high level on purpose:
   enough to see the rigour, never the rules themselves. */
const LAWS: [string, string, string, string][] = [
  ['Logic', 'What you argue',
    'A claim, the reasons that hold it, the evidence under each. No reason overlaps, none is missing.',
    'So the argument holds when someone pushes on it.'],
  ['Writing', 'How you say it',
    'The answer first, in the title. One idea per slide. Every word earns its place.',
    'So the titles alone tell the story.'],
  ['Design', 'How it looks',
    'The eye goes to the title, then to the one thing highlighted. Every edge on the grid.',
    'So slide thirty looks like slide one.'],
]

/* What the check caught on the way to the slide shown, in plain words. Each maps to a check the engine runs
   (J1, R11, J2, J3, R6 in src/engine/agent/checks.ts). */
const CUT = [
  'Title names a topic, not the point.',
  '£85m you gave is missing.',
  'This reason doesn’t support the claim.',
  'Two reasons say the same thing.',
  'The takeaway repeats the title.',
]

const DEMO = 'chart-notes'

/** Why us: the laws of logic, writing and design, and one slide shown as the argument it was built from. */
export function Rigour() {
  const s = STARTERS.find((x) => x.id === DEMO)?.consulting
  if (!s) throw new Error(`no starter ${DEMO}`)
  const reasons = (s.notes ?? []).map((n) => ({ title: plain(n.title ?? ''), text: plain(n.text ?? '') }))
  return (
    <section aria-labelledby="rigour" className="site-section">
      <div className="site-head">
        <p className="text-[14px] font-medium text-type-2">Laws, not vibes.</p>
        <h2 id="rigour" className="site-h2">Your point, argued like a proof.</h2>
        <p className="site-lede">
          A convincing slide is an argument. People have studied how to build one since Aristotle.
          We wrote its laws down, and our agents follow them on every slide.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-x-8 max-[900px]:grid-cols-1">
        {LAWS.map(([law, layer, text, means]) => (
          <div key={law} className="grid content-start gap-3 border-t border-type py-7">
            <h3 className="flex items-baseline gap-3">
              <span className="font-display text-[clamp(32px,3vw,44px)] font-extrabold leading-none [font-stretch:78%]">{law}</span>
              <span className="text-[14px] text-type-3">{layer}</span>
            </h3>
            <p className="max-w-[40ch] text-[15px] leading-[1.55] text-type-2">{text}</p>
            <p className="max-w-[40ch] text-[15px] font-medium leading-[1.5] text-type">{means}</p>
          </div>
        ))}
      </div>
      {/* One slide as its argument: the pyramid on the left becomes the slide on the right. */}
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-10 max-[1000px]:grid-cols-1">
        <figure className="grid gap-4" aria-label="The argument behind the slide">
          <figcaption className="text-[13px] text-type-3">1 · The argument</figcaption>
          <div className="rounded-xl bg-white p-5 shadow-[0_0_0_1px_rgba(18,18,17,.08)]">
            <p className="text-[12px] font-medium uppercase tracking-[.06em] text-type-3">Claim</p>
            <p className="mt-1 text-[16px] font-semibold leading-[1.35]">{plain(s.title)}</p>
          </div>
          <ol className="grid grid-cols-3 gap-3 max-[520px]:grid-cols-1">
            {reasons.map((r, i) => (
              <li key={r.title} className="grid content-start gap-1.5 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgba(18,18,17,.08)]">
                <p className="text-[12px] font-medium uppercase tracking-[.06em] text-type-3">Reason {i + 1}</p>
                <p className="text-[14px] font-semibold leading-[1.3]">{r.title}</p>
                <p className="text-[13px] leading-[1.45] text-type-2">{r.text}</p>
              </li>
            ))}
          </ol>
          <p className="text-[13px] text-type-3">Evidence: the chart, from the numbers you gave.</p>
        </figure>
        <figure className="grid gap-4">
          <figcaption className="text-[13px] text-type-3">2 · The slide</figcaption>
          <LiveSlide id={DEMO} className="rounded-xl shadow-[0_24px_60px_-28px_rgba(18,18,17,.45)]" />
        </figure>
      </div>

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 max-[1000px]:grid-cols-1">
        <figure className="grid content-start gap-4">
          <figcaption className="text-[13px] text-type-3">3 · The cut</figcaption>
          <ul className="grid gap-2.5">
            {CUT.map((c) => (
              <li key={c} className="border-b border-rule pb-2.5 text-[15px] text-type-2 line-through decoration-type-3">{c}</li>
            ))}
          </ul>
          <p className="text-[15px] font-medium">Nothing left to remove. This runs on every slide.</p>
          <p className="text-[14px] leading-[1.5] text-type-2">
            What can be measured is checked by code. What needs judgment gets it. A slide that fails goes back to our agents, not to you.
          </p>
        </figure>
        <figure className="grid content-center gap-5 rounded-2xl bg-paper-2 p-10 max-[700px]:p-6">
          <blockquote className="font-display text-[clamp(24px,2.3vw,32px)] font-bold leading-[1.15] tracking-[-.01em] [font-stretch:78%]">
            “I trained as a physicist, then spent years making consulting slides. Both taught me the same thing: an idea clicks when it
            is simple, and simple can be proved. So we wrote the proof down.”
          </blockquote>
          <figcaption className="text-[14px] text-type-2">Salim, founder of Occam</figcaption>
          <Cta />
        </figure>
      </div>
    </section>
  )
}
