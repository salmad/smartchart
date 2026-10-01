/* The deck's name in the bar. A click renames it in place: Enter or clicking away keeps the new name, Esc or an empty
   name puts the old one back. Until it is renamed, a deck is called after its first title. */
import { useState } from 'react'

interface Props {
  name: string
  /** Renaming: set by a click here or by Rename in the deck menu. */
  editing: boolean; onEditing: (on: boolean) => void
  onRename: (name: string) => void
  disabled: boolean
}

export function DeckTitle({ name, editing, onEditing, onRename, disabled }: Props) {
  if (!editing) return (
    <button type="button" onClick={() => onEditing(true)} disabled={disabled} title="Rename"
      className="-mx-1.5 h-8 min-w-0 cursor-text truncate rounded-lg px-1.5 text-[13px] text-ink-2 outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-ink-2">
      {name}
    </button>
  )
  return <NameField name={name} onDone={(next) => { if (next && next !== name) onRename(next); onEditing(false) }} />
}

/** The name as a field, starting from the current name. It grows with its text: an invisible copy sets the width. */
function NameField({ name, onDone }: { name: string; onDone: (next: string | null) => void }) {
  const [draft, setDraft] = useState(name)
  const done = (keep: boolean) => onDone(keep ? draft.trim() : null)
  return (
    <span className="-mx-1.5 inline-grid h-8 min-w-0 max-w-full items-center rounded-lg bg-panel px-1.5 text-[13px] shadow-[0_0_0_1px_theme(colors.line-2)]">
      <span aria-hidden className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre">{draft || ' '}</span>
      <input autoFocus onFocus={(e) => e.currentTarget.select()} value={draft} aria-label="Deck name" maxLength={200} spellCheck={false}
        onChange={(e) => setDraft(e.target.value)} onBlur={() => done(true)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); done(true) } if (e.key === 'Escape') { e.preventDefault(); done(false) } }}
        className="col-start-1 row-start-1 w-full min-w-[4ch] border-0 bg-transparent p-0 text-ink outline-none" />
    </span>
  )
}
