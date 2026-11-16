import { cn } from '@/app/lib/utils'

/** The cut O from the brand board: a circle with one straight cut, the razor passed once. `rule` is the tile's
    hairline: the site's by default, the app's in the app. */
export function Mark({ className = 'size-6', rule = 'stroke-rule' }: { className?: string; rule?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs><clipPath id="occam-cut"><path d="M0 64V0h18L64 46v18z" /></clipPath></defs>
      <rect x="1" y="1" width="62" height="62" rx="14" className={cn('fill-stage', rule)} strokeWidth="2" />
      <circle cx="32" cy="32" r="19" className="fill-gold" clipPath="url(#occam-cut)" />
    </svg>
  )
}

/** Occam, at the head of every app bar's breadcrumb: the mark and the name as the site sets them. It leads to the
    site; a modified click opens it in a new tab as any link would. */
export function HomeLink({ onSite }: { onSite: () => void }) {
  return (
    <a href="/home" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onSite() }}
      className="flex flex-none items-center gap-2 whitespace-nowrap rounded-md font-display text-[17px] font-extrabold leading-none tracking-[-.01em] text-ink outline-none transition-colors [font-stretch:78%] hover:text-ink-2 focus-visible:ring-1 focus-visible:ring-ring">
      <Mark className="size-5" rule="stroke-line-2" />Occam
    </a>
  )
}
