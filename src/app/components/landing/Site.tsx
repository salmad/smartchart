import { useEffect, useRef, useState, type RefObject } from 'react'
import { cn } from '@/app/lib/utils'
import { BeforeAfter } from './BeforeAfter'
import { Problems } from './Problems'
import { PromptBox } from './PromptBox'
import { Answer, How, UseCases, Why } from './Story'

interface Props { onSignIn: () => void }

/** The public site at /: the problem you recognise, the answer, how it works, why it holds, and a prompt to try it. */
export function Site({ onSignIn }: Props) {
  const page = useRef<HTMLDivElement>(null)
  const night = useNightUnderNav(page)
  const start = () => {
    const box = document.getElementById('hero-prompt-text')
    box?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    box?.focus({ preventScroll: true })
  }
  return (
    <div ref={page} className="site h-full overflow-y-auto overflow-x-clip bg-paper text-type">
      {/* Solid, and the colour of the section under it: a translucent bar smears over the dark section. */}
      <nav className={cn('sticky top-0 z-20 transition-colors duration-300', night ? 'bg-stage text-[#F3EEE4]' : 'bg-paper')}>
        <div className="site-wrap flex h-16 items-center justify-between">
          <a href="/" className="font-display text-[22px] font-extrabold tracking-[-.01em] [font-stretch:78%]">SmartChart</a>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSignIn} className={cn('h-10 rounded-full px-4 text-[14px] transition-colors', night ? 'text-[#A39B8E] hover:text-[#F3EEE4]' : 'text-type-2 hover:text-type')}>Sign in</button>
            <button type="button" onClick={start} className={cn('h-10 rounded-full px-4 text-[14px] font-medium transition-colors duration-300', night ? 'bg-[#F3EEE4] text-stage' : 'bg-type text-paper')}>Make a slide</button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero: the promise and the prompt on the left, the proof on the right, both above the fold. */}
        <section className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-14 px-10 pb-24 pt-14 max-[1100px]:flex max-[1100px]:flex-col max-[1100px]:items-stretch max-[1100px]:gap-8 max-[700px]:px-4 max-[700px]:pb-16 max-[700px]:pt-8">
          <div className="grid gap-7 max-[1100px]:contents">
            <h1 className="font-display text-[clamp(46px,5.2vw,80px)] font-extrabold leading-[.94] tracking-[-.02em] [font-stretch:78%] [text-wrap:balance]">
              Board-ready slides from one sentence.
            </h1>
            <p className="max-w-[44ch] text-[18px] leading-[1.55] text-type-2">
              Paste your numbers and say the point. You get the slide a top consulting designer would make. No formatting.
            </p>
            <PromptBox id="hero-prompt" />
          </div>
          <BeforeAfter />
        </section>

        <Problems />
        <Answer />
        <How />
        <Why />
        <UseCases />

        <section aria-labelledby="closing" className="site-section">
          <div className="mx-auto grid max-w-[760px] gap-8 text-center">
            <h2 id="closing" className="site-h2 mx-auto">Your next slide takes a minute.</h2>
            <p className="site-lede mx-auto">No account for the first one.</p>
            <div className="text-left"><PromptBox id="closing-prompt" /></div>
          </div>
        </section>
      </main>

      <footer className="site-wrap flex items-center justify-between border-t border-rule py-8 text-[13px] text-type-3">
        <span className="font-display text-[17px] font-extrabold text-type-2 [font-stretch:78%]">SmartChart</span>
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
