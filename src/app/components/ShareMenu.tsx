/* Share, in the editor's bar: a link anyone can open to read the deck and present it (made on request, stopped in
   one click), and the deck as a PDF. */
import { useState } from 'react'
import { Check, Copy, FileDown } from 'lucide-react'
import { share, shareUrl } from '@/app/share'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

type Link = { state: 'loading' } | { state: 'off' } | { state: 'on'; token: string } | { state: 'error'; why: string }

interface Props {
  /** The deck a link can be made for; null when it lives only in this browser (the link part is left out). */
  deckId: string | null
  onPdf: () => void
}

export function ShareMenu({ deckId, onPdf }: Props) {
  const [open, setOpen] = useState(false), [link, setLink] = useState<Link>({ state: 'loading' }), [copied, setCopied] = useState(false)
  const [working, setWorking] = useState(false)

  const run = async (on?: boolean) => {
    if (!deckId) return
    setWorking(true)
    try {
      const token = await share(deckId, on)
      setLink(token ? { state: 'on', token } : { state: 'off' })
      if (token && on) await copy(token)
    } catch (e) { setLink({ state: 'error', why: e instanceof Error ? e.message : String(e) }) }
    setWorking(false)
  }
  const copy = async (token: string) => {
    try { await navigator.clipboard.writeText(shareUrl(token)); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* the field stays selectable */ }
  }
  const onOpenChange = (o: boolean) => { setOpen(o); setCopied(false); if (o && deckId) { setLink({ state: 'loading' }); void run() } }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild><Button variant="outline">Share</Button></PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} aria-label="Share this deck"
        className="grid w-80 gap-4 rounded-[14px] border-line-2 bg-raise p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_24px_48px_-16px_rgba(0,0,0,.7)]">
        <h2 className="text-[14px] font-medium text-ink">Share this deck</h2>
        {deckId && <section className="grid gap-3">
        <p className="-mt-2 text-[12.5px] text-ink-3">Anyone with the link can read it and present it. It always shows the latest version.</p>
        {link.state === 'on' ? (
          <>
            <div className="flex items-center gap-2">
              <input readOnly value={shareUrl(link.token)} aria-label="Link" onFocus={(e) => e.currentTarget.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 font-mono text-[12px] text-ink-2 outline-none focus:border-line-2" />
              <Button onClick={() => void copy(link.token)} className="w-[88px]">
                {copied ? <><Check className="size-3.5" strokeWidth={2} /> Copied</> : <><Copy className="size-3.5" strokeWidth={1.75} /> Copy</>}
              </Button>
            </div>
            <button type="button" disabled={working} onClick={() => void run(false)}
              className="justify-self-start text-[12.5px] text-ink-3 transition-colors hover:text-ink disabled:opacity-50">Stop sharing</button>
          </>
        ) : link.state === 'error' ? (
          <div className="grid gap-3">
            <p role="alert" className="text-[13px] text-ink-2">{link.why}</p>
            <Button variant="outline" disabled={working} onClick={() => void run()} className="justify-self-start">Try again</Button>
          </div>
        ) : (
          <Button disabled={link.state === 'loading' || working} onClick={() => void run(true)} className="justify-self-start">Create link</Button>
        )}
        </section>}
        {deckId && <hr className="-mx-4 border-line" />}
        <button type="button" onClick={() => { setOpen(false); onPdf() }}
          className="-m-2 flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-panel">
          <FileDown className="size-4 flex-none text-ink-2" strokeWidth={1.75} />
          <span className="grid">
            <span className="text-[13px] text-ink">Download PDF</span>
            <span className="text-[12px] text-ink-3">One slide per page, for email and board packs.</span>
          </span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
