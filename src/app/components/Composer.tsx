import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Paperclip } from 'lucide-react'
import type { Pill } from '@/engine/agent/suggest'
import type { Style } from '@/engine/types'
import { EXAMPLES } from '@/app/examples'
import { ACCEPT, readFile, type Attached } from '@/app/files'
import { LINK, linkName, readLink } from '@/app/links'
import { cn } from '@/app/lib/utils'
import { FileChip } from './FileChip'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'

interface Props {
  chips: Pill[] | null; canSend: boolean; busy: boolean; onSend: (text: string, files?: Attached[]) => void; onClear: () => void
  /** Shown instead of the usual placeholder, e.g. why sending is off. */
  hint?: string
  /** A new deck: the writing style to pick (it is set once the first slide is made) and example prompts to start from. */
  start?: { style: Style; onStyle: (s: Style) => void }
}

const STYLES: [Style, string, string][] = [
  ['consulting', 'Consulting', 'The argument in the title, the evidence below.'],
  ['pitch', 'Pitch', 'One bold claim, big numbers, little text.'],
]

/** A file on its way in: read to text in the browser, or why it couldn't be. */
type Pending = { id: number; name: string } & ({ state: 'reading' } | { state: 'ready'; file: Attached } | { state: 'failed'; why: string })

/** Prompt box with suggestion pills; in a new deck, the style and example prompts instead. Files dropped on it, or
    picked with the paperclip, go with the message. It refuses an empty message and a send while a turn runs or a
    file is still being read: sendTurn does not check. */
export function Composer({ chips, canSend, busy, onSend, onClear, hint, start }: Props) {
  const [text, setText] = useState(''), [files, setFiles] = useState<Pending[]>([]), [over, setOver] = useState(false)
  const picker = useRef<HTMLInputElement>(null), nextId = useRef(0)
  const ready = files.flatMap((f) => (f.state === 'ready' ? [f.file] : []))
  const reading = files.some((f) => f.state === 'reading')
  const canSubmit = canSend && !reading && (!!text.trim() || ready.length > 0)
  const send = (t: string, withFiles = true) => {
    if (!canSend || reading || (!t.trim() && !(withFiles && ready.length))) return
    onSend(t.trim(), withFiles ? ready : [])
    setText('')
    if (withFiles) setFiles([])
  }
  /** One attachment being read: a file, or a link the server fetches. */
  const attach = (name: string, read: () => Promise<Attached>) => {
    const id = nextId.current++
    setFiles((fs) => [...fs, { id, name, state: 'reading' }])
    read().then(
      (file) => setFiles((fs) => fs.map((x) => (x.id === id ? { id, name: file.name, state: 'ready', file } : x))),
      (e: unknown) => setFiles((fs) => fs.map((x) => (x.id === id ? { id, name, state: 'failed', why: e instanceof Error ? e.message : String(e) } : x))))
  }
  const add = (list: FileList | File[] | null) => { for (const f of Array.from(list ?? [])) attach(f.name, () => readFile(f)) }
  // A pasted screenshot arrives as "image.png": name it so the chips and the agent can tell pictures apart.
  const named = (pics: File[]) => pics.map((f, i) => new File([f], /^image\.\w+$/.test(f.name) ? `Pasted picture ${nextId.current + i + 1}.${f.type.split('/')[1] ?? 'png'}` : f.name, { type: f.type }))
  // A file dropped anywhere on the editor joins the message; the browser never opens it in place of the deck.
  const addRef = useRef(add)
  addRef.current = add
  useEffect(() => {
    const files = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const over = (e: DragEvent) => { if (!files(e)) return; e.preventDefault(); setOver(canSend) }
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setOver(false) }
    const drop = (e: DragEvent) => { if (!files(e)) return; e.preventDefault(); setOver(false); if (canSend) addRef.current(e.dataTransfer?.files ?? null) }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }, [canSend])
  const submit = (e: FormEvent) => { e.preventDefault(); send(text) }
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }

  return (
    <form onSubmit={submit}
      className={cn('relative grid gap-2.5 border-t border-line px-3.5 pb-3.5 pt-3', over && 'after:pointer-events-none after:absolute after:inset-2 after:rounded-[12px] after:border after:border-dashed after:border-ink-3 after:bg-app-bg/90')}>
      {over && <p aria-hidden className="pointer-events-none absolute inset-0 z-[1] grid place-content-center text-[13px] text-ink">Drop to add to your message</p>}
      {start && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map(([label, st, prompt]) => (
            <button key={label} type="button" onClick={() => { setText(prompt); start.onStyle(st) }}
              className="cursor-pointer rounded-full border border-line-2 px-2.5 py-1 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink">{label}</button>
          ))}
        </div>
      )}
      {!start && chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((p, k) => (
            <Tooltip key={k}>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => send(p.prompt, false)}
                  className="cursor-pointer rounded-full border border-line-2 px-2.5 py-1 text-left text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink">{p.label}</button>
              </TooltipTrigger>
              <TooltipContent className="max-w-80 bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]">{p.prompt}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul aria-label="Attached files" className="flex flex-wrap gap-1.5">
          {files.map((f) => (
            <li key={f.id}>
              <FileChip name={f.name} about={f.state === 'ready' ? f.file.about + (f.file.cut ? ', cut' : '') : f.state === 'reading' ? 'Reading…' : undefined}
                error={f.state === 'failed' ? f.why : undefined} onRemove={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))} />
            </li>
          ))}
        </ul>
      )}
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} disabled={!canSend}
        onPaste={(e) => {
          const pics = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
          if (pics.length) { e.preventDefault(); add(named(pics)); return }
          // A link pasted on its own is read and attached, like a dropped file; a link inside a sentence stays text.
          const link = e.clipboardData.getData('text/plain').trim()
          if (LINK.test(link)) { e.preventDefault(); attach(linkName(link), () => readLink(link)) }
        }}
        placeholder={hint ?? (files.length ? 'Say what the room should take away…' : start ? 'Paste your numbers or a link, or drop a doc or sheet, and say what the slide should argue…' : 'Describe a slide, or ask for a change…')}
        className="min-h-0 resize-none rounded-[10px] border-line-2 bg-app-bg px-3 py-2.5 text-sm leading-[1.45] shadow-none focus-visible:border-ink-3 focus-visible:ring-0 disabled:opacity-50" />
      <div className="flex items-center gap-2">
        {start
          ? <div role="group" aria-label="Writing style" className="mr-auto flex gap-1">
              {STYLES.map(([v, label, line]) => (
                <button key={v} type="button" aria-pressed={start.style === v} title={line} onClick={() => start.onStyle(v)}
                  className="h-7 cursor-pointer rounded-md px-2.5 text-[12.5px] text-ink-3 transition-colors hover:text-ink-2 aria-pressed:bg-raise aria-pressed:text-ink aria-pressed:shadow-[0_0_0_1px_theme(colors.line-2)]">{label}</button>
              ))}
            </div>
          : <Button type="button" variant="ghost" onClick={onClear} disabled={busy} className="mr-auto px-1 text-[12.5px] text-ink-3">Clear chat</Button>}
        <input ref={picker} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" aria-label="Attach files" disabled={!canSend} onClick={() => picker.current?.click()} className="w-8 px-0 text-ink-3 hover:text-ink">
              <Paperclip className="size-4" strokeWidth={1.75} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]">Attach a PDF, Word, Excel, CSV or text file</TooltipContent>
        </Tooltip>
        <Button type="submit" disabled={!canSubmit}>{start ? (ready.length > 1 ? 'Make slides' : 'Make a slide') : 'Send'}</Button>
      </div>
    </form>
  )
}
