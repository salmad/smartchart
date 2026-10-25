import { describe, expect, it } from 'vitest'
import { runDocTool, type DocEnv } from '../../api/_lib/doc-service'
import type { Db } from '../../api/_lib/db'
import { parseDoc } from '../../src/engine/docs/parse'
import { serializeDoc } from '../../src/engine/docs/serialize'
import { tool, WRITE, type AnyTool } from '../../src/engine/tools/types'
import { fakeDb } from './fake-db'
import { fakeJev, seedUser, type SeedUser } from './fakes'
import { DEFAULT_USER_LOOK } from '../../src/engine/look'
import { fakePort } from './tool-ctx'

const user = (n: string): SeedUser => ({ id: `u_${n}`, email: `${n}@x.y`, name: n })
const ann = user('ann'), cy = user('cy'), dee = user('dee')
const START = '---\ntitle: Memo\n---\n\n## Plan {#plan}\n\nFirst.\n'
const ANY = { type: 'object', additionalProperties: true } as const

/** A doc tool that adds a paragraph, and one that makes a doc: stubs for the service, which does not care what a tool does. */
const append = (text = 'Added.', hook?: () => Promise<void>): AnyTool => tool<{ docId: string }>({ name: 'append', title: 'Append', group: 'docs', scope: 'doc', annotations: WRITE, description: '', input: ANY,
  run: async (ctx) => { await hook?.(); const f = ctx.file; if (!f) throw new Error('no file'); return { result: { rev: ctx.rev }, file: { ...f, doc: { ...f.doc, blocks: [...f.doc.blocks, { type: 'paragraph', text }] } } } } })
const make = (workspaceId?: string): AnyTool => tool<{ title: string }>({ name: 'make', title: 'Make', group: 'docs', scope: 'createDoc', annotations: WRITE, description: '', input: ANY,
  run: async (ctx, { title }) => ({ result: {}, file: { id: ctx.port.newDocId(), name: title, doc: { title, blocks: [] } }, workspaceId }) })

async function world() {
  const db = fakeDb(), ws = await seedUser(db, ann)
  await db.putDoc(ann.id, 'doc_1', 'Memo', START, 0, ws)
  const env = (u: SeedUser, t: AnyTool, input: unknown, now = 1_000_000): DocEnv => ({ tool: t, input, uid: u.id, client: 'Claude Code', db, origin: 'https://app.test', now: () => now, port: fakePort(), jev: fakeJev(), userLook: DEFAULT_USER_LOOK, workspaces: () => db.listWorkspaces(u.id) })
  return { db, ws, env }
}
const join = async (db: Db, ws: string, who: SeedUser, role: 'editor' | 'viewer') => {
  await seedUser(db, who)
  const token = `t_${who.id}`
  await db.addInvite(ann.id, ws, who.email, role, token, Date.now() + 86_400_000)
  await db.acceptInvite(who, token, Date.now())
}

describe('doc service', () => {
  it('a write lands as Markdown, bumps rev, and records a version by the caller’s client', async () => {
    const { db, env } = await world()
    expect(await runDocTool(env(ann, append(), { docId: 'doc_1' }))).toMatchObject({ ok: true, result: { rev: 2 } })
    const got = await db.getDoc(ann.id, 'doc_1')
    expect(got?.rev).toBe(2)
    expect(parseDoc(got?.text ?? '').doc.blocks.at(-1)).toEqual({ type: 'paragraph', text: 'Added.' })
    expect(await db.listDocVersions(ann.id, 'doc_1')).toMatchObject([{ by: 'Claude Code', rev: 2 }])
  })

  it('a person editing by hand is told, and the write still lands (Review Focus 3)', async () => {
    const { db, env } = await world()
    await db.setDocPresence(ann.id, 'doc_1', { editing: { by: 'Ann', until: 1_030_000 } })
    const r = await runDocTool(env(ann, append(), { docId: 'doc_1' }))
    expect(r).toMatchObject({ ok: true, result: { notice: expect.stringContaining('Ann is editing') } })
    expect((await db.getDoc(ann.id, 'doc_1'))?.text).toContain('Added.')
    // An entry that has expired says nothing.
    const later = await runDocTool(env(ann, append('More.'), { docId: 'doc_1' }, 2_000_000))
    expect(later).toMatchObject({ ok: true })
    expect(later.ok && 'notice' in later.result).toBe(false)
  })

  it('a viewer’s write is refused with the sentence and changes nothing; a non-member hears not_found (Review Focus 4)', async () => {
    const { db, ws, env } = await world()
    await join(db, ws, cy, 'viewer'); await seedUser(db, dee)
    const before = (await db.getDoc(ann.id, 'doc_1'))?.text
    expect(await runDocTool(env(cy, append(), { docId: 'doc_1' }))).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this doc, not edit it.' } })
    expect(await runDocTool(env(dee, append(), { docId: 'doc_1' }))).toMatchObject({ ok: false, error: { code: 'not_found', message: 'No doc doc_1.' } })
    expect((await db.getDoc(ann.id, 'doc_1'))?.text).toBe(before)
  })

  it('a conflict reloads and runs once more; a second one is a conflict', async () => {
    const { db, ws, env } = await world()
    let bumped = 0
    const rival = (n: number) => async () => { if (bumped < n) { bumped++; const d = await db.getDoc(ann.id, 'doc_1'); await db.putDoc(ann.id, 'doc_1', 'Memo', `${d?.text}\nRival ${bumped}.\n`, d?.rev ?? 0, ws) } }
    expect(await runDocTool(env(ann, append('Mine.', rival(1)), { docId: 'doc_1' }))).toMatchObject({ ok: true })
    const text = (await db.getDoc(ann.id, 'doc_1'))?.text ?? ''
    expect(text).toContain('Rival 1.'); expect(text).toContain('Mine.')
    bumped = 0
    expect(await runDocTool(env(ann, append('Again.', rival(2)), { docId: 'doc_1' }))).toMatchObject({ ok: false, error: { code: 'conflict', message: 'The doc changed while this ran.' } })
  })

  it('createDoc goes into the workspace named, else the most recently used, and a viewer there is refused', async () => {
    const { db, ws, env } = await world()
    const made = await runDocTool(env(ann, make(), { title: 'New memo' }))
    expect(made).toMatchObject({ ok: true, result: { links: { edit: expect.stringMatching(/^https:\/\/app\.test\/doc\/doc_/) } } })
    expect((await db.listDocs(ann.id, ws)).map((d) => d.name).sort()).toEqual(['Memo', 'New memo'])
    await join(db, ws, cy, 'viewer')
    expect(await runDocTool(env(cy, make(ws), { title: 'Nope' }))).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not add to it.' } })
    expect(await runDocTool(env(ann, make('ws_missing'), { title: 'X' }))).toMatchObject({ ok: false, error: { code: 'not_found' } })
  })

  it('a doc tool that saves nothing leaves rev and text alone', async () => {
    const { db, env } = await world()
    const read = tool<{ docId: string }>({ name: 'peek', title: 'Peek', group: 'docs', scope: 'doc', annotations: WRITE, description: '', input: ANY, run: async (ctx) => ({ result: { title: ctx.file?.doc.title } }) })
    expect(await runDocTool(env(ann, read, { docId: 'doc_1' }))).toMatchObject({ ok: true, result: { title: 'Memo' } })
    expect((await db.getDoc(ann.id, 'doc_1'))?.rev).toBe(1)
    expect(serializeDoc(parseDoc((await db.getDoc(ann.id, 'doc_1'))?.text ?? '').doc)).toBe(START)
  })
})
