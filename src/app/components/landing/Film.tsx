import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/app/lib/utils'
import { LiveSlide } from './LiveSlide'
import { Celebrate, CheckOverlay, Doc, Prompt } from './FilmParts'

/* The landing film: one continuous camera, cut like a launch film rather than a screen recording, with one narrator line
   at the top saying what is happening; nothing else on screen is text but the doc, the request and the slide.
   The doc nobody reads → one line asking for a slide, sent as a message while Occam works → the slide → three
   checks, each outlining what it looks at → a change in plain words, laid out in place → the razor. The slide is the waterfall-notes starter, drawn live.
   Every size is in cqw (the frame's width), so the film scales as one picture. Gold is the only colour that moves. */

type Slide = 'none' | 'draft' | 'final'
/** `line` is the narrator's line (NARRATOR). `say` is the request on screen: typed while `typing`, then sent. `marks` is
    how many passes of the doc's highlights have landed; `scan` runs the reading line; `work` is Occam building. */
interface Step {
  ms: number; beat: number; line: number; intro?: boolean; say?: 'ask' | 'change'; typing?: boolean; scan?: boolean; marks?: number
  work?: boolean; slide?: Slide; celebrate?: boolean; check?: number; fade?: boolean
}
const STEPS: Step[] = [
  { ms: 2200, beat: 0, line: 0, intro: true },
  { ms: 1800, beat: 0, line: 0 },
  { ms: 3200, beat: 1, line: 1, say: 'ask', typing: true },
  { ms: 1200, beat: 1, line: 2, say: 'ask', scan: true },
  { ms: 1100, beat: 1, line: 2, say: 'ask', scan: true, marks: 1 },
  { ms: 1100, beat: 1, line: 2, say: 'ask', scan: true, marks: 2 },
  { ms: 1400, beat: 1, line: 2, say: 'ask', marks: 3 },
  { ms: 2400, beat: 1, line: 3, say: 'ask', marks: 3, work: true },
  { ms: 3400, beat: 1, line: 3, say: 'ask', slide: 'draft', celebrate: true },
  { ms: 3200, beat: 2, line: 4, slide: 'draft', check: 0 },
  { ms: 3200, beat: 2, line: 4, slide: 'draft', check: 1 },
  { ms: 3400, beat: 2, line: 4, slide: 'draft', check: 2 },
  { ms: 2800, beat: 3, line: 5, slide: 'draft', say: 'change', typing: true },
  { ms: 1600, beat: 3, line: 5, slide: 'draft', say: 'change' },
  { ms: 3200, beat: 3, line: 5, slide: 'final', say: 'change', celebrate: true },
  { ms: 3800, beat: 4, line: 6, slide: 'final' },
  { ms: 1200, beat: 4, line: 6, slide: 'final', fade: true },
]
const TOTAL = 'animate-[film-fill_40200ms_linear_both]' // the sum of STEPS, as a literal class so Tailwind sees it
const STILL = 11 // reduced motion: the checked slide
const LINES = { ask: 'Make a slide from this doc. Highlight bad debt.', change: 'Add the reasons on the right.' }

// The narrator: one line at a time, saying what is happening. The gold italic is the part to take away.
const NARRATOR: ReactNode[] = [
  <>The doc <em>nobody reads.</em></>,
  <>You ask for a slide <em>in one line.</em></>,
  <>Occam reads it <em>and finds the point.</em></>,
  <>It builds the slide <em>from your numbers.</em></>,
  <>Every slide is reviewed <em>against the laws of logic and design.</em></>,
  <>Change it <em>in plain words.</em></>,
  <>Edits until <em>nothing is left to remove.</em></>,
]
// The camera: one slow dolly across the loop, each beat a re-framing rather than a cut.
const DOLLY = ['scale-100', 'scale-[1.015]', 'scale-[1.03]', 'scale-[1.045]', 'scale-[1.06]']

/** The film, looping while on screen. Reduced motion shows the checked slide as a still. */
export function Film() {
  const box = useRef<HTMLDivElement>(null)
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [at, setAt] = useState(still ? STILL : 0), [seen, setSeen] = useState(false), [paused, setPaused] = useState(false)
  const [chars, setChars] = useState(0), [loop, setLoop] = useState(0)
  // The narrator hands over: the line that was, leaving, and the line that is, arriving.
  const [voice, setVoice] = useState<{ line: number; prev: number | null; k: number }>({ line: STEPS[at].line, prev: null, k: 0 })
  const playing = seen && !paused && !still
  const line = STEPS[at].line
  useEffect(() => { setVoice((v) => (v.line === line ? v : { line, prev: v.line, k: v.k + 1 })) }, [line])

  useEffect(() => {
    const el = box.current
    if (!el || still) return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [still])

  useEffect(() => {
    if (!playing) return
    const step = STEPS[at], line = LINES[step.say ?? 'ask']
    setChars(step.typing ? 0 : 99)
    const tick = step.typing ? setInterval(() => setChars((c) => c + 1), (step.ms * 0.6) / line.length) : undefined
    const next = setTimeout(() => {
      if (at === STEPS.length - 1) setLoop((l) => l + 1)
      setAt((a) => (a + 1) % STEPS.length)
    }, step.ms)
    return () => { clearTimeout(next); clearInterval(tick) }
  }, [playing, at])

  const s = STEPS[at], beat = s.beat, slide: Slide = s.slide ?? 'none'
  const doc = s.intro ? 'hidden' : slide !== 'none' ? 'gone' : s.work ? 'dim' : 'on'
  const ease = 'ease-[cubic-bezier(.2,.8,.2,1)]'
  return (
    <div ref={box}>
      <figure aria-label="A film of Occam: a doc, a one-line request, the slide built from it, reviewed, then changed in plain words"
        className="group relative aspect-video overflow-hidden rounded-[24px] bg-[#0B0A09] text-[#F3EEE4] shadow-[0_0_0_1px_rgba(243,238,228,.08),0_40px_100px_-40px_rgba(0,0,0,.9)] [container-type:inline-size]">
        {/* The stage light: warm from the top left, falling off to a vignette. */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_60%_at_25%_10%,rgba(232,185,74,.10),transparent_60%)]" />

        {/* Everything the camera sees, on one slow dolly. */}
        <div className={cn('absolute inset-0 origin-[50%_55%] transition-transform ease-linear', at === 0 ? 'duration-1000' : 'duration-[8000ms]', DOLLY[beat])}>
          {/* The doc: rises in under the title, is read (scan, highlights), dims while Occam builds, and gives way to the slide. */}
          <div className={cn('absolute left-[31cqw] top-[10cqw] w-[38cqw] transition-[transform,opacity,filter] duration-[1100ms]', ease,
            doc === 'hidden' && 'translate-y-[4cqw] opacity-0', doc === 'dim' && 'opacity-45 blur-[1px]', doc === 'gone' && 'translate-y-[2cqw] scale-[.94] opacity-0 blur-[3px]')}>
            <Doc key={`doc${loop}`} marks={s.marks ?? 0} scanning={!!s.scan} />
          </div>

          {/* The slide: comes up where the doc was, celebrated; each review draws on it; the change lays out in place. */}
          <div className={cn('absolute left-[21cqw] top-[10cqw] aspect-video w-[58cqw] transition-[opacity,transform] duration-[1100ms]', ease,
            slide === 'none' || s.fade ? 'scale-[.97] opacity-0' : 'scale-100 opacity-100')}>
            <div className="absolute inset-0 overflow-hidden rounded-[.6cqw] shadow-[0_0_0_1px_rgba(243,238,228,.14),0_3cqw_6cqw_-2cqw_rgba(0,0,0,.9)]">
              <LiveSlide key={`d${loop}`} id="waterfall-notes" withoutNotes className="absolute inset-0" />
              <div className={cn('absolute inset-0 transition-opacity duration-700', slide === 'final' ? 'opacity-100' : 'opacity-0')}>
                <LiveSlide key={`f${loop}`} id="waterfall-notes" className="absolute inset-0" />
              </div>
            </div>
            <CheckOverlay check={s.check} />
            {s.celebrate && <Celebrate key={`${slide}${loop}`} />}
          </div>

          {/* The request: typed, sent up into the chat, and Occam's status left in its place. */}
          <div className={cn('absolute left-1/2 top-[45.2cqw] -translate-x-1/2 transition-[opacity,transform] duration-500', ease,
            s.say ? 'translate-y-0 opacity-100' : 'translate-y-[1cqw] opacity-0')}>
            <Prompt key={`${s.say}${loop}`} text={LINES[s.say ?? 'change'].slice(0, s.typing ? chars : 99)} sent={!!s.say && !s.typing}
              status={slide === 'none' || (s.say === 'change' && slide === 'draft') ? 'working' : 'done'} />
          </div>
        </div>

        {/* The vignette, over everything the camera sees. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_45%,transparent_55%,rgba(0,0,0,.55))]" />

        {/* The narrator: it opens large in the middle, then rises to its place at the top. Each line hands over to the
            next: the old one drifts up and blurs out as the new one rises in. */}
        <div aria-live="polite" className={cn('absolute inset-x-[5cqw] top-[3.6cqw] text-center text-[2.3cqw] font-medium leading-[1.2] tracking-[-.015em] text-[#F3EEE4] transition-transform duration-[1400ms]', ease,
          '[&_em]:font-serif [&_em]:text-[1.12em] [&_em]:font-normal [&_em]:italic [&_em]:tracking-normal [&_em]:text-[#E8B94A]', s.intro ? 'translate-y-[20cqw] scale-[1.6]' : 'translate-y-0 scale-100')}>
          {voice.prev !== null && <p key={`p${voice.k}${loop}`} aria-hidden className="absolute inset-x-0 top-0 motion-safe:animate-leave">{NARRATOR[voice.prev]}</p>}
          <p key={`c${voice.k}${loop}`} className="motion-safe:animate-rise motion-safe:[animation-delay:.3s]">{NARRATOR[voice.line]}</p>
        </div>

        {/* Progress: one hairline across the loop. Pause shows on hover or focus only. */}
        {!still && (
          <>
            <span aria-hidden className="absolute bottom-0 left-0 h-px w-full bg-white/10">
              <i key={loop} className={cn('block size-full origin-left bg-[#E8B94A]/70', TOTAL, !playing && '[animation-play-state:paused]')} />
            </span>
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play the film' : 'Pause the film'}
              className={cn('absolute bottom-[2cqw] right-[2cqw] grid size-[max(32px,3cqw)] place-items-center rounded-full bg-white/10 text-[#F3EEE4] backdrop-blur transition-opacity hover:bg-white/20 focus-visible:opacity-100',
                paused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
              <svg viewBox="0 0 12 12" className="size-[40%]" aria-hidden fill="currentColor">{paused ? <path d="M3 1.5v9l7-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}</svg>
            </button>
          </>
        )}
      </figure>
    </div>
  )
}
