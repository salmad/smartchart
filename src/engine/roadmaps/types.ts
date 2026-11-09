export const STATUSES = ['backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const
export type Status = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
}

export type FieldType = 'choice' | 'text' | 'number' | 'date' | 'person'

export interface FieldOption {
  id: string
  name: string
  emoji?: string
}

export interface FieldDef {
  id: string
  name: string
  type: FieldType
  options?: FieldOption[]
}

/** Option id, plain text, number, ISO date, or workspace user id. */
export type FieldValue = string | number

export interface Issue {
  id: string
  number: number
  parentId: string | null
  sortKey: string
  title: string
  status: Status
  assignee: string | null
  start: string | null
  due: string | null
  fields: Record<string, FieldValue>
  bodyRev: number
  seq: number
  createdBy: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Roadmap {
  id: string
  workspaceId: string
  name: string
  prefix: string
  fields: FieldDef[]
  nextNumber: number
  seq: number
}

export interface IssueEvent {
  issueId: string | null
  by: string
  byClient: string
  at: number
  what: 'created' | 'set' | 'moved' | 'commented' | 'deleted' | 'restored' | 'fields'
  changes: { path: string; from: unknown; to: unknown }[]
}

export interface RoadmapState {
  roadmap: Roadmap
  issues: Issue[]
}

export interface IssueComment {
  id: string
  by: string
  text: string
  at: number
  replyTo?: string
}

export const MAX_DEPTH = 12
export const MAX_FIELDS = 30
export const MAX_OPTIONS = 100
export const MAX_TITLE = 300
export const PREFIX = /^[A-Z][A-Z0-9]{1,5}$/
