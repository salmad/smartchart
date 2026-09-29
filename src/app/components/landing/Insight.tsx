import { plain } from '@/engine/slides/schema'
import { STARTERS } from '@/engine/starters'

/* One deck, read by its titles only: the gallery's own consulting titles, in story order. */
const STORY = ['cards-framed', 'cards-icon', 'table-notes', 'chart-notes', 'chart-cagr', 'steps']

/** Split a title on its focus span, so the part the slide highlights reads darker here too. */
function parts(title: string): [string, boolean][] {
  return title.split(/\[\[(.+?)\]\]/).map((t, i): [string, boolean] => [plain(t), i % 2 === 1]).filter(([t]) => t)
}

/** Why slides beat docs: the room scans titles. Shown by reading a deck's titles alone. */
export function Insight() {
  const titles = STORY.map((id) => {
    const s = STARTERS.find((x) => x.id === id)
    if (!s) throw new Error(`no starter ${id}`)
    return { id, title: String(s.consulting.title) }
  })
  return (
    <section aria-labelledby="insight" className="site-section">
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-16 max-[900px]:grid-cols-1 max-[900px]:gap-10">
        <div className="site-head">
          <h2 id="insight" className="site-h2">The room doesn’t read. It scans.</h2>
          <p className="site-lede">
            Nobody reads a wall of text in a meeting. They read the titles, glance at the charts and decide.
            The best slides are built for that: the point first, one idea per slide. It looks like taste. It’s a set of laws.
          </p>
        </div>
        <figure className="grid gap-5 rounded-2xl bg-white p-8 shadow-[0_0_0_1px_rgba(18,18,17,.08)] max-[700px]:p-5">
          <figcaption className="text-[13px] text-type-3">Six slides of one deck. Read only the titles.</figcaption>
          <ol className="grid gap-4">
            {titles.map(({ id, title }, i) => (
              <li key={id} className="grid grid-cols-[28px_1fr] gap-x-3 border-t border-rule pt-4 first:border-0 first:pt-0">
                <span className="pt-0.5 text-[13px] tabular-nums text-type-3">{String(i + 1).padStart(2, '0')}</span>
                <p className="font-display text-[clamp(18px,1.7vw,22px)] font-bold leading-[1.2] [font-stretch:78%]">
                  {parts(title).map(([t, focus], k) => <span key={k} className={focus ? 'text-type' : 'text-type-2'}>{t}</span>)}
                </p>
              </li>
            ))}
          </ol>
          <p className="border-t border-rule pt-4 text-[15px] text-type-2">That’s the whole argument, before a single chart.</p>
        </figure>
      </div>
    </section>
  )
}
