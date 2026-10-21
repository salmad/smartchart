import { expect, test } from 'vitest'
import { ordered, overlay, type Op } from '@/app/optimistic'

interface Row { id: string; name: string }
const rows: Row[] = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
const del = (list: string, row: string): Op<Row> => ({ list, row, apply: (r) => r.filter((x) => x.id !== row) })
const rename = (list: string, row: string, name: string): Op<Row> => ({ list, row, apply: (r) => r.map((x) => (x.id === row ? { ...x, name } : x)) })
const tick = () => new Promise((r) => setTimeout(r, 5))

test('pending changes apply in the order they were made, and only to their own list', () => {
  expect(overlay('decks:w1', rows, [rename('decks:w1', 'a', 'A2'), del('decks:w1', 'b')])).toEqual([{ id: 'a', name: 'A2' }])
  expect(overlay('decks:w1', rows, [del('decks:w2', 'a')])).toEqual(rows)
})

test('a row renamed and then deleted stays gone, and a refetched list that still has it does not bring it back', () => {
  const ops = [rename('docs:w1', 'a', 'A2'), del('docs:w1', 'a')]
  expect(overlay('docs:w1', rows, ops)).toEqual([{ id: 'b', name: 'B' }])
  expect(overlay('docs:w1', rows, ops)).toEqual([{ id: 'b', name: 'B' }]) // the next read, same answer
  expect(overlay('docs:w1', rows, [ops[0]])).toEqual([{ id: 'a', name: 'A2' }, { id: 'b', name: 'B' }]) // the delete settled and was dropped
})

test('requests for one row go out in order; other rows do not wait', async () => {
  const q = ordered(), seen: string[] = []
  let release: () => void = () => {}
  const held = new Promise<void>((r) => { release = r })
  const first = q.run('a', async () => { await held; seen.push('a:rename') })
  const second = q.run('a', async () => { seen.push('a:delete') })
  await q.run('b', async () => { seen.push('b:rename') })
  await tick()
  expect(seen).toEqual(['b:rename'])
  release()
  await Promise.all([first, second])
  expect(seen).toEqual(['b:rename', 'a:rename', 'a:delete'])
})

test('a failed request does not stop the next one, and each caller gets its own result', async () => {
  const q = ordered()
  const bad = q.run('a', async () => { throw new Error('nope') })
  const good = q.run('a', async () => 'ok')
  await expect(bad).rejects.toThrow('nope')
  await expect(good).resolves.toBe('ok')
})

test('wait resolves after the last queued request settles, failed or not', async () => {
  const q = ordered(), seen: string[] = []
  void q.run('a', async () => { await tick(); seen.push('one') }).catch(() => undefined)
  void q.run('a', async () => { await tick(); seen.push('two'); throw new Error('x') }).catch(() => undefined)
  await q.wait('a')
  expect(seen).toEqual(['one', 'two'])
  await q.wait('idle') // nothing queued: no wait
})
