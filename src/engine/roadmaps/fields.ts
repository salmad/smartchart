import type { FieldDef, FieldType, Issue, Roadmap } from './types.js'
import { MAX_FIELDS, MAX_OPTIONS } from './types.js'

const FIELD_TYPES = new Set<FieldType>(['choice', 'text', 'number', 'date', 'person'])

function normName(name: string): string {
  return name.trim().toLowerCase()
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function checkFieldDefs(defs: FieldDef[]): 'ok' | string {
  if (defs.length > MAX_FIELDS) return `A roadmap has at most ${MAX_FIELDS} fields.`
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const def of defs) {
    if (typeof def.name !== 'string') return 'Every field needs a name.'
    const name = def.name.trim()
    if (!name) return 'Every field needs a name.'
    if (typeof def.id !== 'string') return 'Every field needs an id.'
    if (!def.id.trim()) return 'Every field needs an id.'
    if (ids.has(def.id)) return `Field id “${def.id}” is already used.`
    ids.add(def.id)
    const key = normName(name)
    if (names.has(key)) return `Field name “${name}” is already used.`
    names.add(key)
    if (typeof def.type !== 'string' || !FIELD_TYPES.has(def.type)) return `Field “${name}” has an unknown type.`
    if (def.type === 'choice') {
      const options = Array.isArray(def.options) ? def.options : []
      if (!options.length) return `Field “${name}” needs at least one option.`
      if (options.length > MAX_OPTIONS) return `Field “${name}” has at most ${MAX_OPTIONS} options.`
      const optIds = new Set<string>()
      const optNames = new Set<string>()
      for (const opt of options) {
        if (!opt.id.trim()) return `Field “${name}” has an option without an id.`
        if (optIds.has(opt.id)) return `Field “${name}” reuses option id “${opt.id}”.`
        optIds.add(opt.id)
        const on = normName(opt.name)
        if (!on) return `Field “${name}” has an option without a name.`
        if (optNames.has(on)) return `Field “${name}” reuses option name “${opt.name}”.`
        optNames.add(on)
      }
    } else if (def.options?.length) {
      return `Only choice fields have options.`
    }
  }
  return 'ok'
}

export function checkValue(def: FieldDef, v: unknown, members?: string[]): 'ok' | string {
  const name = def.name.trim()
  switch (def.type) {
    case 'choice': {
      if (typeof v !== 'string') return `“${name}” must be one of its options.`
      const hit = def.options?.some((o) => o.id === v)
      if (!hit) return `“${name}” has no option “${v}”.`
      return 'ok'
    }
    case 'text':
      if (typeof v !== 'string') return `“${name}” must be text.`
      return 'ok'
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return `“${name}” must be a number.`
      return 'ok'
    case 'date':
      if (typeof v !== 'string' || !isIsoDate(v)) return `“${name}” must be a date (YYYY-MM-DD).`
      return 'ok'
    case 'person':
      if (typeof v !== 'string' || !v.trim()) return `“${name}” must be a workspace member.`
      if (members && !members.includes(v)) return `“${name}” must be a workspace member.`
      return 'ok'
    default:
      return `“${name}” has an unknown type.`
  }
}

export function checkValues(defs: FieldDef[], values: Record<string, unknown>, members?: string[]): 'ok' | string {
  const byId = new Map(defs.map((d) => [d.id, d]))
  for (const [fieldId, v] of Object.entries(values)) {
    const def = byId.get(fieldId)
    if (!def) return 'No such field.'
    const r = checkValue(def, v, members)
    if (r !== 'ok') return r
  }
  return 'ok'
}

/** Validates only the keys present in `patch` (null means remove — not validated). */
export function checkFieldPatch(
  defs: FieldDef[],
  patch: Record<string, unknown>,
  members: string[],
): 'ok' | string {
  const byId = new Map(defs.map((d) => [d.id, d]))
  for (const [fieldId, v] of Object.entries(patch)) {
    if (v === null) continue
    const def = byId.get(fieldId)
    if (!def) return 'No such field.'
    const r = checkValue(def, v, members)
    if (r !== 'ok') return r
  }
  return 'ok'
}

/** Issues whose stored values are invalid under `defs`, with those keys removed. */
export function pruneInvalidFieldValues(issues: Issue[], defs: FieldDef[], members: string[]): Issue[] {
  const byId = new Map(defs.map((d) => [d.id, d]))
  const out: Issue[] = []
  for (const row of issues) {
    const fields = { ...row.fields }
    let touched = false
    for (const [fieldId, v] of Object.entries(row.fields)) {
      const def = byId.get(fieldId)
      if (!def || checkValue(def, v, members) !== 'ok') {
        delete fields[fieldId]
        touched = true
      }
    }
    if (touched) out.push({ ...row, fields })
  }
  return out
}

/** Issues that had a value for fieldId, with that key removed. */
export function stripField(issues: Issue[], fieldId: string): Issue[] {
  const out: Issue[] = []
  for (const i of issues) {
    if (!(fieldId in i.fields)) continue
    const fields = { ...i.fields }
    delete fields[fieldId]
    out.push({ ...i, fields })
  }
  return out
}

export function keyOf(r: Roadmap, i: Pick<Issue, 'number'>): string {
  return `${r.prefix}-${i.number}`
}
