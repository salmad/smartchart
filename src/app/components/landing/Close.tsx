import type { ReactNode } from 'react'
import { Cta } from './Cta'
import { Head } from './parts'

/** Against the alternative, in its own terms: what AI deck tools do, and what Occam does instead. No names. */
const ROWS: [string, string][] = [
  ['Add until it looks full', 'Cut until only the point is left'],
  ['The model improvises a layout', 'The model fills a layout designed once'],
  ['Checked by nobody', 'Checked by code, then by a model'],
  ['Decoration', 'Proportion'],
  ['Invents numbers to fill space', 'Every number traces to what you gave'],
]

export function Compare() {
  return (
    <section aria-labelledby="compare" className="site-section">
      <Head id="compare" center title={<>Other AI tools add.<br /> Occam cuts.</>}
        lede="Named after Occam’s razor: keep only what the point needs." />
      <div className="site-card mx-auto w-full max-w-[880px] overflow-hidden">
        <table className="w-full border-collapse text-left text-[16px] max-[700px]:text-[15px]">
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="w-1/2 px-8 py-5 text-[14px] font-medium text-type-3 max-[700px]:px-5">Other AI deck tools</th>
              <th scope="col" className="bg-paper-2/60 px-8 py-5 font-display text-[22px] font-extrabold [font-stretch:78%] max-[700px]:px-5">Occam</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([them, us]) => (
              <tr key={us} className="border-b border-rule last:border-0">
                <td className="px-8 py-4 text-type-3 max-[700px]:px-5">{them}</td>
                <td className="bg-paper-2/60 px-8 py-4 max-[700px]:px-5">{us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid justify-items-center"><Cta /></div>
    </section>
  )
}

/** Why not a chatbot: the differentiation, one paragraph per point, in plain prose. Each point is true of the engine today. */
const VERSUS = [
  'A chatbot improvises each slide and hopes. Occam follows laws, and checks every slide against them before you see it. A slide that fails goes back to the agent, not to you.',
  'A chatbot writes a new layout for every slide, so margins drift and text spills off the edge. Occam’s AI never draws: it fills layouts designed once, to one set of rules, so slide thirty looks like slide one.',
  'Every slide is argued like a proof: a claim in the title, reasons that don’t overlap, and your numbers as the evidence. It is the structure consultants are trained to write in.',
  '57 checks run on every slide. Code measures what can be measured: text that overflows, an edge a few pixels off, a figure given with false precision. A model judges the rest: a chart that doesn’t back the title, two reasons that say the same thing.',
  'Charts are drawn from the figures you give, not plausible ones, and code checks your headline number made it onto the slide.',
]
const Versus = <div className="grid gap-3">{VERSUS.map((p) => <p key={p}>{p}</p>)}</div>

/* Objections, answered before the close. Claims stay within what the product does today. */
const FAQ: [string, ReactNode][] = [
  ['I’ve never made a good slide. Will mine look like this?', 'Yes. You bring the content; the layout, the charts and the checks are built in. Every slide is made the same way, whoever writes it.'],
  ['Why not just ask ChatGPT or Gemini?', Versus],
  ['Consulting or pitch?', 'Pick per deck. Consulting puts the argument in a full-sentence title. Pitch leads with one bold claim and big numbers.'],
  ['I have a long doc. Will it work?', 'Paste it and say what the room should take away. You get the deck: the story in the titles, the evidence as charts and tables.'],
  ['Can I change it myself?', 'Ask in plain words: a sharper title, another chart, one more slide. Only what you asked changes, and every check still runs.'],
  ['Can I export to PowerPoint?', 'Soon. Today you present straight from the app, full screen.'],
  ['Is my data private?', 'Your decks are saved to your account, or only in your browser until you sign in. What you paste is sent to the AI models that write the slide, and to nobody else. We never sell it.'],
  ['What does it cost?', 'Your first slide is free. After that, $10 buys 100 credits, about 30 slides. That’s about 33 cents a slide, against an hour of your evening.'],
]

export function Faq() {
  return (
    <section aria-labelledby="faq" className="site-section">
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-16 max-[900px]:grid-cols-1 max-[900px]:gap-8">
        <Head id="faq" title="Questions, answered." />
        <div className="grid">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-rule py-5 first:border-t">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-semibold tracking-[-.01em] [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-[22px] font-normal leading-none text-type-3 transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-type-2">{typeof a === 'string' ? <p>{a}</p> : a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
