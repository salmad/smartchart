/* The copies a deck or doc can be downloaded as, in one list wherever they are offered: the Share popover's "Send a
   copy", the ⋯ menu beside the name, and the Download button a reader gets on a shared page. */
import { useState } from 'react'
import { Download, FileCode, FileDown, FileText, type LucideIcon } from 'lucide-react'
import { exportDocHtml, exportDocMarkdown } from '@/app/doc-export'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export interface PageDownload { label: string; hint: string; icon: LucideIcon; run: () => void }

/** A deck's copies. */
export const deckDownloads = (onPdf: () => void): PageDownload[] => [
  { label: 'PDF', hint: 'One slide per page, to print or attach.', icon: FileDown, run: onPdf },
]

/** A doc's copies. `root`: the rendered article, for the HTML copy (null before it has drawn). */
export const docDownloads = (name: string, text: string, root: () => HTMLElement | null, onPdf: () => void): PageDownload[] => [
  { label: 'PDF', hint: 'To print or attach.', icon: FileDown, run: onPdf },
  { label: 'Markdown', hint: 'The source file, with live figures.', icon: FileText, run: () => exportDocMarkdown(name, text) },
  { label: 'HTML', hint: 'A page that opens offline.', icon: FileCode, run: () => { const r = root(); if (r) exportDocHtml(name, r) } },
]

/** The copies as rows: format, then what it is for. */
export function DownloadList({ downloads, onPicked }: { downloads: PageDownload[]; onPicked?: () => void }) {
  return (
    <div className="grid gap-0.5">
      {downloads.map(({ label, hint, icon: Icon, run }) => (
        <button key={label} type="button" onClick={() => { run(); onPicked?.() }}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-panel focus-visible:bg-panel">
          <Icon aria-hidden className="size-4 flex-none text-ink-2" strokeWidth={1.75} />
          <span className="grid">
            <span className="text-[13px] text-ink">{label}</span>
            <span className="text-[12px] text-ink-3">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** A reader's Download button, on a shared page where there is nothing to share. */
export function DownloadMenu({ downloads, what }: { downloads: PageDownload[]; what: 'deck' | 'doc' }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline"><Download aria-hidden className="!size-3.5" strokeWidth={1.75} />Download</Button></PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} aria-label={`Download this ${what}`} className="w-72 p-2">
        <DownloadList downloads={downloads} onPicked={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
