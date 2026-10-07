// Scores (spec §5): a run's checks with the judge's verdict folded in, the magic bar, and the summary a report compares.
import { createHash } from 'node:crypto'
import { contentSlide } from './checks'
import type { Case, Check, Run } from './types'

const FATAL = new Set(['F1', 'F2', 'F3', 'R1'])
const GATES = new Set(['S1', 'S2', 'S3', 'F1', 'F2', 'F3', 'R1', 'R3', 'G1', 'G2'])
export const gates = (k: Check): boolean => GATES.has(k.id) || !!k.must
export const isFatal = (k: Check): boolean => FATAL.has(k.id) && !k.ok

/** The code checks, then what the judge decided: F3, the generic questions (G1, G2), the case questions (Q1…) and M1. */
export function allChecks(r: Run, c: Case): Check[] {
  const out = [...r.checks], v = r.verdict, slide = contentSlide(r.deck)?.slide
  if (!slide || !r.deck) return out
  if (!r.unknownFigures.length) out.push({ id: 'F3', ok: true, msg: 'No figures beyond the request' })
  if (!v) return out
  if (r.unknownFigures.length) {
    const made = v.numbers.filter((x) => x.kind === 'invented')
    out.push({ id: 'F3', ok: !made.length, msg: made.length ? `Invented: ${made.map((x) => `${x.value} (${x.why})`).join('; ')}` : `Derived: ${r.unknownFigures.join(', ')}` })
  }
  for (const g of v.generic) out.push({ id: g.id, ok: g.yes, msg: g.why })
  v.case.forEach((a, i) => out.push({ id: `Q${i + 1}`, ok: a.yes, msg: `${c.questions[i]?.q ?? a.q} ${a.why}`, must: c.questions[i]?.must ?? false }))
  out.push({ id: 'M1', ok: v.magic.presentAsIs, msg: v.magic.presentAsIs ? 'Would present it as is' : v.magic.fix })
  return out
}

/** Magic: every gating check passed, and the judge has seen the slide (ask cases have none to see). */
export const isMagic = (r: Run, c: Case, checks = allChecks(r, c)): boolean => (c.ask || !!r.verdict) && checks.filter(gates).every((k) => k.ok)

export interface Rate { n: number; of: number }
export interface Summary {
  done: number; limited: number; errors: number; judged: number
  magic: Rate; fatal: Rate; checks: Record<string, Rate>; groups: Record<string, Rate>; cases: Record<string, Rate>
  versions: string[]; judges: string[]
  /** Each case's fingerprint: a before/after comparison is only fair on cases that did not change. */
  caseHashes: Record<string, string>
}
/** What the agent was asked and how it is judged; a different fingerprint means a different test, not a different result. */
export const caseHash = (c: Case): string => createHash('sha1')
  .update(JSON.stringify([c.prompt, c.style, c.files, c.gold, c.acceptable, c.ask, c.facts, c.questions])).digest('hex').slice(0, 8)
const bump = (m: Record<string, Rate>, k: string, hit: boolean) => { const r = (m[k] ??= { n: 0, of: 0 }); r.of++; if (hit) r.n++ }

/** Rates over finished runs of the given cases; `fatal.n` counts runs with any fatal failure. */
export function summarize(runs: Run[], cases: Case[]): Summary {
  const byId = new Map(cases.map((c) => [c.id, c])), versions = new Set<string>(), judges = new Set<string>()
  const s: Summary = { done: 0, limited: 0, errors: 0, judged: 0, magic: { n: 0, of: 0 }, fatal: { n: 0, of: 0 }, checks: {}, groups: {}, cases: {}, versions: [], judges: [], caseHashes: Object.fromEntries(cases.map((c) => [c.id, caseHash(c)])) }
  for (const r of runs) {
    const c = byId.get(r.caseId)
    if (!c) continue
    if (r.status === 'limited') { s.limited++; continue }
    if (r.status === 'error') { s.errors++; continue }
    s.done++
    if (r.verdict) s.judged++
    const ks = allChecks(r, c), magic = isMagic(r, c, ks)
    s.magic.of++; if (magic) s.magic.n++
    s.fatal.of++; if (ks.some(isFatal)) s.fatal.n++
    for (const k of ks) bump(s.checks, k.id, k.ok)
    bump(s.groups, c.group, magic)
    bump(s.cases, c.id, magic)
    if (r.transcript?.init) versions.add(`Claude Code ${r.transcript.init.version}, ${r.transcript.init.model}`)
    if (r.judgeModel) judges.add(r.judgeModel)
  }
  return { ...s, versions: [...versions], judges: [...judges] }
}
