/* The doc's controls in the bar: who else is editing, Look and Versions while reading, the comments toggle, Edit while reading (editors and owners
   only), and while editing the stale-save notice, Discard and Save. */
import { useState, type ReactNode } from 'react'
import { CircleCheck, ClipboardCheck, Pencil } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { cn } from '@/app/lib/utils'
import { CommentsToggle, Toggle } from '@/app/components/Toggle'
import { BarDivider } from '@/app/components/AppBar'
import type { DocEdit } from './useDocEdit'
import { SourceToggle } from '../SourceEditor'

/** "Ann is editing", "Ann and Ben are editing", "Ann and 2 others are editing". Below 900px only the dot shows. */
export function Presence({ names }: { names: string[] }) {
  if (!names.length) return null
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${names.length - 1} others`
  return (
    <p className="flex flex-none items-center gap-1.5 whitespace-nowrap text-[12.5px] text-ink-3" title={`${who} ${names.length === 1 ? 'is' : 'are'} editing`}>
      <i aria-hidden className="size-1.5 rounded-full bg-gold" />
      <span className="max-[900px]:sr-only"><span className="text-ink-2">{who}</span> {names.length === 1 ? 'is' : 'are'} editing</span>
    </p>
  )
}

/** Checks toggle: gold count when something needs attention, a tick when all pass. */
export function ChecksToggle({ open, count, pass, label, onClick }: { open: boolean; count: number; pass: boolean; label?: string; onClick: () => void }) {
  const what = label || `${count} to look at`
  return (
    <Toggle open={open} onClick={onClick} label={pass ? 'Checks pass' : count ? `Checks, ${what}` : 'Checks'} title={count ? `Checks: ${what}` : 'Checks'}
      count={pass ? 0 : count} dot={!pass && count > 0}>
      {pass ? <CircleCheck aria-hidden className="size-[17px] text-ok" strokeWidth={1.75} />
        : <ClipboardCheck aria-hidden className="size-[17px]" strokeWidth={1.75} />}
    </Toggle>
  )
}

interface Panel { open: boolean; onToggle: () => void }

/** A doc's bar while reading, in a deck's order: the panels (checks, comments), then the actions (Edit, Share). Its
    versions, downloads and source are in the ⋯ beside its name. */
export function ReadBar({ canEdit, onEdit, checks, comments, share }: { canEdit: boolean; onEdit: () => void; checks: Panel & { count: number; pass: boolean; label?: string }; comments: Panel & { count: number }; share?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 max-[900px]:gap-2">
      <div className="flex flex-none items-center gap-0.5">
        <ChecksToggle open={checks.open} count={checks.count} pass={checks.pass} label={checks.label} onClick={checks.onToggle} />
        <CommentsToggle open={comments.open} count={comments.count} onClick={comments.onToggle} />
      </div>
      <BarDivider />
      {canEdit && <Button variant="outline" onClick={onEdit}><Pencil aria-hidden className="!size-3.5" strokeWidth={1.75} />Edit</Button>}
      {share}
    </div>
  )
}

const LINK = 'cursor-pointer font-medium text-ink underline-offset-2 hover:underline disabled:opacity-45'

function IssueList({ label, items, soft }: { label: string; items: string[]; soft?: boolean }) {
  const n = items.length
  if (!n) return null
  const btn = (
    <Button size="sm" variant="ghost" className={cn('max-w-[min(100%,280px)] truncate', soft ? 'text-ink-2' : 'text-warn')} aria-label={`${label}: ${items[0]}`}>
      {n} {label}{n === 1 ? '' : 's'}{n > 1 ? '' : `: ${items[0]}`}
    </Button>
  )
  if (n === 1) return btn
  return (
    <Popover>
      <PopoverTrigger asChild>{btn}</PopoverTrigger>
      <PopoverContent className="w-96 text-[13px]"><ul className="grid gap-1.5">{items.map((msg, i) => <li key={i}>{msg}</li>)}</ul></PopoverContent>
    </Popover>
  )
}

/** A newer version exists (or a save was refused for it): the sentence, then Reload and Copy my text. */
interface Stale { by: string | null; onReload: () => void; onCopy: () => Promise<boolean>; refused: boolean }

interface EditBarProps {
  edit: DocEdit; onDiscard: () => void; onSave: () => void; stale: Stale | null
  checks?: { open: boolean; count: number; pass: boolean; label?: string; onToggle: () => void }
  comments: { open: boolean; count: number; onToggle: () => void }
  source: { open: boolean; onToggle: () => void }
}

export function EditBar({ edit, onDiscard, onSave, stale, checks, comments, source }: EditBarProps) {
  const [copied, setCopied] = useState(false)
  const copy = async () => { if (await stale?.onCopy()) { setCopied(true); window.setTimeout(() => setCopied(false), 2000) } }
  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {stale
          ? (
            <span role={stale.refused ? 'alert' : 'status'} className={cn('flex min-w-0 items-center gap-1.5 text-[13px]', stale.refused ? 'text-warn' : 'text-ink-2')}>
              <span className="truncate">
                {stale.refused ? 'Not saved: ' : ''}{stale.by ? <b className="font-medium text-ink">{stale.by}</b> : 'Someone'} {stale.refused ? 'saved first.' : 'saved a newer version.'}
              </span>
              <button type="button" className={cn(LINK, 'flex-none')} title="Load the newer version. Unsaved changes here are dropped." onClick={stale.onReload}>Reload</button>
              <span aria-hidden className="text-ink-3">·</span>
              <button type="button" className={cn(LINK, 'flex-none')} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy my text'}</button>
            </span>
          )
          : (
            <>
              <IssueList label="warning" items={edit.warnings} soft />
              {edit.error && (
                <span role="alert" className="min-w-0 truncate text-[13px] text-warn">{edit.error}</span>
              )}
            </>
          )}
      </div>
      <SourceToggle open={source.open} onClick={source.onToggle} />
      {checks && <ChecksToggle open={checks.open} count={checks.count} pass={checks.pass} label={checks.label} onClick={checks.onToggle} />}
      <CommentsToggle open={comments.open} count={comments.count} onClick={comments.onToggle} />
      <Button size="sm" variant="ghost" onClick={onDiscard} disabled={edit.saving}>Discard</Button>
      <Button size="sm" onClick={onSave} disabled={edit.saving}>{edit.saving ? 'Saving…' : 'Save'}</Button>
    </div>
  )
}
