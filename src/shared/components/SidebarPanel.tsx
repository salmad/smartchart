import { motion, AnimatePresence } from 'framer-motion'
import { type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface SidebarPanelProps {
  isOpen: boolean
  onClose: () => void
  side?: 'left' | 'right'
  width?: string
  children: ReactNode
  showBackdrop?: boolean
  className?: string
}

export function SidebarPanel({
  isOpen,
  onClose,
  side = 'right',
  width = '380px',
  children,
  showBackdrop = true,
  className,
}: SidebarPanelProps) {
  const isLeft = side === 'left'
  const slideDirection = isLeft ? -100 : 100

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop for mobile/tablet */}
          {showBackdrop && (
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}

          {/* Sidebar panel */}
          <motion.div
            className={cn(
              'flex-shrink-0 lg:relative fixed top-0 bottom-0 z-50 lg:z-auto max-w-[90vw]',
              isLeft ? 'left-0' : 'right-0',
              className
            )}
            style={{ width }}
            initial={{ opacity: 0, x: slideDirection }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
