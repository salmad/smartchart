/* Markdown, HTML and PDF for a doc the reader already has open. */
import { FileDown, FileText, FileCode } from 'lucide-react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface Props {
  onMarkdown: () => void
  onHtml: () => void
  onPdf: () => void
}

const row = 'flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-panel w-full'

export function DocExportMenu({ onMarkdown, onHtml, onPdf }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline">Download</Button></PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} aria-label="Download this doc"
        className="grid w-72 gap-1 rounded-[14px] border-line-2 bg-raise p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_24px_48px_-16px_rgba(0,0,0,.7)]">
        <button type="button" className={row} onClick={onMarkdown}>
          <FileText className="size-4 flex-none text-ink-2" strokeWidth={1.75} />
          <span className="grid text-left">
            <span className="text-[13px] text-ink">Markdown</span>
            <span className="text-[12px] text-ink-3">Source file with live figures.</span>
          </span>
        </button>
        <button type="button" className={row} onClick={onHtml}>
          <FileCode className="size-4 flex-none text-ink-2" strokeWidth={1.75} />
          <span className="grid text-left">
            <span className="text-[13px] text-ink">HTML</span>
            <span className="text-[12px] text-ink-3">A page you can open offline.</span>
          </span>
        </button>
        <button type="button" className={row} onClick={onPdf}>
          <FileDown className="size-4 flex-none text-ink-2" strokeWidth={1.75} />
          <span className="grid text-left">
            <span className="text-[13px] text-ink">PDF</span>
            <span className="text-[12px] text-ink-3">Print or save as PDF (⌘P).</span>
          </span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
