// The MCP slide eval, one command: run each case through Claude Code against the app's /mcp/v1, measure, judge, report.
// Spec: docs/superpowers/specs/2026-10-03-mcp-slide-eval-design.md. Usage: tests/mcp-eval/README.md.
import { execSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { emptyAccount, readOnlyDeck, type Account } from './account'
import { choiceChecks, contentSlide, factChecks, renderChecks, requestText, wiringChecks } from './checks'
import { agentArgs, guardInit, isLimited, judgeArgs, parseStream, runClaude } from './claude'
import { genericQuestions, judgePrompt, judgeSchema } from './judge'
import { openMeasurer, type Measurer } from './measure'
import { galleryHtml, reportMd } from './report'
import { summarize, type Summary } from './scores'
import type { Case, Measured, Results, Run, Verdict } from './types'

const HERE = path.dirname(fileURLToPath(import.meta.url)), FILES = path.join(HERE, 'files'), BASELINES = path.join(HERE, 'baselines')
const arg: Record<string, string> = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--'))
  .map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || 'true'] }))
const git = (cmd: string) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' } }
const label = arg.label ?? `${git('git rev-parse --short HEAD') || 'nogit'}${git('git status --porcelain') ? '-dirty' : ''}-${new Date().toISOString().slice(0, 10)}`
const url = arg.url ?? 'http://localhost:5173/mcp/v1', app = arg.app ?? 'http://localhost:5173'
const OUT = path.join(HERE, 'out', label), RESULTS = path.join(OUT, 'results.json')
const cases = (JSON.parse(readFileSync(path.join(HERE, 'cases.json'), 'utf8')) as Case[])
  .filter((c) => !arg.only || arg.only.split(',').includes(c.id)).filter((c) => !arg.group || c.group === arg.group)
const results: Results = existsSync(RESULTS) ? (JSON.parse(readFileSync(RESULTS, 'utf8')) as Results) : {}
const save = () => writeFileSync(RESULTS, JSON.stringify(results, null, 1))
/** Stops the whole eval: the run would not be the user's experience on the subscription. */
class Stop extends Error {}

async function runCase(c: Case, i: number, account: Account, measurer: Measurer): Promise<Run> {
  const run: Run = { id: `${c.id}#${i}`, caseId: c.id, n: i, status: 'error', transcript: null, deck: null, measured: [], checks: [], unknownFigures: [] }
  try {
    await emptyAccount(account)
    const dir = mkdtempSync(path.join(tmpdir(), 'mcp-eval-')), work = path.join(dir, 'work'), config = path.join(dir, 'mcp.json')
    mkdirSync(work)
    for (const f of c.files) cpSync(path.join(FILES, f), path.join(work, f))
    writeFileSync(config, JSON.stringify({ mcpServers: { smartchart: { type: 'http', url, headers: { Authorization: `Bearer ${account.key}` } } } }))
    const out = await runClaude(agentArgs(arg.model ?? 'sonnet', config), c.prompt, work, 600_000)
    const t = parseStream(out.lines), bad = guardInit(t.init, ['smartchart'])
    if (bad) throw new Stop(bad)
    if (isLimited(t, out.stderr)) return { ...run, status: 'limited', transcript: t }
    if (!t.outcome) return { ...run, transcript: t, error: `Claude Code exited ${out.code}: ${out.stderr.slice(-300)}` }
    const deck = await readOnlyDeck(account), measured: Measured[] = []
    if (deck) for (const s of deck.slides) measured.push(await measurer.measure(s.id, s.slide, deck.style, path.join(OUT, 'shots', `${c.id}-${i}-${s.id}.png`)))
    const slide = contentSlide(deck)?.slide, facts = slide ? factChecks(c, slide, requestText(c, FILES)) : { checks: [], unknown: [] }
    return { ...run, status: 'done', transcript: t, deck, measured, unknownFigures: facts.unknown,
      checks: [...choiceChecks(c, t, deck), ...facts.checks, ...renderChecks(deck, measured), ...wiringChecks(c, t, deck)] }
  } catch (e) {
    if (e instanceof Stop) throw e
    return { ...run, error: e instanceof Error ? e.message : String(e) }
  }
}

async function judgeAll(model: string, workers: number): Promise<void> {
  const byId = new Map(cases.map((c) => [c.id, c]))
  const todo = Object.values(results).filter((r) => r.status === 'done' && !r.verdict && r.measured.length && byId.has(r.caseId))
  await Promise.all(Array.from({ length: workers }, async () => {
    for (let r = todo.shift(); r; r = todo.shift()) {
      const c = byId.get(r.caseId), deck = r.deck, target = contentSlide(r.deck), m = r.measured.find((x) => x.slideId === target?.id)
      if (!c || !deck || !target || !m || !r.transcript) continue
      const dir = mkdtempSync(path.join(tmpdir(), 'mcp-judge-'))
      copyFileSync(m.png, path.join(dir, 'slide.png'))
      const prompt = judgePrompt({ c, request: requestText(c, FILES), t: r.transcript, slide: target.slide, style: deck.style, lints: [...m.fit, ...m.issues], unknown: r.unknownFigures })
      const out = await runClaude(judgeArgs(model, judgeSchema(genericQuestions(deck.style).length, c.questions.length)), prompt, dir, 300_000)
      const t = parseStream(out.lines), bad = guardInit(t.init, [])
      if (bad) throw new Stop(bad)
      const v = t.outcome?.structured
      if (isLimited(t, out.stderr) || !v || typeof v !== 'object') { console.log(`judge ${r.id}: ${isLimited(t, out.stderr) ? 'limited' : 'no verdict'}`); continue }
      r.verdict = v as Verdict
      r.judgeModel = model
      save()
      console.log(`judge ${r.id}: done`)
    }
  }))
}

function loadSummary(l: string): Summary {
  for (const f of [path.join(BASELINES, `${l}.json`), path.join(HERE, 'out', l, 'summary.json')]) if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8')) as Summary
  throw new Error(`No summary for ${l} in baselines/ or out/`)
}

function writeReport(): void {
  const runs = Object.values(results).filter((r) => cases.some((c) => c.id === r.caseId)).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
  const s = summarize(runs, cases), base = arg.against ? { label: arg.against, s: loadSummary(arg.against) } : undefined
  writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(s, null, 1))
  writeFileSync(path.join(OUT, 'report.md'), reportMd(label, s, runs, cases, base))
  writeFileSync(path.join(OUT, 'gallery.html'), galleryHtml(label, runs, cases, (png) => path.relative(OUT, png)))
  if (arg['save-baseline'] === 'true') {
    mkdirSync(BASELINES, { recursive: true })
    copyFileSync(path.join(OUT, 'summary.json'), path.join(BASELINES, `${label}.json`))
    copyFileSync(path.join(OUT, 'report.md'), path.join(BASELINES, `${label}.md`))
  }
  console.log(`Magic ${s.magic.n}/${s.magic.of}, fatal ${s.fatal.n}/${s.fatal.of}. Report: ${path.join(OUT, 'report.md')} · gallery: ${path.join(OUT, 'gallery.html')}`)
}

mkdirSync(path.join(OUT, 'shots'), { recursive: true })
if (arg['report-only'] !== 'true') {
  const keys = (loadEnv('', process.cwd(), '').SMARTCHART_EVAL_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean)
  if (!keys.length) throw new Error('Set SMARTCHART_EVAL_KEYS in .env: agent keys of test accounts made for the eval (tests/mcp-eval/README.md).')
  const n = Number(arg.n ?? 3), origin = new URL(url).origin
  const todo = cases.flatMap((c) => Array.from({ length: n }, (_, i) => ({ c, i: i + 1 }))).filter(({ c, i }) => results[`${c.id}#${i}`]?.status !== 'done')
  const measurer = await openMeasurer(app)
  try {
    await Promise.all(keys.map(async (key) => {
      for (let job = todo.shift(); job; job = todo.shift()) {
        const r = await runCase(job.c, job.i, { origin, key }, measurer)
        results[r.id] = r
        save()
        console.log(`${r.id}: ${r.status}${r.error ? ` (${r.error})` : ''}`)
      }
    }))
  } finally { await measurer.close() }
  if (arg['no-judge'] !== 'true') await judgeAll(arg['judge-model'] ?? 'opus', keys.length)
}
writeReport()
