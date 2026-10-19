import { describe, expect, it } from 'vitest'
import { docFrom, docTree } from '../../src/engine/docs/versions'
import { DOC_STARTERS, starterDoc } from '../../src/engine/starters'
import type { Doc } from '../../src/engine/docs/types'

describe('doc versions', () => {
  it('a tree and its blobs give back each starter doc', () => {
    for (const s of DOC_STARTERS) {
      const doc = starterDoc(s), { tree, blobs } = docTree(doc)
      expect(tree.blocks).toHaveLength(doc.blocks.length)
      expect(docFrom(tree, blobs)).toEqual(doc)
    }
  })

  it('blocks with equal content share one blob', () => {
    const doc: Doc = { title: 'T', blocks: [{ type: 'paragraph', text: 'Same.' }, { type: 'divider' }, { type: 'paragraph', text: 'Same.' }] }
    const { tree, blobs } = docTree(doc)
    expect(tree.blocks[0]).toBe(tree.blocks[2])
    expect(Object.keys(blobs)).toHaveLength(2)
  })

  it('the look and title live in the tree; a missing blob gives null', () => {
    const doc: Doc = { title: 'T', subtitle: 'S', theme: 'paper', accent: '#123456', blocks: [{ type: 'paragraph', text: 'A' }] }
    const { tree } = docTree(doc)
    expect(tree).toMatchObject({ title: 'T', subtitle: 'S', theme: 'paper', accent: '#123456' })
    expect(docFrom(tree, {})).toBeNull()
  })
})
