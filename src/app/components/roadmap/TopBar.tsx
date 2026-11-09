import { SlidersHorizontal } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/app/lib/utils'

interface Props {
  canEdit: boolean
}

/** Roadmap chrome below the crumbs: one tab (Table), Display, Fields (Task 11), and New issue. */
export function TopBar({ canEdit }: Props) {
  return (
    <div className="flex flex-none items-center gap-2">
      <nav aria-label="Roadmap views" className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5">
        <span className={cn('rounded-md px-2.5 py-1 text-[12.5px] font-medium text-ink', 'bg-raise shadow-[0_0_0_1px_theme(colors.line)]')}>Table</span>
      </nav>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-ink-3 hover:text-ink" disabled>
        <SlidersHorizontal className="size-[15px]" strokeWidth={1.75} aria-hidden />
        Display
      </Button>
      {canEdit && (
        <>
          <Button variant="ghost" size="sm" className="h-8 text-ink-3 hover:text-ink" disabled>Fields</Button>
          <Button size="sm" variant="outline" disabled>New issue</Button>
        </>
      )}
    </div>
  )
}
