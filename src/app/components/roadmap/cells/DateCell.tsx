interface Props {
  value: string | null
  label: string
  disabled?: boolean
  onPick: (iso: string | null) => void
}

export function DateCell({ value, label, disabled, onPick }: Props) {
  return (
    <input
      type="date"
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onPick(e.target.value || null)}
      className="w-full min-w-0 rounded border-0 bg-transparent px-1 py-0.5 text-[12px] text-ink-2 hover:bg-raise focus:bg-raise focus:outline-none focus:ring-1 focus:ring-line disabled:opacity-50"
      aria-label={label}
    />
  )
}
