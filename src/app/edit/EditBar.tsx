/* The bar under the slide while editing (spec 4): template, what a switch keeps and drops, the warnings, Discard and Save. */
import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { MENU, OFFERED } from '@/engine/slides/schema'
import { switchTemplate } from '@/engine/slides/edit'
import type { Style, TemplateId } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

const NAME: Record<TemplateId, string> = { chart: 'Chart', pair: 'Two charts', table: 'Table', number: 'Number', steps: 'Steps', cards: 'Cards', summary: 'Summary', cover: 'Cover', section: 'Chapter divider' }

export function EditBar({ edit, deckStyle: style, onDiscard }: { edit: SlideEdit; deckStyle: Style; onDiscard: () => void }) {
  const [pick, setPick] = useState<TemplateId | null>(null)
  const preview = pick ? switchTemplate(edit.draft, pick, style) : null
  const n = edit.issues.length
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-[10px] bg-panel px-3 py-2 shadow-[0_0_0_1px_theme(colors.line)]">
      <Select value={pick ?? edit.draft.template} onValueChange={(v) => setPick(v === edit.draft.template ? null : v as TemplateId)}>
        <SelectTrigger aria-label="Template" className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>{OFFERED.map((id) => <SelectItem key={id} value={id} title={MENU[id].summary}>{NAME[id]}</SelectItem>)}</SelectContent>
      </Select>
      {preview && pick ? (
        <p className="flex min-w-0 items-center gap-2 text-[13px] text-ink-3">
          <span className="truncate">Keeps: {preview.keeps.join(', ') || 'nothing'} · Drops: {preview.drops.join(', ') || 'nothing'}</span>
          <Button size="sm" onClick={() => { edit.replace(preview.slide, preview.samples); setPick(null) }}>Switch</Button>
          <Button size="sm" variant="ghost" onClick={() => setPick(null)}>Cancel</Button>
        </p>
      ) : <span className="flex-1" />}
      {n > 0 && (
        <Popover>
          <PopoverTrigger asChild><Button size="sm" variant="ghost" className="text-warn">{n} warning{n === 1 ? '' : 's'}</Button></PopoverTrigger>
          <PopoverContent className="w-96 text-[13px]"><ul className="grid gap-1.5">{edit.issues.map((x, i) => <li key={i}>{x.msg}</li>)}</ul></PopoverContent>
        </Popover>
      )}
      {edit.error && <span role="alert" className="text-[13px] text-warn">{edit.error}</span>}
      <Button variant="ghost" onClick={onDiscard} disabled={edit.saving}>Discard</Button>
      <Button onClick={() => void edit.save()} disabled={edit.saving}>{edit.saving ? 'Saving…' : 'Save'}</Button>
    </div>
  )
}
