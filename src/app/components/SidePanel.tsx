import { forwardRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Button } from './ui/button'

/* How a panel sits when the window is too narrow to hold it beside the page: in the page's flow under the content, as
   a sheet over the page's foot (tall for writing in, low when the page above must stay readable), or laid over the
   page from the right, under the bar. Written out whole: Tailwind finds classes by reading the source. */
const NARROW = {
  stack: 'max-[900px]:order-2 max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t',
  sheet: 'max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-20 max-[900px]:max-h-[70dvh] max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t',
  'sheet-low': 'max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-20 max-[900px]:max-h-[45dvh] max-[900px]:w-auto max-[900px]:border-l-0 max-[900px]:border-t',
  over: 'max-[1180px]:fixed max-[1180px]:bottom-0 max-[1180px]:right-0 max-[1180px]:top-bar max-[1180px]:z-30 max-[1180px]:border-line-2 max-[1180px]:shadow-[-24px_0_48px_-16px_rgba(0,0,0,.7)]',
} as const

interface Props {
  /** The panel's name for a screen reader; the heading shown is `title`. */
  label: string
  title: ReactNode
  /** One or two quiet lines under the title. */
  note?: ReactNode
  /** Icon actions beside the close button. */
  actions?: ReactNode
  /** What the close button is called ("Close comments"). */
  closeLabel: string
  onClose: () => void
  /** An inspector is 320px; a panel that holds a whole record (an issue) is wide. */
  wide?: boolean
  narrow?: keyof typeof NARROW
  /** The tour's name for this panel. */
  tour?: string
  /** The body: the panel gives it the height that is left, and it scrolls for itself. */
  children: ReactNode
}

/** A panel down the right of a deck, a doc or a roadmap (Look, Versions, Comments, Checks, an issue): one head, one
    close button, one way in, and two widths, so opening a different inspector never moves the page beside it. It takes
    focus when asked (the ref), so a panel opened from the keyboard can be left with Escape. */
export const SidePanel = forwardRef<HTMLElement, Props>(({ label, title, note, actions, closeLabel, onClose, wide = false, narrow = 'stack', tour, children }, ref) => (
  <aside ref={ref} tabIndex={-1} aria-label={label} data-tour={tour}
    className={cn('flex min-h-0 flex-none animate-in fade-in-0 slide-in-from-right-3 flex-col border-l border-line bg-app-bg outline-none duration-200 ease-out-strong',
      wide ? 'w-[440px] max-w-full' : 'w-[320px]', NARROW[narrow])}>
    <header className="flex items-start justify-between gap-3 p-4 pb-3">
      <div className="grid min-w-0 gap-0.5">
        <h2 className="min-w-0 text-[14px] font-medium text-ink">{title}</h2>
        {note}
      </div>
      <div className="-mr-1 -mt-1 flex flex-none items-center gap-0.5">
        {actions}
        <Button type="button" variant="quiet" size="icon-sm" onClick={onClose} aria-label={closeLabel} title={closeLabel}><X strokeWidth={1.75} /></Button>
      </div>
    </header>
    {children}
  </aside>
))
SidePanel.displayName = 'SidePanel'

/** The quiet line under a panel's title. */
export function PanelNote({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-ink-3">{children}</p>
}
