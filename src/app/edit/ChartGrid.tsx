// src/app/edit/ChartGrid.tsx
/* The chart-data popup: a spreadsheet for bars and waterfall, a gantt for the timeline. One draft, one history: edits go
   through the slide's own patches, and Done closes it (the slide's Save and Discard stay the only commit). */
import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { sheetFor } from '@/engine/slides/sheet'
import type { Style } from '@/engine/types'
import { Gantt } from './Gantt'
import { Sheet } from './Sheet'
import type { SlideEdit } from './useSlideEdit'

export function ChartGrid({ edit, deckStyle, onClose }: { edit: SlideEdit; deckStyle: Style; onClose: () => void }) {
  const [note, setNote] = useState(''), model = sheetFor(edit.draft, deckStyle)
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent data-chart-grid className="flex max-h-[85vh] w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-4 p-6">
        <DialogHeader>
          <DialogTitle>{edit.draft.table ? 'Table data' : 'Chart data'}</DialogTitle>
          <DialogDescription>Type to replace, Enter to edit, paste from a spreadsheet. The slide redraws when you close this.</DialogDescription>
        </DialogHeader>
        {edit.draft.chart?.kind === 'timeline' ? <Gantt edit={edit} deckStyle={deckStyle} /> : model ? <Sheet edit={edit} model={model} deckStyle={deckStyle} note={note} onNote={setNote} /> : <p className="text-ink-3">This chart has no table view.</p>}
        <div className="flex"><Button className="ml-auto" onClick={onClose}>Done</Button></div>
      </DialogContent>
    </Dialog>
  )
}
