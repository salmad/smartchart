import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { pathLabel } from '@/engine/comments'
import { contexts } from '@/engine/slides/render'
import type { Deck } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { SlideView } from './SlideView'
import { Glint, Stars, Thinking } from './Working'

/** The slide's width: the largest 16:9 that leaves room for the bar, and the checks line and filmstrip below. The row under it shares it. */
export const SLIDE_W = 'w-[min(100%,calc((100vh_-_56px_-_44px_-_140px)*16/9))]'

/** The framed slide box: the largest 16:9 that fits, with its ring and shadow. Edit mode uses it too. */
export function SlideFrame({ children, onClick, onPointerMove, onPointerLeave, frame, title, className, tour }: { children: ReactNode; onClick?: (e: React.MouseEvent) => void; onPointerMove?: (e: React.PointerEvent) => void; onPointerLeave?: () => void; frame?: Ref<HTMLDivElement>; title?: string; className?: string; tour?: string }) {
  return (
    <div ref={frame} onClick={onClick} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} title={title} data-tour={tour}
      className={cn('group relative aspect-video overflow-hidden', SLIDE_W, 'rounded-[10px] bg-panel shadow-[0_0_0_1px_theme(colors.line),0_24px_60px_rgba(0,0,0,.5)] max-[900px]:w-full max-[900px]:rounded-lg', className)}>
      {children}
    </div>
  )
}

/** While the comments panel is open the stage picks a part of the slide instead of presenting it. `ring`: a part to mark
    (the one a comment points at); `target`: the part the next comment is about. */
export interface Pick { target: string | null; ring: string | null; onPick: (path: string | null) => void }

interface Props {
  deck: Deck; current: number; onPresent: () => void
  pick?: Pick
  /** The current slide's id: a slide the stage has not shown before comes into focus once. */
  slideId: string | undefined
  /** While a turn runs: what is happening, in plain words, as lines that take turns. */
  phase: string[] | null
}

/** The current slide at the largest size that leaves room for the checks and the strip; a click presents. */
export function Stage({ deck, current, onPresent, pick, slideId, phase }: Props) {
  const slide = deck.slides[current]
  const frame = useRef<HTMLDivElement>(null), mark = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null), [label, setLabel] = useState<string | null>(null)
  // The smallest marked part under the pointer: its text field, else its item.
  const partAt = (t: EventTarget | null) => { const el = t instanceof Element ? t.closest<HTMLElement>('[data-path], [data-item]') : null; return el?.dataset.path ?? el?.dataset.item ?? null }
  const shown = pick ? hover ?? pick.ring ?? pick.target : null
  useLayoutEffect(() => {
    const f = frame.current, m = mark.current, el = f && shown ? f.querySelector<HTMLElement>(`[data-path="${CSS.escape(shown)}"], [data-item="${CSS.escape(shown)}"]`) : null
    if (!f || !m || !el) { setLabel(null); return }
    const a = f.getBoundingClientRect(), b = el.getBoundingClientRect()
    for (const [k, v] of Object.entries({ '--x': b.left - a.left - 4, '--y': b.top - a.top - 3, '--w': b.width + 8, '--h': b.height + 6 })) m.style.setProperty(k, `${v}px`)
    setLabel(pathLabel(shown ?? ''))
  }, [shown, slide])
  // Slides already on screen when the deck opened, or shown before, are not revealed again.
  const seen = useRef<Set<string> | null>(null)
  seen.current ??= new Set(phase === null && slideId ? [slideId] : [])
  const fresh = !!slideId && !seen.current.has(slideId)
  if (slideId) seen.current.add(slideId)

  return (
    <div className="grid min-h-0 place-items-center px-8 pb-4 pt-7 max-[900px]:order-1 max-[900px]:px-4 max-[900px]:pb-3 max-[900px]:pt-4">
      {/* The second click of a double click (e.g. on a gallery tile that just became this slide) does not present. */}
      <SlideFrame tour="stage" frame={frame}
        onClick={(e) => {
          if (pick) { pick.onPick(partAt(e.target)); return }
          if (slide && e.detail < 2 && !(e.target instanceof Element && e.target.closest('a'))) onPresent()
        }}
        onPointerMove={pick ? (e) => setHover(partAt(e.target)) : undefined} onPointerLeave={pick ? () => setHover(null) : undefined}
        title={slide && !pick ? 'Present (F)' : undefined} className={slide ? (pick ? 'cursor-default' : 'cursor-zoom-in') : undefined}>
        {slide
          ? <SlideView key={slideId} slide={slide} deck={deck} ctx={contexts(deck)[current]} className={cn('absolute inset-0', fresh && 'motion-safe:animate-reveal')} />
          : phase !== null ? <Skeleton /> : (
            <div className="absolute inset-0 grid place-content-center gap-1.5 text-center">
              <p className="text-[17px] font-medium">Your slide appears here.</p>
              <span className="text-ink-3">Describe it in the chat.</span>
            </div>
          )}
        {slide && phase !== null && <div aria-hidden className="absolute inset-0 bg-[rgba(10,10,11,.45)] transition-opacity" />}
        {phase !== null && <Stars />}
        {pick && (
          <div ref={mark} aria-hidden className={cn('pointer-events-none absolute left-[var(--x)] top-[var(--y)] h-[var(--h)] w-[var(--w)] rounded-[4px] border border-ink-2 bg-white/[.06]', !label && 'hidden')}>
            <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-raise px-1.5 py-0.5 text-[11px] leading-none text-ink-2 shadow-[0_0_0_1px_theme(colors.line-2)]">{label}</span>
          </div>
        )}
        {phase !== null && (
          <p role="status" className="absolute bottom-[6%] left-1/2 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-raise/90 px-4 py-2 text-[13px] text-ink shadow-[0_0_0_1px_theme(colors.line-2),0_12px_32px_rgba(0,0,0,.5)] backdrop-blur">
            <Glint /><Thinking lines={phase} />
          </p>
        )}
      </SlideFrame>
    </div>
  )
}

const BARS = ['h-[38%]', 'h-[52%]', 'h-[61%]', 'h-[74%]', 'h-[88%]']

/** The shape of a slide, while the first one is being made: kicker, a two-line title, a body, a takeaway. */
function Skeleton() {
  const bar = 'rounded-full bg-line-2 motion-safe:animate-pulse'
  // Sized in cqw (the frame's width), so the skeleton scales like a slide.
  return (
    <div aria-hidden className="absolute inset-0 [container-type:inline-size]">
      <div className="grid h-full grid-rows-[auto_auto_1fr_auto] gap-[2cqw] p-[6.5cqw]">
        <i className={cn(bar, 'h-[.8cqw] w-[12%]')} />
        <div className="grid gap-[.7cqw]">
          <i className={cn(bar, 'h-[2.5cqw] w-[72%]')} />
          <i className={cn(bar, 'h-[2.5cqw] w-[48%]')} />
        </div>
        <div className="flex items-end gap-[3%] pb-[2%]">
          {BARS.map((h) => <i key={h} className={cn('flex-1 rounded-t-md bg-line motion-safe:animate-pulse', h)} />)}
        </div>
        <i className={cn(bar, 'h-[1.35cqw] w-[40%]')} />
      </div>
    </div>
  )
}
