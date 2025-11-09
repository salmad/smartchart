import { Button } from './ui/button'
import { X } from 'lucide-react'

interface CloseButtonProps {
  onClick: () => void
  className?: string
}

export function CloseButton({ onClick, className }: CloseButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={className}
      aria-label="Close"
    >
      <X className="w-4 h-4" />
    </Button>
  )
}
