import { useState } from 'react'
import { GROUPS } from '@/engine/starters'
import { cn } from '@/app/lib/utils'
import { Film } from './Film'
import { LiveSlide, MENU } from './LiveSlide'
import { Head } from './parts'

/** The answer, as an outcome: every slide in the gallery, designed once, so a deck never drifts.
    Grouped by the job a slide does; one group at a time, all of its slides in view. */
export function Answer() {
  const [group, setGroup] = useState(GROUPS[0].id)
  const slides = MENU.filter((m) => m.groupId === group)
  return (
    <section aria-labelledby="answer" className="site-night" data-night>
      <div className="site-section">
        <Head id="answer" title="Every slide you need."
          lede={`${MENU.length} slides in ${GROUPS.length} jobs. Each one designed once and reused, so slide thirty looks like slide one.`} />
        <div role="tablist" aria-label="What the slide does" className="flex flex-wrap gap-2">
          {GROUPS.map((g) => {
            const on = g.id === group
            return (
              <button key={g.id} type="button" role="tab" id={`gallery-tab-${g.id}`} aria-selected={on} aria-controls="gallery-panel" onClick={() => setGroup(g.id)}
                className={cn('rounded-full px-4 py-2 text-[15px] transition-colors', on ? 'bg-[#F3EEE4] text-[#15130F]' : 'bg-[#F3EEE4]/10 text-[#F3EEE4] hover:bg-[#F3EEE4]/20')}>
                {g.label}<span className={cn('ml-2 tabular-nums', on ? 'text-[#15130F]/60' : 'text-[#A39B8E]')}>{MENU.filter((m) => m.groupId === g.id).length}</span>
              </button>
            )
          })}
        </div>
        <ul id="gallery-panel" role="tabpanel" aria-labelledby={`gallery-tab-${group}`} className="grid grid-cols-3 gap-6 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
          {slides.map(({ id, name }) => (
            <li key={id} className="grid content-start gap-3">
              <LiveSlide id={id} className="rounded-[12px] shadow-[0_0_0_1px_rgba(243,238,228,.1)]" />
              <span className="text-[14px] font-medium text-[#F3EEE4]">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** The solution, revealed right after the problem: a line of words, then the product at work. */
export function How() {
  return (
    <section aria-labelledby="how" className="site-section">
      <Head id="how" center title={<>Ask in plain words.<br /> Get a checked slide.</>} />
      <div className="mx-auto w-full max-w-[1200px]"><Film /></div>
    </section>
  )
}
