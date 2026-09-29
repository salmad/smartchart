import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/app/lib/utils'
import { BeforeAfter } from './BeforeAfter'
import { Compare, Faq } from './Close'
import { SignedIn, startPrompt } from './Cta'
import { Problems } from './Problems'
import { PromptBox } from './PromptBox'
import { Rigour } from './Rigour'
import { Answer, How, Who } from './Story'
import { Em, Head, LookSwitch, useLook } from './parts'

/** Signed in, the header offers Open app (`onSignIn` then goes to the editor) in place of Sign in and Start free. */
interface Props { onSignIn: () => void; signedIn?: boolean }

/** The public site at /, in the order of the sell: the promise, the problem and its cost, the solution, the method behind it,
    what it is for, the gallery, the comparison, objections, and the free first slide. Two looks, one page. */
export function Site({ onSignIn, signedIn = false }: Props) {
  const page = useRef<HTMLDivElement>(null)
  const night = useNightUnderNav(page)
  const [look, setLook] = useLook()
  return (
    <div ref={page} data-look={look} className="site h-full overflow-y-auto overflow-x-clip bg-paper text-type transition-colors duration-300">
      {/* Solid, and the colour of the section under it: a translucent bar smears over the dark section. */}
      <nav className={cn('sticky top-0 z-20 transition-colors duration-300', night ? 'bg-night text-[#F3EEE4]' : 'bg-paper')}>
        <div className="site-wrap flex h-16 items-center justify-between gap-4">
          <a href={signedIn ? '/home' : '/'} className="flex items-center gap-2.5 font-display text-[22px] font-extrabold tracking-[-.01em] [font-stretch:78%]">
            <Mark />Occam
          </a>
          <div className="flex items-center gap-2">
            <LookSwitch look={look} onChange={setLook} night={night} />
            {!signedIn && <button type="button" onClick={onSignIn} className={cn('h-10 rounded-full px-4 text-[14px] transition-colors', night ? 'text-[#A39B8E] hover:text-[#F3EEE4]' : 'text-type-2 hover:text-type')}>Sign in</button>}
            <button type="button" onClick={signedIn ? onSignIn : startPrompt} className={cn('h-10 rounded-full px-4 text-[14px] font-medium transition-colors duration-300', night ? 'bg-[#F3EEE4] text-stage' : 'bg-type text-paper')}>
              {signedIn ? 'Open app' : 'Start free'}
            </button>
          </div>
        </div>
      </nav>

      <main>
        <SignedIn.Provider value={signedIn}>
          {/* Hero: one column, one idea. The promise and the prompt above the fold; the proof, large, rising in under them. */}
          <div className="site-glow">
            {/* Centred by its text blocks only: text-center on the section would reach into the slide below. */}
            <section className="site-wrap grid justify-items-center gap-6 pb-20 pt-20 max-[900px]:pb-12 max-[700px]:pt-10">
              <h1 className="text-center font-display text-[clamp(44px,5.4vw,76px)] font-normal leading-[.94] tracking-[-.025em] [font-stretch:78%] [text-wrap:balance]">
                Slides,<br /> <Em>scientifically precise.</Em>
              </h1>
              <p className="max-w-[680px] text-center text-[19px] leading-[1.5] text-type-2 [text-wrap:balance]">Laws, not vibes: every slide passes 57 checks for design, meaning and logic.</p>
              <div className="mt-4 w-full max-w-[640px]"><PromptBox id="hero-prompt" /></div>
              <div className="mt-14 w-full max-w-[1120px] max-[700px]:mt-8"><BeforeAfter /></div>
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
            {/* The close: the offer and the prompt, nothing else. */}
            <div className="mx-auto grid w-full max-w-[640px] gap-10">
              <Head id="closing" center title={<>Your first slide <Em>is free.</Em></>} />
              <PromptBox id="closing-prompt" />
            </div>
          </section>
        </SignedIn.Provider>
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
