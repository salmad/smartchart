import { ChevronDown, ChevronRight } from 'lucide-react'
import type { FieldDef, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { TableRow } from '@/engine/roadmaps/view'
import { keyOf } from '@/engine/roadmaps/fields'
import { progress } from '@/engine/roadmaps/rollup'
import { StatusGlyph } from './StatusGlyph'
import { ProgressBar } from './ProgressBar'
import { cn } from '@/app/lib/utils'

interface ColProps {
  roadmap: Roadmap
  fields: FieldDef[]
  columns: string[]
  members: MemberLite[]
  allIssues: Issue[]
  colCount: number
}

interface IssueProps extends ColProps {
  row: Extract<TableRow, { kind: 'issue' }>
  onToggleCollapse: (id: string) => void
}

interface GroupProps extends ColProps {
  row: Extract<TableRow, { kind: 'group' }>
}

export function IssueGroupRow({ row, colCount }: GroupProps) {
  return (
    <tr className="h-[34px] border-b border-line/40 bg-panel text-[12px] text-ink-2">
      <td colSpan={colCount} className="px-4">
        <div className="flex items-center gap-3">
          <span className="font-medium text-ink">{row.label}</span>
          <span className="text-ink-3">
            {row.count} {row.count === 1 ? 'issue' : 'issues'}
          </span>
          {row.progress !== null && (
            <span className="ml-auto">
              <ProgressBar value={row.progress} />
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

export function IssueDataRow({ row, roadmap, fields, columns, members, allIssues, onToggleCollapse }: IssueProps) {
  const { issue, depth, dim, hasChildren, open } = row
  const parentProg = progress(allIssues, issue.id)
  const member = members.find((m) => m.id === issue.assignee)

  return (
    <tr className={cn('h-[34px] border-b border-line/40 text-[12px] text-ink', dim && 'opacity-45')}>
      <td className="w-8 px-2">
        <StatusGlyph status={issue.status} />
      </td>
      <td className="w-24 whitespace-nowrap px-2 font-mono text-ink-3">{keyOf(roadmap, issue)}</td>
      <td className="min-w-[200px] max-w-[420px] px-2">
        <div className="flex min-w-0 items-center gap-1">
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} className="inline-block w-4 shrink-0" aria-hidden />
          ))}
          {hasChildren ? (
            <button
              type="button"
              className="shrink-0 text-ink-3 hover:text-ink"
              aria-label={open ? `Collapse ${issue.title}` : `Expand ${issue.title}`}
              onClick={() => onToggleCollapse(issue.id)}
            >
              {open ? <ChevronDown className="size-3" strokeWidth={2} /> : <ChevronRight className="size-3" strokeWidth={2} />}
            </button>
          ) : (
            <span className="inline-block w-3 shrink-0" aria-hidden />
          )}
          <span className="truncate">{issue.title}</span>
        </div>
      </td>
      {columns.map((col) => (
        <td key={col} className="w-28 whitespace-nowrap px-2 text-ink-2">
          {cellValue(col, issue, fields, member?.name ?? '')}
        </td>
      ))}
      <td className="w-20 px-2">
        {parentProg !== null && <ProgressBar value={parentProg} />}
      </td>
    </tr>
  )
}

function cellValue(col: string, issue: Issue, fields: FieldDef[], assigneeName: string): string {
  if (col === 'assignee') return assigneeName
  if (col === 'start') return shortDate(issue.start)
  if (col === 'due') return shortDate(issue.due)
  const def = fields.find((f) => f.id === col)
  if (!def) return ''
  const raw = issue.fields[col]
  if (raw === undefined) return ''
  if (def.type === 'choice') {
    const sid = String(raw)
    return def.options?.find((o) => o.id === sid)?.name ?? sid
  }
  return String(raw)
}

function shortDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
