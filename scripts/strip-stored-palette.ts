/**
 * One-time cleanup: remove theme/accent from deck JSON, doc Markdown, and version trees.
 * Dry-run by default; pass --apply to write.
 *
 *   DATABASE_URL=… npm run db:strip-palette
 *   DATABASE_URL=… npm run db:strip-palette -- --apply
 */
import { neon } from '@neondatabase/serverless'
import { stripDeckData, stripDeckVersionTree, stripDocText, stripDocVersionTree } from '../src/engine/stored-palette.ts'

const apply = process.argv.includes('--apply')
const url = process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL (e.g. from .env).')
  process.exit(1)
}

const sql = neon(url)

async function main() {
  let decks = 0, docs = 0, deckVers = 0, docVers = 0

  const deckRows = await sql`select id, data from decks where data ? 'theme' or data ? 'accent'` as { id: string; data: unknown }[]
  for (const row of deckRows) {
    const { data, changed } = stripDeckData(row.data)
    if (!changed) continue
    decks++
    if (apply) await sql`update decks set data = ${JSON.stringify(data)}::jsonb where id = ${row.id}`
  }

  const docRows = await sql`select id, text from docs` as { id: string; text: string }[]
  for (const row of docRows) {
    const { text, changed } = stripDocText(row.text ?? '')
    if (!changed) continue
    docs++
    if (apply) await sql`update docs set text = ${text} where id = ${row.id}`
  }

  const dvRows = await sql`select deck_id, n, tree from deck_versions` as { deck_id: string; n: number; tree: unknown }[]
  for (const row of dvRows) {
    const { tree, changed } = stripDeckVersionTree(row.tree)
    if (!changed) continue
    deckVers++
    if (apply) await sql`update deck_versions set tree = ${JSON.stringify(tree)}::jsonb where deck_id = ${row.deck_id} and n = ${row.n}`
  }

  const docVR = await sql`select doc_id, n, tree from doc_versions` as { doc_id: string; n: number; tree: unknown }[]
  for (const row of docVR) {
    const { tree, changed } = stripDocVersionTree(row.tree)
    if (!changed) continue
    docVers++
    if (apply) await sql`update doc_versions set tree = ${JSON.stringify(tree)}::jsonb where doc_id = ${row.doc_id} and n = ${row.n}`
  }

  const mode = apply ? 'Updated' : 'Would update'
  console.log(`${mode}: ${decks} deck(s), ${docs} doc(s), ${deckVers} deck version tree(s), ${docVers} doc version tree(s).`)
  if (!apply && (decks || docs || deckVers || docVers)) console.log('Pass --apply to write.')
}

main().catch((e) => { console.error(e); process.exit(1) })
