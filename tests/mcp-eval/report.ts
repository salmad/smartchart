// The report (markdown, for reading and committing as a baseline) and the gallery (every slide at full size).
import { allChecks, gates, isFatal, isMagic, type Rate, type Summary } from './scores'
import type { Case, Run } from './types'

const pct = (r: Rate | undefined) => (r && r.of ? Math.round((100 * r.n) / r.of) : null)
const cell = (r: Rate | undefined) => { const p = pct(r); return p === null || !r ? '–' : `${p}% (${r.n}/${r.of})` }
const delta = (a: Rate | undefined, b: Rate | undefined) => { const x = pct(a), y = pct(b); return x === null || y === null ? '' : `${x > y ? '+' : ''}${x - y}` }
const byCheck = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

export function reportMd(label: string, s: Summary, runs: Run[], cases: Case[], base?: { label: string; s: Summary }): string {
  const byId = new Map(cases.map((c) => [c.id, c])), vs = base ? ` | vs ${base.label} (points)` : '', sep = base ? '|---|---|---|' : '|---|---|'
  const row = (name: string, a: Rate | undefined, b?: Rate) => `| ${name} | ${cell(a)}${base ? ` | ${delta(a, b)}` : ''} |`
  const review = runs.flatMap((r) => {
    const c = byId.get(r.caseId)
    if (!c) return []
    if (r.status !== 'done') return [`### ${r.id}: ${r.status}`, r.error ?? '', '']
    const ks = allChecks(r, c), failed = ks.filter((k) => !k.ok)
    if (!failed.length) return []
    return [`### ${r.id}${isMagic(r, c, ks) ? ' (magic)' : ''}${ks.some(isFatal) ? ' · fatal' : ''}`, ...failed.map((k) => `- ${gates(k) ? `**${k.id}**` : k.id}: ${k.msg}`), '']
  })
  return [
    `# MCP slide eval: ${label}`, '',
    `${s.versions.join('; ') || 'No agent runs'}. Judge: ${s.judges.join(', ') || 'none yet'}. ${s.done} runs done (${s.judged} judged), ${s.limited} limited, ${s.errors} errors.`,
    ...(base && base.s.versions.join() !== s.versions.join() ? ['', `Note: the baseline ran on ${base.s.versions.join('; ')}. Differences may come from Claude Code, not Occam.`] : []),
    '', `| Measure | Result${vs} |`, sep, row('Magic rate', s.magic, base?.s.magic), row('Fatal rate', s.fatal, base?.s.fatal),
    '', noise(s, base?.s), ...(base ? changed(s, base.s) : []),
    '', '## By group', '', `| Group | Magic${vs} |`, sep, ...Object.keys(s.groups).map((g) => row(g, s.groups[g], base?.s.groups[g])),
    '', '## Per check', '', `| Check | Pass${vs} |`, sep, ...Object.keys(s.checks).sort(byCheck).map((k) => row(k, s.checks[k], base?.s.checks[k])),
    '', '## Runs at magic, per case', '', ...(base
      ? [`| Case | Magic | ${base.label} | Points | |`, '|---|---|---|---|---|', ...Object.keys(s.cases).map((id) => `| ${id} | ${cell(s.cases[id])} | ${cell(base.s.cases[id])} | ${delta(s.cases[id], base.s.cases[id])} | ${caseNote(id, s, base.s)} |`)]
      : [Object.entries(s.cases).map(([id, r]) => `${id} ${r.n}/${r.of}`).join(' · ')]),
    '', '## What confused the agent, by where to fix it', '', ...confusions(runs),
    '', '## For review', '', ...review,
  ].join('\n')
}

/** How far the magic rate moves by chance at these run counts (two standard errors); smaller changes prove nothing. */
function noise(s: Summary, b?: Summary): string {
  const v = (r: Rate) => { const p = Math.min(0.9, Math.max(0.1, r.of ? r.n / r.of : 0.5)); return r.of ? (p * (1 - p)) / r.of : 0 }
  const band = Math.round(200 * Math.sqrt(v(s.magic) + (b ? v(b.magic) : 0)))
  return `Noise: a magic-rate change under ±${band} points can be chance at ${s.magic.of}${b ? ` and ${b.magic.of}` : ''} runs. One case's runs move by chance even more: read per-case changes as hints, with --n=3 or more.`
}
const caseNote = (id: string, s: Summary, b: Summary) =>
  !b.cases[id] ? 'new case' : !b.caseHashes?.[id] ? 'not fingerprinted' : b.caseHashes[id] !== s.caseHashes[id] ? 'case changed' : ''
/** Warns when the baseline ran different tests: then only the unchanged cases compare like with like. */
function changed(s: Summary, b: Summary): string[] {
  const ids = Object.keys(s.cases), moved = ids.filter((id) => caseNote(id, s, b))
  return moved.length ? ['', `**${moved.length} of ${ids.length} cases are new, changed or not fingerprinted since the baseline.** The headline mixes a change in the tests with a change in SmartChart; compare the unchanged cases in the per-case table.`] : []
}

/** The judge's diagnoses grouped by source: the fix list. */
function confusions(runs: Run[]): string[] {
  const by = new Map<string, string[]>()
  for (const r of runs) for (const x of r.verdict?.confusedBy ?? [])
    by.set(x.source, [...(by.get(x.source) ?? []), `- **${r.id}** ${x.mismatch}. “${x.quote}”: ${x.why} Fix: ${x.fix}`])
  return by.size ? [...by].flatMap(([source, items]) => [`### ${source}`, '', ...items, '']) : ['Nothing.']
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch)
export function galleryHtml(label: string, runs: Run[], cases: Case[], shot: (png: string) => string): string {
  const byId = new Map(cases.map((c) => [c.id, c]))
  const items = runs.flatMap((r) => {
    const c = byId.get(r.caseId)
    if (!c || r.status !== 'done') return []
    const ks = allChecks(r, c), magic = isMagic(r, c, ks), failed = ks.filter((k) => !k.ok)
    const imgs = r.measured.map((m) => `<img src="${esc(shot(m.png))}" alt="${esc(r.id)}">`).join('')
    return [`<section class="${magic ? 'magic' : 'miss'}"><h2>${esc(r.id)} ${magic ? '✓ magic' : '✗'}</h2><p class="req">${esc(c.prompt)}</p>${imgs || '<p>No slide.</p>'}<p class="reply">${esc(r.transcript?.finalText ?? '')}</p><ul>${failed.map((k) => `<li><b>${esc(k.id)}</b> ${esc(k.msg)}</li>`).join('')}</ul></section>`]
  })
  return `<!doctype html><html><head><meta charset="utf-8"><title>MCP eval ${esc(label)}</title><style>
body{font:15px/1.5 system-ui,sans-serif;margin:24px;background:#fff;color:#111}section{margin:0 0 48px}img{display:block;width:100%;max-width:1920px;border:1px solid #ddd}
.req,.reply{color:#555;white-space:pre-wrap}body.only-miss .magic{display:none}</style></head><body>
<h1>MCP eval ${esc(label)}</h1><label><input type="checkbox" onchange="document.body.classList.toggle('only-miss',this.checked)"> Only runs short of magic</label>
${items.join('\n')}</body></html>`
}
