/* The razor: what gets cut before a slide reaches you, by layer (what you argue, how you say it, how it looks).
   Only checks the engine runs today, named in plain words. Code = src/engine/agent/checks.ts R-rules and the fit and
   layout lints; model = the J judgment checks. */
const LAYERS: { layer: string; rows: [cut: string, why: string, by: 'code' | 'model' | 'code + model'][] }[] = [
  { layer: 'Logic', rows: [
    ['Two reasons that say the same thing', 'The reasons overlap, or leave a gap', 'model'],
    ['A chart that doesn’t back the title', 'Evidence for a different point', 'model'],
    ['£85m you gave, left off the slide', 'Your headline number is missing', 'code'],
  ] },
  { layer: 'Writing', rows: [
    ['“Revenue overview”', 'A topic, not the point', 'code + model'],
    ['A takeaway that repeats the title', 'Adds length, not meaning', 'code'],
    ['12.47% next to 31%', 'Precision nobody asked for', 'code'],
  ] },
  { layer: 'Design', rows: [
    ['A highlight the title doesn’t name', 'Emphasis on nothing', 'code + model'],
    ['Text past the edge of its box', 'The slide breaks', 'code'],
    ['An edge a few pixels off', 'The eye notices, even if you don’t', 'code'],
  ] },
]

/** The cut list as a table: struck-through faults, why each goes, and what checks it. */
export function Razor() {
  return (
    <figure className="site-card overflow-hidden">
      <div className="grid grid-cols-[96px_1fr_1fr_104px] gap-6 border-b border-rule px-8 py-4 text-[12px] text-type-3 max-[800px]:hidden">
        <span>Layer</span><span>Cut</span><span>Why it goes</span><span>Checked by</span>
      </div>
      {LAYERS.map(({ layer, rows }) => (
        <div key={layer} className="grid grid-cols-[96px_1fr] gap-6 border-b border-rule pl-8 last:border-0 max-[800px]:grid-cols-1 max-[800px]:gap-0 max-[800px]:pl-0">
          <p className="pt-[18px] font-display text-[22px] font-extrabold leading-none [font-stretch:78%] max-[800px]:px-5 max-[800px]:pb-1">{layer}</p>
          <ul>
            {rows.map(([cut, why, by]) => (
              <li key={cut} className="grid grid-cols-[1fr_1fr_104px] gap-6 py-4 pr-8 text-[15px] [&:not(:first-child)]:border-t [&:not(:first-child)]:border-rule max-[800px]:grid-cols-1 max-[800px]:gap-1 max-[800px]:px-5">
                <s className="text-type decoration-focus decoration-[1.5px]">{cut}</s>
                <span className="text-type-2">{why}</span>
                <span className="font-mono text-[12px] leading-[22px] text-type-3">{by}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </figure>
  )
}
