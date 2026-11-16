import { useCallback, useRef, useState, type ReactElement } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

export interface ConfirmOptions {
  /** A short question: "Discard changes?" */
  title: string
  /** One quiet line: what happens. */
  description: string
  /** The action's name, as a verb: "Discard", "Move". */
  action: string
  /** The way back; "Keep editing" unless nothing is being edited ("Cancel"). */
  cancel?: string
}

export const DISCARD_CHANGES = (what: string): ConfirmOptions => ({ title: 'Discard changes?', description: `Your edits to ${what} won’t be saved.`, action: 'Discard' })

/** Ask before something that can't be taken back. `ask` resolves true on the action and false on "Keep editing", Escape or a
    click outside; asking while one is already open answers false (a key that fires twice doesn't stack dialogs). Render
    the returned element once, anywhere in the component. */
export function useConfirm(): [ReactElement, (opts: ConfirmOptions) => Promise<boolean>] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null), [open, setOpen] = useState(false)
  const resolve = useRef<((yes: boolean) => void) | null>(null)
  const ask = useCallback((next: ConfirmOptions) => {
    if (resolve.current) return Promise.resolve(false)
    setOpts(next); setOpen(true)
    return new Promise<boolean>((done) => { resolve.current = done })
  }, [])
  const answer = (yes: boolean) => { resolve.current?.(yes); resolve.current = null; setOpen(false) }
  const element = (
    <Dialog open={open} onOpenChange={(o) => { if (!o) answer(false) }}>
      <DialogContent className="max-w-[400px]">
        <DialogTitle>{opts?.title}</DialogTitle>
        <DialogDescription>{opts?.description}</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => answer(false)}>{opts?.cancel ?? 'Keep editing'}</Button>
          <Button onClick={() => answer(true)}>{opts?.action}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
  return [element, ask]
}
