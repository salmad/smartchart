/* Share, in a deck's or doc's bar: everything that sends the page out. A link anyone can open to read it (a deck: and
   present it), made on request and stopped in one click; then a copy to download. The ⋯ menu offers the same copies. */
import { useState } from 'react'
import { Check, Copy, Share } from 'lucide-react'
import { shareDeck, shareDoc, shareUrl } from '@/app/share'
import { Button } from './ui/button'
import { DownloadList, type PageDownload } from './Downloads'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

type Link = { state: 'loading' } | { state: 'off' } | { state: 'on'; token: string } | { state: 'error'; why: string }

interface Props {
  /** What the link opens. */
  target: 'deck' | 'doc'
  id: string
  /** The copies it can be sent as. */
  downloads: PageDownload[]
}

export function ShareMenu({ target, id, downloads }: Props) {
  const [open, setOpen] = useState(false), [link, setLink] = useState<Link>({ state: 'loading' }), [copied, setCopied] = useState(false)
  const [working, setWorking] = useState(false)

  const run = async (on?: boolean) => {
    if (!id) return
    setWorking(true)
    try {
      const token = await (target === 'doc' ? shareDoc : shareDeck)(id, on)
      setLink(token ? { state: 'on', token } : { state: 'off' })
      if (token && on) await copy(token)
    } catch (e) { setLink({ state: 'error', why: e instanceof Error ? e.message : String(e) }) }
    setWorking(false)
  }
  const copy = async (token: string) => {
    try { await navigator.clipboard.writeText(shareUrl(token)); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* the field stays selectable */ }
  }
  const onOpenChange = (o: boolean) => { setOpen(o); setCopied(false); if (o && id) { setLink({ state: 'loading' }); void run() } }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild><Button variant="outline"><Share aria-hidden className="!size-3.5" strokeWidth={1.75} />Share</Button></PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} aria-label={target === 'doc' ? 'Share this doc' : 'Share this deck'}
        className="grid w-80 gap-4 p-4">
        <h2 className="text-[14px] font-medium text-ink">{target === 'doc' ? 'Share this doc' : 'Share this deck'}</h2>
        <section className="grid gap-3">
        <p className="-mt-2 text-[12.5px] text-ink-3">{target === 'doc' ? 'Anyone with the link can read it — no sign-in. It always shows the latest version.' : 'Anyone with the link can read it and present it. It always shows the latest version.'}</p>
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
        </section>
        {downloads.length > 0 && (
          <section className="grid gap-2 border-t border-line pt-3">
            <h3 className="text-[12.5px] text-ink-3">Send a copy</h3>
            <div className="-mx-2"><DownloadList downloads={downloads} onPicked={() => setOpen(false)} /></div>
          </section>
        )}
      </PopoverContent>
    </Popover>
  )
}
