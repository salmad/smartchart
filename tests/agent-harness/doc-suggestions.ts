/* Live proposeDoc on prose fixtures: validation rate, grouped tables, reels quiet.
   Run from repo root:  npx vite-node tests/agent-harness/doc-suggestions.ts
   Needs OPENROUTER_API_KEY in .env. Writes docs/temp/doc-suggestions-run.md */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { proposeDoc, type CompleteFn } from '../../src/engine/agent/propose'
import { parseDoc } from '../../src/engine/docs/parse'
import { checkProposal } from '../../src/engine/docs/proposals'
import type { DocProposal } from '../../src/engine/docs/proposals'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const envFile = path.join(root, '.env')
const env = Object.fromEntries((() => {
  try { return readFileSync(envFile, 'utf8') } catch { return '' }
})().split('\n').flatMap((l) => {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim())
  return m ? [[m[1], m[2].replace(/^["']|["']$/g, '')]] : []
}))
const KEY = env.OPENROUTER_API_KEY
const MODEL = env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5'

const fixture = (name: string) => readFileSync(path.join(root, 'tests/fixtures/docs', name), 'utf8')

const hasGroupRow = (p: DocProposal) =>
  p.figure?.kind === 'table' && (p.figure.body.table?.rows.some((r) => r.style === 'group') ?? false)

async function main() {
  const outPath = path.join(root, 'docs/temp/doc-suggestions-run.md')
  mkdirSync(path.dirname(outPath), { recursive: true })
  if (!KEY) {
    writeFileSync(outPath, '# Doc suggestions harness\n\nSkipped: `OPENROUTER_API_KEY` not in `.env`.\n')
    console.log('No OPENROUTER_API_KEY; wrote skip note to', outPath)
    return
  }

  const complete: CompleteFn = async ({ messages, max_tokens, temperature, signal }) => {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, temperature: temperature ?? 0.3, max_tokens: max_tokens ?? 4000 }),
      signal,
    })
    const j = await r.json() as { choices?: { message?: { content?: string } }[]; error?: unknown }
    const text = j.choices?.[0]?.message?.content
    if (!text) throw new Error(`model: ${JSON.stringify(j.error ?? j).slice(0, 240)}`)
    return text
  }

  const docs = [
    { name: 'wall-of-text.md', text: fixture('wall-of-text.md') },
    { name: 'reels.md', text: fixture('reels.md') },
  ]
  const lines = [`# Doc suggestions harness (${new Date().toISOString().slice(0, 10)})`, '', `Model: \`${MODEL}\`.`, '']

  let validated = 0
  let total = 0
  let tablesWithGroup = 0
  let tableProposals = 0

  for (const { name, text } of docs) {
    const doc = parseDoc(text).doc
    const proposals = await proposeDoc(doc, { rev: 1, complete, now: () => 1 })
    lines.push(`## ${name}`, '', `Returned **${proposals.length}** proposal(s).`, '')
    for (const p of proposals) {
      total++
      const c = checkProposal(doc, p)
      if (c.ok) validated++
      if (p.figure?.kind === 'table') {
        tableProposals++
        if (hasGroupRow(p)) tablesWithGroup++
      }
      lines.push(`- **${p.label}** (${p.figure?.kind ?? 'text'}) — ${c.ok ? 'valid' : c.error}`)
    }
    lines.push('')
  }

  const rate = total ? Math.round((validated / total) * 100) : 100
  lines.push(
    '## Summary',
    '',
    `- Validate on return: **${validated}/${total}** (${rate}%).`,
    `- Table proposals with group rows: **${tablesWithGroup}/${tableProposals}**.`,
    `- Target: ≥80% validate; categorized tables use group rows; reels doc few or none.`,
    '',
  )
  writeFileSync(outPath, lines.join('\n'))
  console.log('Wrote', outPath)
}

void main()
