/* The raw file behind a slide or a doc, as text, for the edits that are quicker typed than clicked. The same panel on
   both screens; each screen turns the text back into its own model and says what didn't parse. */
import { useState } from 'react'
import { Check, Code2, Copy } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Textarea } from './ui/textarea'
import { Toggle } from './Toggle'

interface Props {
  value: string
  onChange: (text: string) => void
  /** What the file is, for screen readers: "Slide source", "Doc source". */
  label: string
  /** What didn't parse or doesn't pass, one line each. Nothing when the file is fine. */
  notes: string[]
  /** A problem that stops the text from being used at all (JSON that doesn't parse). */
  error: string | null
  readOnly?: boolean
}

export function SourceEditor({ value, onChange, label, notes, error, readOnly }: Props) {
  return (
    <div className="flex size-full min-h-0 flex-col gap-2">
      <Textarea aria-label={label} value={value} readOnly={readOnly} spellCheck={false} autoCapitalize="off" autoCorrect="off"
        onChange={(e) => onChange(e.target.value)}
        className="min-h-0 flex-1 resize-none rounded-[10px] border-line bg-panel p-4 font-mono text-[12.5px] leading-[1.6] text-ink md:text-[12.5px]" />
      {(error || notes.length > 0) && (
        <ul role={error ? 'alert' : 'status'} className="grid max-h-32 gap-1 overflow-auto text-[12.5px]">
          {error && <li className="text-warn">{error}</li>}
          {notes.map((n, i) => <li key={i} className="text-ink-2">{n}</li>)}
        </ul>
      )}
    </div>
  )
}

/** The bar's switch between the page and its file. */
export function SourceToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Toggle open={open} onClick={onClick} label={open ? 'Back to the page' : 'Edit the source'} title={open ? 'Back to the page' : 'Edit the source file'}>
      <Code2 aria-hidden className="size-[17px]" strokeWidth={1.75} />
    </Toggle>
  )
}

/** A whole deck's or doc's file, to read and copy (from the page's ⋯ menu). Editing the file happens in edit mode. */
export function SourceDialog({ title, text, open, onOpenChange }: { title: string; text: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { /* the text stays selectable */ } }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(80vh,760px)] max-w-[860px] flex-col gap-3">
        <div className="grid gap-1 pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>To change it as text, press Edit, then the source button in the bar.</DialogDescription>
        </div>
        <SourceEditor label={title} value={text} onChange={() => {}} notes={[]} error={null} readOnly />
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => void copy()}>{copied ? <><Check className="size-3.5" strokeWidth={2} />Copied</> : <><Copy className="size-3.5" strokeWidth={1.75} />Copy</>}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
