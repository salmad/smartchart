import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/app/lib/utils'
import { BeforeAfter } from './BeforeAfter'
import { Compare, Faq } from './Close'
import { startPrompt } from './Cta'
import { Insight } from './Insight'
import { Problems } from './Problems'
import { PromptBox } from './PromptBox'
import { Rigour } from './Rigour'
import { Answer, How, Who } from './Story'

interface Props { onSignIn: () => void }

/** The closing offer: what you get, what it replaces, what it costs. */
const VALUE: [string, string][] = [
  ['You get', 'Slides built on the laws of logic, writing and design, checked and ready to present.'],
  ['It replaces', 'An evening of nudging boxes, or waiting on a designer.'],
  ['It costs', 'Your first slide nothing. Then $10 for 30 slides, about 33 cents each.'],
]

/** The public site at /: who it is for and the promise, the problem, why the room scans, the rigour behind every slide,
    the gallery, how it works, who it is for, the comparison, objections, and the free first slide. */
export function Site({ onSignIn }: Props) {
  const page = useRef<HTMLDivElement>(null)
  const night = useNightUnderNav(page)
  return (
    <div ref={page} className="site h-full overflow-y-auto overflow-x-clip bg-paper text-type">
      {/* Solid, and the colour of the section under it: a translucent bar smears over the dark section. */}
      <nav className={cn('sticky top-0 z-20 transition-colors duration-300', night ? 'bg-stage text-[#F3EEE4]' : 'bg-paper')}>
        <div className="site-wrap flex h-16 items-center justify-between">
          <a href="/" className="font-display text-[22px] font-extrabold tracking-[-.01em] [font-stretch:78%]">Occam</a>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSignIn} className={cn('h-10 rounded-full px-4 text-[14px] transition-colors', night ? 'text-[#A39B8E] hover:text-[#F3EEE4]' : 'text-type-2 hover:text-type')}>Sign in</button>
            <button type="button" onClick={startPrompt} className={cn('h-10 rounded-full px-4 text-[14px] font-medium transition-colors duration-300', night ? 'bg-[#F3EEE4] text-stage' : 'bg-type text-paper')}>Start free</button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero: who it is for, the promise and the prompt on the left, the proof on the right, all above the fold. */}
        <section className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-14 px-10 pb-24 pt-8 max-[1100px]:flex max-[1100px]:flex-col max-[1100px]:items-stretch max-[1100px]:gap-8 max-[700px]:px-4 max-[700px]:pb-16 max-[700px]:pt-8">
          <div className="grid gap-5 max-[1100px]:contents">
            <p className="text-[14px] text-type-2">For founders, operators and anyone who has to make the case</p>
            <h1 className="font-display text-[clamp(40px,4vw,62px)] font-extrabold leading-[.96] tracking-[-.02em] [font-stretch:78%] [text-wrap:balance]">
              Nobody reads your docs.<br /> Make slides that land.
              <span className="mt-3 block text-[.62em] leading-none text-type-3">With taste. Without the slop.</span>
            </h1>
            <div className="grid gap-2">
              <p className="max-w-[50ch] text-[18px] leading-[1.5] text-type-2">
                We decoded the laws of clear thinking, writing and design, from Aristotle’s logic to the way top consulting firms write.
                Our agents build every slide on them and check it before you see it, in a minute. Even if you’ve never made a slide.
              </p>
              <p className="text-[14px] text-type-3">Built by physicists who take proof seriously.</p>
            </div>
            <div className="grid gap-3">
              <PromptBox id="hero-prompt" />
              <p className="text-[13px] text-type-3">Your first slide is free. No card, no account.</p>
            </div>
          </div>
          <BeforeAfter />
        </section>

        <Problems />
        <Insight />
        <Rigour />
        <Answer />
        <How />
        <Who />
        <Compare />
        <Faq />

        <section aria-labelledby="closing" className="site-section">
          <div className="mx-auto grid max-w-[760px] gap-8 text-center">
            <h2 id="closing" className="site-h2 mx-auto">Your first slide is free.</h2>
            <dl className="grid grid-cols-3 gap-6 border-y border-rule py-8 text-left max-[700px]:grid-cols-1">
              {VALUE.map(([k, v]) => (
                <div key={k} className="grid content-start gap-1.5">
                  <dt className="text-[13px] text-type-3">{k}</dt>
                  <dd className="text-[16px] font-medium leading-[1.4]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="site-lede mx-auto">Paste your doc and see it in a minute. If it isn’t better than what you’d make in an evening, you’ve lost a minute.</p>
            <div className="text-left"><PromptBox id="closing-prompt" /></div>
            <p className="text-[13px] text-type-3">No card, no account.</p>
          </div>
        </section>
      </main>

      <footer className="site-wrap flex items-center justify-between border-t border-rule py-8 text-[13px] text-type-3">
        <span className="font-display text-[17px] font-extrabold text-type-2 [font-stretch:78%]">Occam</span>
        <span>© 2026</span>
      </footer>
    </div>
  )
}

/** Whether a dark section ([data-night]) is under the sticky nav, as the page scrolls. */
function useNightUnderNav(page: RefObject<HTMLDivElement | null>) {
  const [night, setNight] = useState(false)
  useEffect(() => {
    const root = page.current
    if (!root) return
    const nav = 64
    // A thin band just under the nav's bottom edge: a section crossing it is the one behind the nav.
    const io = new IntersectionObserver((es) => es.forEach((e) => setNight(e.isIntersecting)),
      { root, rootMargin: `-${nav / 2}px 0px -${root.clientHeight - nav / 2 - 1}px 0px` })
    root.querySelectorAll('[data-night]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [page])
  return night
}
