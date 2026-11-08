/* proposeDoc: Occam's in-app structure suggestions (Haiku via /api/glm). MCP agents use propose_block instead. */
import { complete as defaultComplete, type ChatMessage } from './llm.js'
import { describe as card, MENU } from '../slides/schema.js'
import { identify } from '../docs/ops.js'
import { readabilityChecks } from '../docs/readability.js'
import type { DocCheck } from '../docs/checks.js'
import { checkProposal, type DocProposal, type ProposalMode } from '../docs/proposals.js'
import { CALLOUT_FIELDS } from '../docs/validate.js'
import { FIGURE_KINDS, type Block, type Doc, type FigureBody, type FigureKind } from '../docs/types.js'

export type CompleteFn = typeof defaultComplete

const MAX = 5

type RawProposal = {
  blockIds: string[]
  mode: ProposalMode
  kind: string
  label: string
  why: string
  body: unknown
}

const isFigureKind = (k: string): k is FigureKind => (FIGURE_KINDS as readonly string[]).includes(k)

const lineFor = (id: string, block: Block): string => {
  switch (block.type) {
    case 'heading': return `${'#'.repeat(block.level)} ${block.text} {#${id}}`
    case 'paragraph': return `${block.text} {#${id}}`
    case 'bullets': return block.items.map((x) => `- ${x}`).join('\n') + ` {#${id}}`
    case 'numbered': return block.items.map((x, i) => `${i + 1}. ${x}`).join('\n') + ` {#${id}}`
    case 'quote': return `> ${block.text} {#${id}}`
    case 'divider': return `--- {#${id}}`
    case 'code': return `\`\`\`${block.lang}\n${block.text}\n\`\`\` {#${id}}`
    case 'figure': return `\`\`\`occam:${block.kind} {#${id}}\n${JSON.stringify(block.body, null, 2)}\n\`\`\``
    case 'raw': return block.text
  }
}

export function docMarkdownWithIds(doc: Doc): string {
  const head = [`title: ${doc.title}`, doc.subtitle !== undefined && `subtitle: ${doc.subtitle}`].filter(Boolean)
  const body = identify(doc).map(({ id, block }) => lineFor(id, block)).join('\n\n')
  return `---\n${head.join('\n')}\n---\n\n${body}\n`
}

function catalogue(): string {
  return FIGURE_KINDS.map((kind) => {
    if (kind === 'callout') {
      const max = CALLOUT_FIELDS.text.max ?? 240
      return `callout: boxed note; text max ${max} characters; tones note | decision | risk`
    }
    const c = card(kind as Parameters<typeof card>[0], 'consulting')
    const extra = kind === 'table'
      ? 'Up to 20 rows. Prefer grouped tables: use group rows when rows fall into categories. Table cells max 40 characters (80 in the last column).'
      : kind === 'steps' ? '2–5 steps.' : kind === 'cards' ? '2–4 cards.' : ''
    return `${kind}: ${MENU[kind].summary}. ${[...c.rules, extra].filter(Boolean).join(' ')}`
  }).join('\n')
}

const RULES = `Up to ${MAX} suggestions, best first (most reading time saved, section main points first).
Each suggestion targets adjacent blockIds only. mode is replace or insert.
Prefer grouped tables when rows fall into categories; steps for sequences; value cards for figures in sentences; bold-label bullets for long paragraphs.
Text suggestions keep every word (kind "text", body is Markdown). Figure suggestions may condense only if every number, name and quoted phrase is kept; otherwise use insert above the block.
Never invent figures or sources. Every number must come from the named blocks.
Reply with JSON only: {"proposals":[{"blockIds":["…"],"mode":"replace"|"insert","kind":"table"|"chart"|…|"text","label":"≤40 chars","why":"one line","body":{…}|"markdown"}]}. Omit id, by and at.`

export function proposeMessages(doc: Doc, failed: DocCheck[]): ChatMessage[] {
  const issues = failed.filter((c) => /^D[4-6]$/.test(c.id) && !c.ok).map((c) => `${c.blockId}: [${c.id}] ${c.msg}`).join('\n')
  return [
    { role: 'system', content: `You restructure consulting docs so they read through exhibits, not walls of text.\n\n${RULES}\n\nFigure catalogue:\n${catalogue()}` },
    { role: 'user', content: `Doc (Markdown, blockIds in {#…}):\n${docMarkdownWithIds(doc)}\n\nFailed readability checks:\n${issues || '(none listed)'}` },
  ]
}

function repairMessages(doc: Doc, bad: { raw: RawProposal; error: string }[]): ChatMessage[] {
  return [
    { role: 'system', content: `Fix Occam doc proposals that failed validation. Keep the same blockIds and intent. ${RULES}` },
    { role: 'user', content: `Doc excerpt:\n${docMarkdownWithIds(doc).slice(0, 12_000)}\n\nInvalid proposals (fix or drop):\n${JSON.stringify(bad.map((b) => ({ ...b.raw, error: b.error })))}` },
  ]
}

export function parseProposals(text: string): RawProposal[] {
  let o: { proposals?: unknown } | null = null
  try { o = JSON.parse(String(text).match(/\{[\s\S]*\}/)?.[0] ?? 'null') } catch { return [] }
  if (!Array.isArray(o?.proposals)) return []
  return o.proposals.filter((p): p is RawProposal =>
    !!p && Array.isArray(p.blockIds) && p.blockIds.every((x: unknown) => typeof x === 'string')
    && (p.mode === 'replace' || p.mode === 'insert') && typeof p.label === 'string' && typeof p.why === 'string' && typeof p.kind === 'string')
}

const toProposal = (raw: RawProposal, rev: number, at: number, id: string): DocProposal => {
  const base = { id, blockIds: raw.blockIds, mode: raw.mode, label: raw.label.trim().slice(0, 40), why: raw.why.trim().slice(0, 160), by: 'Occam', at, rev }
  if (raw.kind === 'text') return { ...base, markdown: String(raw.body ?? '') }
  if (!isFigureKind(raw.kind)) return { ...base, markdown: String(raw.body ?? '') }
  return { ...base, figure: { kind: raw.kind, body: raw.body as FigureBody } }
}

const accept = (doc: Doc, list: RawProposal[], rev: number, at: number): DocProposal[] => {
  const out: DocProposal[] = []
  for (let i = 0; i < list.length && out.length < MAX; i++) {
    const id = `p_${at.toString(36)}_${i}`
    const p = toProposal(list[i], rev, at, id)
    const c = checkProposal(doc, p)
    if (c.ok) out.push({ ...p, mode: c.mode })
  }
  return out
}

const splitValid = (doc: Doc, list: RawProposal[], rev: number, at: number): { good: DocProposal[]; bad: { raw: RawProposal; error: string }[] } => {
  const good: DocProposal[] = []
  const bad: { raw: RawProposal; error: string }[] = []
  for (let i = 0; i < list.length; i++) {
    const id = `p_${at.toString(36)}_${i}`
    const p = toProposal(list[i], rev, at, id)
    const c = checkProposal(doc, p)
    if (c.ok) good.push({ ...p, mode: c.mode })
    else bad.push({ raw: list[i], error: c.error })
  }
  return { good: good.slice(0, MAX), bad }
}

/** In-app only: uses injectable complete (default: Haiku via /api/glm). Returns [] when the doc already reads well. */
export async function proposeDoc(
  doc: Doc,
  opts: { rev: number; complete?: CompleteFn; signal?: AbortSignal; now?: () => number },
): Promise<DocProposal[]> {
  const reads = readabilityChecks(doc)
  const d7ok = reads.find((c) => c.id === 'D7')?.ok ?? true
  const d46 = reads.some((c) => /^D[4-6]$/.test(c.id) && !c.ok)
  if (d7ok && !d46) return []
  const complete = opts.complete ?? defaultComplete
  const at = opts.now?.() ?? Date.now()
  const failed = reads.filter((c) => !c.ok)
  let text: string
  try {
    text = await complete({ messages: proposeMessages(doc, failed), max_tokens: 4000, temperature: 0.4, signal: opts.signal })
  } catch {
    return []
  }
  const first = parseProposals(text)
  let { good, bad } = splitValid(doc, first, opts.rev, at)
  if (bad.length) {
    try {
      const repaired = await complete({ messages: repairMessages(doc, bad), max_tokens: 4000, temperature: 0.3, signal: opts.signal })
      const extra = accept(doc, parseProposals(repaired), opts.rev, at + 1)
      const seen = new Set(good.map((p) => p.blockIds.join(',')))
      for (const p of extra) {
        const k = p.blockIds.join(',')
        if (!seen.has(k) && good.length < MAX) { seen.add(k); good.push(p) }
      }
    } catch { /* keep partial good */ }
  }
  return good.slice(0, MAX)
}
