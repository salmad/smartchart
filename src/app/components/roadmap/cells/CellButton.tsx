import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** No value yet: draw nothing until the row is hovered or the cell focused, then a faint plus. */
  empty?: boolean
  /** Words for the empty state where it should always read (the issue panel's "Start", "Due"). */
  placeholder?: string
}

/** What every editable cell is clicked by: quiet text that steps to raise on hover, with a focus ring. */
export const CellButton = forwardRef<HTMLButtonElement, Props>(({ empty, placeholder, className, children, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    disabled={disabled}
    className={cn(
      'group/cell flex h-7 min-w-7 max-w-full items-center gap-1.5 rounded-md px-1.5 text-left text-[13px] outline-none transition-colors duration-120',
      'hover:bg-raise focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-raise disabled:pointer-events-none',
      className,
    )}
    {...props}
  >
    {!empty ? children : placeholder ? (
      <span className="text-ink-3">{placeholder}</span>
    ) : disabled ? null : (
      <Plus
        aria-hidden
        strokeWidth={1.75}
        className="size-3.5 text-ink-3 opacity-0 transition-opacity duration-120 group-hover:opacity-100 group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100 group-data-[state=open]/cell:opacity-100"
      />
    )}
  </button>
))
CellButton.displayName = 'CellButton'
