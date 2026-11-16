/* Small parts the issue panel and the issue page share. */
import { forwardRef, type ComponentProps, type ReactNode } from 'react'
import type { Issue, Roadmap } from '@/engine/roadmaps/types'
import { keyOf } from '@/engine/roadmaps/fields'
import { cn } from '@/app/lib/utils'
import { Button, type ButtonProps } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

/** An issue's key ("SCL-12"): quiet, tabular, never wrapping. */
export function IssueKey({ roadmap, issue, className }: { roadmap: Roadmap; issue: Pick<Issue, 'number'>; className?: string }) {
  return <span className={cn('flex-none whitespace-nowrap text-[12px] tabular-nums text-ink-3', className)}>{keyOf(roadmap, issue)}</span>
}

/** Where the issue sits: its parent (a link), then its own key, in the app's crumb dialect. */
export function IssueCrumb({ roadmap, issue, parent, onOpenIssue }: { roadmap: Roadmap; issue: Issue; parent: Issue | null; onOpenIssue: (id: string) => void }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[13px]">
      {parent && (
        <>
          <button
            type="button"
            title={parent.title}
            className="min-w-0 truncate text-ink-3 transition-colors hover:text-ink-2 focus-visible:underline focus-visible:outline-none"
            onClick={() => onOpenIssue(parent.id)}
          >
            {parent.title}
          </button>
          <span aria-hidden className="flex-none text-ink-3">/</span>
        </>
      )}
      <IssueKey roadmap={roadmap} issue={issue} className="text-[13px] text-ink-2" />
    </div>
  )
}

/** The app's tooltip surface (as in the composer). */
export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** An icon-only action with its name in a tooltip. */
export function IconAction({ label, hint, className, children, ...props }: ButtonProps & { label: string; hint?: string }) {
  return (
    <Hint label={hint ?? label}>
      <Button type="button" variant="quiet" size="icon-sm" aria-label={label} className={className} {...props}>
        {children}
      </Button>
    </Hint>
  )
}

/** A property's value as a one-click control: the app's ghost button, set on the value column's edge. */
export const ValueButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="ghost"
    size="sm"
    className={cn('group/value -ml-1.5 min-w-0 max-w-full justify-start gap-2 rounded-md px-1.5 text-[13px] font-normal text-ink hover:bg-raise active:scale-100 data-[state=open]:bg-raise', className)}
    {...props}
  />
))
ValueButton.displayName = 'ValueButton'

/** What an empty, editable value says ("Add assignee"): quiet until its row is hovered. */
export function Placeholder({ children }: { children: ReactNode }) {
  return <span className="text-ink-3 transition-colors group-hover/value:text-ink-2">{children}</span>
}

/** A titled part of the issue (sub-issues, activity): a quiet label, with a summary beside it. */
export function IssueSection({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} className="mt-8">
      <header className="mb-1 flex h-6 items-center justify-between gap-3">
        <h3 className="text-[12px] font-medium text-ink-3">{label}</h3>
        {aside}
      </header>
      {children}
    </section>
  )
}

/** A textarea as tall as its text: a hidden copy in the same grid cell sets the height. */
export const GrowingText = forwardRef<HTMLTextAreaElement, Omit<ComponentProps<'textarea'>, 'value'> & { value: string }>(({ className, value, ...props }, ref) => (
  <div className="grid min-w-0">
    <div aria-hidden className={cn('invisible whitespace-pre-wrap break-words [grid-area:1/1]', className)}>{value}{'​'}</div>
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn('resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent outline-none [grid-area:1/1] focus:ring-0', className)}
      {...props}
    />
  </div>
))
GrowingText.displayName = 'GrowingText'
