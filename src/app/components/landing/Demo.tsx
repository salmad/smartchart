import { useEffect, useRef, useState } from 'react'
import { cn } from '@/app/lib/utils'
import { LiveSlide } from './LiveSlide'

/* The solution, shown as the editor itself, in miniature: the request typed and sent, one question back, the slide built
   with the app's own loading states (skeleton, phase pill, reveal), a line saying what is being checked, then a change asked for and made.
   Phases are the app's own words (src/app/phase.ts); the check lines name checks it runs (src/engine/agent/checks.ts). The slide is the
   waterfall-notes starter, first drawn without its notes. */

type Chat = { who: 'you' | 'occam'; text: string }
interface Beat {
  ms: number
  /** Text being typed into the composer. */
  typing?: string
  /** A message that arrives with this beat. */
  say?: Chat
  /** The stage: empty, the skeleton, the draft (no notes) or the final slide. */
  slide?: 'empty' | 'skeleton' | 'draft' | 'final'
  /** The status line while a turn runs; null clears it. */
  phase?: string | null
  /** The check running (an index into CHECKS), all passed, or none yet. The slide waits until all pass. */
  check?: number | 'passed' | null
}

const ASK = 'Year 4: £42m revenue, £16m gross margin. Show where the money goes.'
const REPLY = 'Bad debt. It’s the cost to fix.'
const CHANGE = 'Add the reasons on the right.'

// Each beat holds for `ms`; state carries forward until a later beat changes it. The last beat returns to the first.
// The slide waits under the skeleton, or dimmed, while each check runs; it is shown only once all three pass.
// The app says only "Checking the slide"; which check is running is shown once, in the panel beside it.
const BEATS: Beat[] = [
  { ms: 1100, slide: 'empty', phase: null, check: null, say: { who: 'occam', text: 'What’s the slide about? Paste notes, numbers or a whole doc.' } },
  { ms: 1900, typing: ASK },
  { ms: 1100, say: { who: 'you', text: ASK }, phase: 'Reading what you asked' },
  { ms: 1500, say: { who: 'occam', text: 'What should I highlight?' }, phase: null },
  { ms: 1300, typing: REPLY },
  { ms: 1100, say: { who: 'you', text: REPLY }, slide: 'skeleton', phase: 'Choosing how to show it' },
  { ms: 1100, phase: 'Writing the slide' },
  { ms: 1600, phase: 'Checking the slide', check: 0 },
  { ms: 1600, phase: 'Checking the slide', check: 1 },
  { ms: 1600, phase: 'Checking the slide', check: 2 },
  { ms: 1500, slide: 'draft', phase: null, check: 'passed', say: { who: 'occam', text: 'Here’s the bridge. Bad debt is the biggest cost, so it carries the colour.' } },
  { ms: 1500, check: null },
  { ms: 1300, typing: CHANGE },
  { ms: 1000, say: { who: 'you', text: CHANGE }, phase: 'Writing the reasons' },
  { ms: 1100, phase: 'Checking the slide', check: 0 },
  { ms: 1100, phase: 'Checking the slide', check: 1 },
  { ms: 1100, phase: 'Checking the slide', check: 2 },
  { ms: 1600, slide: 'final', phase: null, check: 'passed', say: { who: 'occam', text: 'Added three reasons. The rest is unchanged.' } },
  { ms: 3000, check: null },
]

/** The three passes every slide goes through before you see it, explained beside the app. */
export const CHECKS: [name: string, what: string][] = [
  ['Semantic checks', 'The point in the title. Your numbers.'],
  ['Logic review', 'Evidence backs it. No overlap, no gap.'],
  ['Design review', 'Fits. Every edge on the grid.'],
]

/** Everything on screen at beat `at`: the last value each field was set to, and every message so far. */
function stateAt(at: number) {
  const s = { slide: 'empty' as NonNullable<Beat['slide']>, phase: null as string | null, check: null as Beat['check'], chat: [] as Chat[], typing: '' }
  BEATS.slice(0, at + 1).forEach((b, i) => {
    if (b.slide) s.slide = b.slide
    if (b.phase !== undefined) s.phase = b.phase
    if (b.check !== undefined) s.check = b.check
    if (b.say) s.chat.push(b.say)
    s.typing = i === at ? b.typing ?? '' : ''
  })
  return s
}

/** The editor in miniature, looping while on screen. Reduced motion shows the finished exchange. */
export function Demo() {
  const box = useRef<HTMLDivElement>(null)
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [at, setAt] = useState(still ? BEATS.length - 1 : 0), [seen, setSeen] = useState(false), [chars, setChars] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el || still) return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [still])

  useEffect(() => {
    if (!seen || still) return
    const beat = BEATS[at]
    setChars(0)
    // Typing: one character at a time, done a little before the beat ends so the whole line is read.
    const tick = beat.typing ? setInterval(() => setChars((c) => c + 1), (beat.ms * 0.8) / beat.typing.length) : undefined
    const next = setTimeout(() => setAt((a) => (a + 1) % BEATS.length), beat.ms)
    return () => { clearTimeout(next); clearInterval(tick) }
  }, [seen, at, still])

  const s = stateAt(at)
  const typed = s.typing.slice(0, chars)
  const shown = s.slide === 'draft' || s.slide === 'final'
  return (
    // The camera: the window starts centred; when the checks begin it glides left as their panel slides in beside it,
    // and glides back once they pass. The column animates, so the window never jumps. Stacked under 1000 px.
    <div ref={box} className={cn('grid items-center transition-[grid-template-columns] duration-700 ease-[cubic-bezier(.2,.7,.2,1)] max-[1000px]:!grid-cols-1',
      s.check !== null ? 'grid-cols-[minmax(0,1fr)_324px]' : 'grid-cols-[minmax(0,1fr)_0px]')}>
    <figure aria-label="Occam at work: a request, a question back, the slide checked before it is shown, then the reasons added on request"
      className="site-lift mx-auto w-full max-w-[860px] overflow-hidden rounded-[20px] bg-card">
      {/* The editor's bar: the deck's name, and Present once there is a slide. */}
      <div className="flex h-11 items-center gap-3 border-b border-rule px-4">
        <span aria-hidden className="flex gap-1.5">{[0, 1, 2].map((i) => <i key={i} className="size-2.5 rounded-full bg-rule" />)}</span>
        <p className="ml-2 flex min-w-0 gap-2 text-[12px]"><b className="font-semibold">Occam</b><span className="text-type-3">/</span><span className="truncate text-type-2">Board pack</span></p>
        <span className={cn('ml-auto rounded-full bg-type px-3 py-1 text-[11px] font-medium text-paper transition-opacity duration-500', shown ? 'opacity-100' : 'opacity-0')}>Present</span>
      </div>

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,11fr)] max-[760px]:grid-cols-1">
        {/* Chat: newest at the bottom, older lines fade out at the top; the composer types the next request. */}
        <div className="flex flex-col border-r border-rule max-[760px]:order-2 max-[760px]:border-r-0 max-[760px]:border-t">
          <div className="relative min-h-0 flex-1 max-[760px]:h-[190px] max-[760px]:flex-none">
            <ol aria-live="polite" className="absolute inset-0 flex flex-col justify-end gap-3 overflow-hidden p-4 text-[12.5px] leading-[1.45] [mask-image:linear-gradient(to_bottom,transparent,black_28%)]">
              {s.chat.map((m, i) => (
                <li key={i} className={cn('motion-safe:animate-pop', m.who === 'you' ? 'max-w-[90%] self-end rounded-[12px_12px_4px_12px] border border-rule bg-paper-2 px-3 py-2' : 'text-type')}>{m.text}</li>
              ))}
              {s.phase && <li className="flex items-center gap-2 text-[12px] text-type-3 motion-safe:animate-pop"><Spinner />{s.phase}</li>}
            </ol>
          </div>
          <div className="grid gap-2 border-t border-rule p-3">
            <p className={cn('min-h-[52px] rounded-[10px] border px-2.5 py-2 text-[12.5px] leading-[1.45] transition-colors', typed ? 'border-type-3 text-type' : 'border-rule text-type-3')}>
              {typed || 'Describe a slide, or ask for a change…'}{typed && <i aria-hidden className="ml-px inline-block h-[1.1em] w-px translate-y-[2px] animate-pulse bg-type" />}
            </p>
            <span className={cn('justify-self-end rounded-full px-3 py-1 text-[11px] font-medium transition-colors', typed ? 'bg-type text-paper' : 'bg-paper-2 text-type-3')}>Send</span>
          </div>
        </div>

        {/* The stage and the checks under it, as in the editor. */}
        <div className="grid content-start gap-4 bg-paper-2/50 p-5 max-[760px]:order-1 max-[760px]:p-3">
          <div className="relative aspect-video overflow-hidden rounded-[10px] bg-stage shadow-[0_0_0_1px_rgb(var(--site-rule)),0_18px_40px_-20px_rgb(0_0_0/.6)]">
            {s.slide === 'empty' && (
              <div className="absolute inset-0 grid place-content-center gap-1 bg-card text-center">
                <p className="text-[14px] font-medium">Your slide appears here.</p>
                <span className="text-[12px] text-type-3">Describe it in the chat.</span>
              </div>
            )}
            {s.slide === 'skeleton' && <Skeleton />}
            {shown && <LiveSlide key={s.slide} id="waterfall-notes" withoutNotes={s.slide === 'draft'} className="absolute inset-0 motion-safe:animate-reveal" />}
            {/* While a change is made, the slide dims under the status pill, as in the editor. */}
            <div aria-hidden className={cn('pointer-events-none absolute inset-0 bg-stage/45 transition-opacity duration-300', s.phase && shown ? 'opacity-100' : 'opacity-0')} />
            {s.phase && s.slide !== 'empty' && (
              <p role="status" className="absolute bottom-[6%] left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#18181B]/90 px-3 py-1.5 text-[11px] text-[#EDEDEF] shadow-[0_0_0_1px_rgba(255,255,255,.14),0_12px_32px_rgba(0,0,0,.5)] backdrop-blur motion-safe:animate-pop">
                <Spinner light />{s.phase}
              </p>
            )}
          </div>
        </div>
      </div>
    </figure>
    <CheckCards check={s.check} />
    </div>
  )
}

/** The checks, beside the window: the panel slides in with the first check, adds a row as each starts, ticks each as
    it passes, then slides out so the slide is seen on its own. Under 1000 px it sits under the window. */
function CheckCards({ check }: { check: Beat['check'] }) {
  const on = check !== null
  return (
    <div className="min-w-0 overflow-hidden max-[1000px]:overflow-visible">
      <div aria-hidden={!on} className={cn('ml-6 w-[300px] rounded-[18px] bg-card p-2 transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]',
        'shadow-[0_0_0_1px_rgb(var(--site-rule)),0_30px_60px_-24px_rgb(0_0_0/.5)] max-[1000px]:mx-auto max-[1000px]:mt-5 max-[1000px]:w-full max-[1000px]:max-w-[860px]',
        on ? 'translate-x-0 opacity-100 delay-150' : 'pointer-events-none translate-x-10 opacity-0 max-[1000px]:translate-x-0')}>
        <p className="px-3 pb-1 pt-2 font-mono text-[11px] uppercase tracking-[.08em] text-type-3">Before you see it</p>
        <ol className="max-[1000px]:grid max-[1000px]:grid-cols-3 max-[600px]:grid-cols-1">
          {CHECKS.map(([name, what], i) => {
            const running = check === i, done = check === 'passed' || (typeof check === 'number' && check > i)
            return (
              <li key={name} className={cn('flex items-start gap-3 rounded-[12px] px-3 py-3 transition-[background-color,opacity] duration-300',
                running && 'bg-paper-2', !running && !done && 'opacity-35')}>
                <span className="mt-px flex size-[22px] flex-none items-center justify-center">
                  {running ? <Spinner big /> : done ? <Passed /> : <i className="size-[18px] rounded-full border-[1.5px] border-type-3/50" />}
                </span>
                <span className="min-w-0">
                  <b className="block text-[14px] font-semibold leading-[22px] tracking-[-.01em]">{name}</b>
                  <span className="block text-[12.5px] leading-[1.4] text-type-2">{what}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/** A passed check: a filled focus-colour disc with a dark tick, readable at a glance in both looks.
    strokeDasharray is reset: slides.css dashes every SVG stroke under a .grid (its chart gridlines). */
function Passed() {
  return (
    <svg viewBox="0 0 20 20" className="size-[22px] motion-safe:animate-pop" aria-label="passed">
      <circle cx="10" cy="10" r="10" className="fill-focus" />
      <path d="m5.6 10.4 3 3 5.8-6.4" fill="none" strokeDasharray="none" className="stroke-paper" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Spinner({ light = false, big = false }: { light?: boolean; big?: boolean }) {
  return <i aria-hidden className={cn('inline-block size-3 flex-none animate-spin rounded-full border-[1.5px] [animation-duration:.8s]',
    light ? 'border-white/25 border-t-white' : 'border-rule border-t-type', big && 'size-[18px] border-2 border-t-focus')} />
}

const BARS = ['h-[38%]', 'h-[30%]', 'h-[22%]', 'h-[48%]', 'h-[34%]']

/** The shape of a slide while it is written, as in the editor: kicker, a two-line title, a body, a takeaway. */
function Skeleton() {
  const bar = 'rounded-full bg-white/[.16] motion-safe:animate-pulse'
  return (
    <div aria-hidden className="absolute inset-0 [container-type:inline-size]">
      <div className="grid h-full grid-rows-[auto_auto_1fr_auto] gap-[2cqw] p-[6.5cqw]">
        <i className={cn(bar, 'h-[.8cqw] w-[12%]')} />
        <div className="grid gap-[.7cqw]">
          <i className={cn(bar, 'h-[2.5cqw] w-[72%]')} />
          <i className={cn(bar, 'h-[2.5cqw] w-[48%]')} />
        </div>
        <div className="flex items-end gap-[3%] pb-[2%]">
          {BARS.map((h, i) => <i key={i} className={cn('flex-1 rounded-t-md bg-white/[.1] motion-safe:animate-pulse', h)} />)}
        </div>
        <i className={cn(bar, 'h-[1.35cqw] w-[40%]')} />
      </div>
    </div>
  )
}
