/* A doc's checks: every figure through the slide schema with the doc's limits, and the doc's own rules (a title, one
   id per heading or figure, links that land). They report; they never change the doc. */
import { checkFields, validateComponent, type FieldDef, type Limits } from '../slides/schema.js'
import { resolveAccent } from '../slides/colours.js'
import type { Validation } from '../types.js'
import { plain } from '../slides/schema.js'
import { depthOf } from './nest.js'
import { MAX_LIST_DEPTH, type Doc } from './types.js'

/** A doc table may run to 20 rows (twelve markets need more than a slide's 8); a figure takes its own height. */
export const DOC_LIMITS: Limits = { tableRows: 20, fixedHeight: false }
export const CALLOUT_FIELDS: Record<string, FieldDef> = {
  tone: { type: 'enum', desc: '`note`: context to keep in mind. `decision`: what was decided. `risk`: what could go wrong.', required: true, values: ['note', 'decision', 'risk'] },
  label: { type: 'text', desc: 'Optional label in place of Note, Decision or Risk.', max: 24 },
  text: { type: 'markup', desc: 'The callout, one or two sentences.', required: true, max: 240 },
}
const LINK = /\]\(#([\w-]+)\)/g

/** Every string inside a value: where a link can be written. */
const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [])

export function validateDoc(doc: Doc): Validation {
  const out: Validation = { errors: [], warnings: [] }
  if (!doc.title.trim()) out.errors.push("title: required. The doc's title, in the front matter.")
  if (doc.theme && doc.theme !== 'ink' && doc.theme !== 'paper') out.errors.push(`theme: "${String(doc.theme)}" is not a theme. Use ink or paper.`)
  if (doc.accent !== undefined) {
    const err = /^#[0-9a-f]{6}$/i.test(doc.accent) ? resolveAccent(doc.theme === 'ink' ? 'ink' : 'paper', doc.accent).error : 'a colour as #RRGGBB.'
    if (err) out.errors.push(`accent: ${err}`)
  }
  const ids = doc.blocks.flatMap((b) => (b.type === 'heading' || b.type === 'figure' ? [b.id] : []))
  new Set(ids.filter((id, i) => ids.indexOf(id) !== i)).forEach((id) => out.errors.push(`#${id}: used by more than one heading or figure.`))
  for (const b of doc.blocks) {
    if ((b.type === 'bullets' || b.type === 'numbered') && depthOf(b) > MAX_LIST_DEPTH) out.errors.push(`list "${plain(b.items[0] ?? '').slice(0, 30)}": nests ${depthOf(b)} levels; ${MAX_LIST_DEPTH} at most.`)
    if (b.type !== 'figure') continue
    const r = b.kind === 'callout' ? checkFields(CALLOUT_FIELDS, b.body, 'consulting') : validateComponent(b.kind, b.body, 'consulting', DOC_LIMITS)
    r.errors.forEach((e) => out.errors.push(`#${b.id}.${e}`))
    r.warnings.forEach((w) => out.warnings.push(`#${b.id}.${w}`))
  }
  const known = new Set(ids), dead = new Set<string>()
  for (const s of strings(doc.blocks)) for (const m of s.matchAll(LINK)) if (!known.has(m[1])) dead.add(m[1])
  dead.forEach((id) => out.warnings.push(`link #${id}: no heading or figure has this id.`))
  return out
}
