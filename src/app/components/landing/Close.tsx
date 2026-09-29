import { Cta } from './Cta'

/** Against the alternative, in its own terms: what AI deck tools do, and what Occam does instead. No names. */
const ROWS: [string, string][] = [
  ['Add until it looks full', 'Cut until only the point is left'],
  ['The model improvises a layout', 'The model fills a layout designed once'],
  ['Checked by nobody', 'Checked by laws, then by judgment'],
  ['Decoration', 'Proportion'],
  ['Invents numbers to fill space', 'Every number traces to what you gave'],
]

export function Compare() {
  return (
    <section aria-labelledby="compare" className="site-section">
      <div className="site-head">
        <h2 id="compare" className="site-h2">Others make it pretty. We make it right.</h2>
      </div>
      <table className="w-full border-collapse text-left text-[16px] max-[700px]:text-[15px]">
        <thead>
          <tr className="border-b border-type">
            <th scope="col" className="w-1/2 py-4 pr-6 text-[14px] font-medium text-type-3">AI deck tools</th>
            <th scope="col" className="py-4 font-display text-[22px] font-extrabold [font-stretch:78%]">Occam</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([them, us]) => (
            <tr key={us} className="border-b border-rule">
              <td className="py-4 pr-6 text-type-3">{them}</td>
              <td className="py-4 font-medium">{us}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[15px] text-type-2">Occam, after the razor: nothing left to remove.</p>
      <Cta />
    </section>
  )
}

/* Objections, answered before the close. Claims stay within what the product does today. */
const FAQ: [string, string][] = [
  ['I’ve never made a good slide. Will mine look like this?', 'Yes. The laws do the design; you bring the content. Every slide is built and checked the same way, whoever writes it, so it looks like a top firm made it, not a model.'],
  ['Why not just ask ChatGPT or Gemini?', 'They write slides from scratch every time, and nothing checks them. Ours are built on layouts designed once and checked before you see them.'],
  ['I have a long doc. Will it work?', 'Paste it and say what the room should take away. You get the deck: the story in the titles, the evidence as charts and tables.'],
  ['Can I change it myself?', 'Ask in plain words: a sharper title, another chart, one more slide. Only what you asked changes, and the laws still hold.'],
  ['Can I export to PowerPoint?', 'Soon. Today you present straight from the app, full screen.'],
  ['Is my data private?', 'Your decks are saved to your account, or only in your browser until you sign in. What you paste is sent to the AI models that write the slide, and to nobody else. We never sell it.'],
  ['What does it cost?', 'Your first slide is free, no account needed. After that, $10 buys 100 credits, about 30 slides. That’s about 33 cents a slide, against an hour of your evening.'],
]

export function Faq() {
  return (
    <section aria-labelledby="faq" className="site-section">
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-16 max-[900px]:grid-cols-1 max-[900px]:gap-8">
        <h2 id="faq" className="site-h2">Questions, answered.</h2>
        <div className="grid">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-rule py-5 first:border-t">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] font-semibold tracking-[-.01em] [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-[22px] font-normal leading-none text-type-3 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-type-2">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
