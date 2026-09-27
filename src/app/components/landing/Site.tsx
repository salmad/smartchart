import { BeforeAfter } from './BeforeAfter'
import { Problems } from './Problems'
import { PromptBox } from './PromptBox'
import { Answer, How, Taste, UseCases } from './Story'

interface Props { onSignIn: () => void }

/** The public site at /: the problem you recognise, the answer, how it works, and a prompt to try it. */
export function Site({ onSignIn }: Props) {
  const start = () => {
    const box = document.getElementById('hero-prompt-text')
    box?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    box?.focus({ preventScroll: true })
  }
  return (
    <div className="site h-full overflow-y-auto overflow-x-clip bg-paper text-type">
      <nav className="sticky top-0 z-20 border-b border-transparent bg-paper/80 backdrop-blur-xl supports-[backdrop-filter]:bg-paper/70">
        <div className="site-wrap flex h-16 items-center justify-between">
          <a href="/" className="font-display text-[22px] font-extrabold tracking-[-.01em] [font-stretch:78%]">SmartChart</a>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSignIn} className="h-10 rounded-full px-4 text-[14px] text-type-2 transition-colors hover:text-type">Sign in</button>
            <button type="button" onClick={start} className="h-10 rounded-full bg-type px-4 text-[14px] font-medium text-paper">Make a slide</button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero: the promise and the prompt on the left, the proof on the right, both above the fold. */}
        <section className="mx-auto grid w-full max-w-[1440px] grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-14 px-10 pb-28 pt-14 max-[1100px]:flex max-[1100px]:flex-col max-[1100px]:items-stretch max-[1100px]:gap-8 max-[700px]:px-4 max-[700px]:pb-16 max-[700px]:pt-8">
          <div className="grid gap-7 max-[1100px]:contents">
            <h1 className="font-display text-[clamp(46px,5.2vw,80px)] font-extrabold leading-[.94] tracking-[-.02em] [font-stretch:78%] [text-wrap:balance]">
              Charts that look designed, because they were.
            </h1>
            <p className="max-w-[44ch] text-[18px] leading-[1.55] text-type-2">
              Describe the slide you need. SmartChart builds it from components a designer made once,
              so every chart, table and title comes out right the first time.
            </p>
            <div className="max-[1100px]:order-last"><PromptBox id="hero-prompt" /></div>
          </div>
          <BeforeAfter />
        </section>

        <Problems />
        <Answer />
        <How />
        <Taste />
        <UseCases />

        <section aria-labelledby="closing" className="site-section">
          <div className="mx-auto grid max-w-[760px] gap-8 text-center">
            <h2 id="closing" className="site-h2 mx-auto">Start with a sentence.</h2>
            <p className="site-lede mx-auto">Your first slide needs no account. Keep it with your email.</p>
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
