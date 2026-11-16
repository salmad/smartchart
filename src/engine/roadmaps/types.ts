export type Role = 'owner' | 'editor' | 'viewer'

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
  /** The first day of the sprint it is in. */
  sprint: string | null
  /** How many times rollover has moved it to a later sprint. */
  carried: number
  fields: Record<string, FieldValue>
  bodyRev: number
  seq: number
  createdBy: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

/** A repeating sprint rhythm; `rolled` is the start of the last sprint unfinished work was moved into. */
export interface SprintRhythm {
  start: string
  weeks: number
  rolled: string | null
}

export interface Roadmap {
  id: string
  workspaceId: string
  name: string
  prefix: string
  fields: FieldDef[]
  nextNumber: number
  sprints: SprintRhythm | null
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

export interface MemberLite {
  id: string
  name: string
  email: string
}

export type LoadedRoadmap = RoadmapState & { role: Role; members: MemberLite[] }

export type Changes = { seq: number; roadmap: Roadmap | null; issues: Issue[]; events: IssueEvent[] }

export type IssueDetail = { body: string; bodyRev: number; comments: IssueComment[]; events: IssueEvent[] }

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
