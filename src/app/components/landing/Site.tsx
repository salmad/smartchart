import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/app/lib/utils'
import { BeforeAfter } from './BeforeAfter'
import { Compare, Faq } from './Close'
import { startPrompt } from './Cta'
import { Problems } from './Problems'
import { PromptBox } from './PromptBox'
import { Rigour } from './Rigour'
import { Answer, How, Who } from './Story'
import { Em, Head, LookSwitch, useLook } from './parts'

interface Props { onSignIn: () => void }

/** The closing offer: what you get, what it replaces, what it costs. */
const VALUE: [string, string][] = [
  ['You get', 'Slides with the point in every title, your numbers in the charts, checked before you see them.'],
  ['It replaces', 'An evening of nudging boxes, or a week waiting on a designer.'],
  ['It costs', 'Nothing for the first slide. Then $10 for about 30.'],
]

/** The public site at /, in the order of the sell: the promise, the problem and its cost, the solution, the method behind it,
    what it is for, the gallery, the comparison, objections, and the free first slide. Two looks, one page. */
export function Site({ onSignIn }: Props) {
  const page = useRef<HTMLDivElement>(null)
  const night = useNightUnderNav(page)
  const [look, setLook] = useLook()
  return (
    <div ref={page} data-look={look} className="site h-full overflow-y-auto overflow-x-clip bg-paper text-type transition-colors duration-300">
      {/* Solid, and the colour of the section under it: a translucent bar smears over the dark section. */}
      <nav className={cn('sticky top-0 z-20 transition-colors duration-300', night ? 'bg-night text-[#F3EEE4]' : 'bg-paper')}>
        <div className="site-wrap flex h-16 items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-[-.01em] [font-stretch:78%]">
            <Mark />Occam
          </a>
          <div className="flex items-center gap-2">
            <LookSwitch look={look} onChange={setLook} night={night} />
            <button type="button" onClick={onSignIn} className={cn('h-10 rounded-full px-4 text-[14px] transition-colors', night ? 'text-[#A39B8E] hover:text-[#F3EEE4]' : 'text-type-2 hover:text-type')}>Sign in</button>
            <button type="button" onClick={startPrompt} className={cn('h-10 rounded-full px-4 text-[14px] font-medium transition-colors duration-300', night ? 'bg-[#F3EEE4] text-stage' : 'bg-type text-paper')}>Start free</button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero: who it is for, the promise and the prompt on the left, the proof on the right, all above the fold. */}
        <div className="site-glow">
          <section className="site-wrap grid grid-cols-2 items-center gap-14 pb-28 pt-14 max-[1100px]:flex max-[1100px]:flex-col max-[1100px]:items-stretch max-[1100px]:gap-10 max-[700px]:pb-16 max-[700px]:pt-8">
            <div className="grid justify-items-start gap-6 max-[1100px]:contents">
              <p className="site-kicker">Nobody reads your docs</p>
              <h1 className="font-display text-[clamp(44px,4.6vw,60px)] font-extrabold leading-[.94] tracking-[-.025em] [font-stretch:78%] [text-wrap:balance]">
                Slides,<br /> <Em>scientifically precise.</Em>
              </h1>
              <p className="text-[19px] leading-[1.5] text-type-2">Built on the laws of clear writing. Every slide passes 57 checks for design, meaning and logic.</p>
              <div className="grid w-full gap-3">
                <PromptBox id="hero-prompt" />
                <p className="text-[13px] text-type-3">Your first slide is free. No card, no account.</p>
              </div>
            </div>
            <BeforeAfter />
          </section>
        </div>

        <Problems />
        <How />
        <Rigour />
        <Who />
        <Answer />
        <Compare />
        <Faq />

        <section aria-labelledby="closing" className="site-section">
          <div className="site-card mx-auto grid w-full max-w-[880px] gap-8 p-14 text-center max-[700px]:p-6">
            <Head id="closing" kicker="Start" center title={<>Your first slide <Em>is free.</Em></>}
              lede="Paste your doc and see it in a minute. If it isn’t better than what you’d make in an evening, you’ve lost a minute." />
            <dl className="grid grid-cols-3 gap-6 border-y border-rule py-8 text-left max-[700px]:grid-cols-1">
              {VALUE.map(([k, v]) => (
                <div key={k} className="grid content-start gap-1.5">
                  <dt className="text-[13px] text-type-3">{k}</dt>
                  <dd className="text-[16px] font-medium leading-[1.4]">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="text-left"><PromptBox id="closing-prompt" /></div>
            <p className="text-[13px] text-type-3">No card, no account.</p>
          </div>
        </section>
      </main>

      <footer className="site-wrap flex items-center justify-between border-t border-rule py-8 text-[13px] text-type-3">
        <span className="flex items-center gap-2 font-display text-[17px] font-extrabold text-type-2 [font-stretch:78%]"><Mark />Occam</span>
        <span>If it isn’t beautiful, it’s probably wrong.</span>
        <span className="max-[700px]:hidden">© 2026</span>
      </footer>
    </div>
  )
}

/** The cut O from the brand board: a circle with one straight cut, the razor passed once. */
function Mark() {
  return (
    <svg viewBox="0 0 64 64" className="size-6" aria-hidden>
      <defs><clipPath id="occam-cut"><path d="M0 64V0h18L64 46v18z" /></clipPath></defs>
      <rect x="1" y="1" width="62" height="62" rx="14" className="fill-stage stroke-rule" strokeWidth="2" />
      <circle cx="32" cy="32" r="19" className="fill-[#E8B94A]" clipPath="url(#occam-cut)" />
    </svg>
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
    // Before layout the root can be 0 px tall; a negative bottom inset would then read "--33px" and throw.
    const below = Math.max(0, root.clientHeight - nav / 2 - 1)
    const io = new IntersectionObserver((es) => es.forEach((e) => setNight(e.isIntersecting)),
      { root, rootMargin: `-${nav / 2}px 0px -${below}px 0px` })
    root.querySelectorAll('[data-night]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [page])
  return night
}
