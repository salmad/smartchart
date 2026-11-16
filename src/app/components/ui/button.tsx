import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/app/lib/utils"

// Journey chrome: `default` is the primary button, `outline` the ghost one.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium transition-[color,background-color,transform] duration-150 ease-out-strong active:scale-[.97] disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground disabled:opacity-35",
        outline: "border border-line-2 bg-transparent text-ink-2 hover:text-ink disabled:opacity-45 disabled:hover:text-ink-2",
        ghost: "text-ink-2 hover:text-ink disabled:opacity-45",
        // A tool in a bar or a panel head: grey until hovered, stepping to panel on hover and while its menu is open.
        quiet: "font-normal text-ink-3 hover:bg-panel hover:text-ink data-[state=open]:bg-panel data-[state=open]:text-ink disabled:opacity-45",
      },
      size: {
        default: "h-8 px-3.5",
        sm: "h-7 px-2.5 text-xs",
        // Icon only: a square at the bar's height, or the smaller one inside a panel.
        icon: "size-8 px-0",
        "icon-sm": "size-7 rounded-md px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
