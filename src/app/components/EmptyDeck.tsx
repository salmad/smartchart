import { Check, LayoutGrid } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'
import { Button } from './ui/button'
import { Thinking } from './Working'

/* A slide, drawn small, making itself: the title with its one gold phrase, the evidence rising bar by bar, the reasons
   beside it, the takeaway under it, then the checks it passed. Written out whole (Tailwind reads classes from the source). */
const BARS = [
  'h-[34%] bg-ink/20 [animation-delay:250ms]', 'h-[46%] bg-ink/20 [animation-delay:330ms]', 'h-[52%] bg-ink/20 [animation-delay:410ms]',
  'h-[68%] bg-gold/80 [animation-delay:490ms]', 'h-[92%] bg-gold [animation-delay:570ms]',
] as const

function MiniSlide({ working }: { working: boolean }) {
  return (
    <div aria-hidden className="grid w-full justify-items-center gap-3">
      <div className={cn('grid aspect-video w-full max-w-[360px] grid-rows-[auto_auto_1fr_auto] gap-3 rounded-[12px] border border-line bg-panel p-5 shadow-menu transition-opacity duration-500',
        working && 'opacity-60')}>
        <span className="h-1 w-14 rounded-full bg-ink/25" />
        <span className="grid gap-1.5">
          <span className="flex gap-1.5"><span className="h-2.5 w-20 rounded-sm bg-gold" /><span className="h-2.5 w-40 rounded-sm bg-ink/70" /></span>
          <span className="h-2.5 w-44 rounded-sm bg-ink/70" />
        </span>
        <span className="grid min-h-0 grid-cols-[1.5fr_1fr] gap-5">
          <span className="flex items-end gap-2 border-b border-line-2">
            {BARS.map((b) => <span key={b} className={cn('flex-1 origin-bottom rounded-t-[2px] motion-safe:animate-grow', b)} />)}
          </span>
          <span className="grid content-start gap-2.5 pt-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="grid gap-1"><span className="h-1.5 w-12 rounded-full bg-ink/40" /><span className="h-1.5 w-full rounded-full bg-ink/15" /></span>
            ))}
          </span>
        </span>
        <span className="flex items-center gap-2 border-l-2 border-gold pl-2"><span className="h-1.5 w-40 rounded-full bg-ink/45" /></span>
      </div>
      <span className={cn('flex items-center gap-1.5 text-[12px] text-ink-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:delay-1000 motion-safe:fill-mode-both',
        working && 'invisible')}>
        <Check className="size-3.5 text-ok" strokeWidth={2} />Every slide passes 57 checks for design, meaning and logic
      </span>
    </div>
  )
}

interface Props {
  /** The prompt box, at the centre while nothing has been asked yet; absent once the agent has the conversation. */
  composer?: ReactNode
  /** The first turn is running: what it is doing, one line at a time. */
  working?: string[] | null
  /** Opens the gallery of starting slides. */
  onGallery: () => void
}

/** A deck with nothing in it: what it will be (a slide drawing itself), why it is worth starting (one line), and the one
    next step, the prompt box. The gallery is the quiet second way in. While the first slide is being written, the
    picture waits and says what the agent is doing; the conversation is in the agent's panel. */
export function EmptyDeck({ composer, working, onGallery }: Props) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] place-items-center overflow-y-auto px-8 py-10 max-[900px]:order-1 max-[900px]:px-4">
      <div className="grid w-full max-w-[600px] justify-items-center gap-8 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-out-strong">
        <MiniSlide working={!!working} />
        <div className="grid justify-items-center gap-2.5">
          <h2 className="app-title text-[30px]">{working ? 'Writing your slide' : 'Say what the room should take away.'}</h2>
          <p className="max-w-[480px] text-[14px] leading-[1.55] text-ink-2 [text-wrap:pretty]">
            {working
              ? (working.length ? <Thinking lines={working} /> : 'Reading what you sent…')
              : 'Paste your numbers, notes or a link, or drop in a file. Occam picks the slide, writes it and checks it, so it’s right the first time.'}
          </p>
        </div>
        {composer && <div className="w-full text-left">{composer}</div>}
        {!working && (
          <Button variant="quiet" onClick={onGallery} className="-mt-3 gap-2 text-[13px] text-ink-3 hover:text-ink">
            <LayoutGrid strokeWidth={1.75} />Or start from a ready-made slide
          </Button>
        )}
      </div>
    </div>
  )
}
