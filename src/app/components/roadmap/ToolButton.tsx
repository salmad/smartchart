import { forwardRef } from 'react'
import { cn } from '@/app/lib/utils'
import { Button, type ButtonProps } from '../ui/button'

/** A quiet action with a word in the roadmap's toolbar (Filter, Display, Today): the app's ghost button at the bar's
    height, stepping to panel on hover and while its menu is open, as the bar's own toggles do. */
export const ToolButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
  <Button
    ref={ref}
    variant="quiet"
    className={cn('gap-1.5 px-2.5 [&_svg]:size-[15px]', className)}
    {...props}
  />
))
ToolButton.displayName = 'ToolButton'
