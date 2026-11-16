import { LayoutGrid } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'
import { Button } from './ui/button'
import { PICTURE, Proof, StartScreen, Working } from './StartScreen'

/* A slide, drawn small, making itself: the title with its one gold phrase, the evidence rising bar by bar, the reasons
   beside it, the takeaway under it, then the checks it passed. Written out whole (Tailwind reads classes from the source). */
const BARS = [
  'h-[34%] bg-ink/20 [animation-delay:250ms]', 'h-[46%] bg-ink/20 [animation-delay:330ms]', 'h-[52%] bg-ink/20 [animation-delay:410ms]',
  'h-[68%] bg-gold/80 [animation-delay:490ms]', 'h-[92%] bg-gold [animation-delay:570ms]',
] as const

function MiniSlide({ working }: { working: boolean }) {
  return (
    <div aria-hidden className="grid w-full justify-items-center gap-3">
      <div className={cn(PICTURE, 'grid aspect-video w-full max-w-[360px] grid-rows-[auto_auto_1fr_auto] gap-3 p-5', working && 'opacity-60')}>
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
      <Proof hidden={working}>Every slide passes 57 checks for design, meaning and logic</Proof>
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

/** A deck with nothing in it: a slide drawing itself, the promise, and the prompt box; the gallery is the quiet second
    way in. While the first slide is being written, the picture waits and says what the agent is doing. */
export function EmptyDeck({ composer, working, onGallery }: Props) {
  return (
    <StartScreen wide visual={<MiniSlide working={!!working} />} title={working ? 'Writing your slide' : 'Say what the room should take away.'}
      body={working ? <Working lines={working} /> : 'Paste your numbers, notes or a link, or drop in a file. Occam picks the slide, writes it and checks it, so it’s right the first time.'}>
      {composer && <div className="w-full text-left">{composer}</div>}
      {!working && (
        <Button variant="quiet" onClick={onGallery} className="-mt-3 gap-2 text-[13px] text-ink-3 hover:text-ink">
          <LayoutGrid strokeWidth={1.75} />Or start from a ready-made slide
        </Button>
      )}
    </StartScreen>
  )
}
