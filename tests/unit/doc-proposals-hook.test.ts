import { describe, expect, it, vi } from 'vitest'
import { parseDoc } from '../../src/engine/docs/parse'
import type { DocProposal } from '../../src/engine/docs/proposals'
import { createDocProposalsRunner, proposalsInDoc } from '../../src/app/components/docs/useDocProposals'

const wall = () => parseDoc(`---
title: Wall
---

## One {#one}

${'word '.repeat(100)}
`).doc

describe('doc proposals hook logic', () => {
  it('a reader never calls proposeDoc', async () => {
    const propose = vi.fn(async () => [{ id: 'p1', blockIds: ['t_x'], mode: 'insert' as const, markdown: '- a', label: 'x', why: 'y', by: 'Occam', at: 1, rev: 1 }])
    const run = createDocProposalsRunner({ canEdit: false, proposeDoc: propose, fetchStored: async () => [] })
    await run.open(wall(), 1)
    expect(propose).not.toHaveBeenCalled()
  })

  it('open() calls proposeDoc once per rev', async () => {
    const propose = vi.fn(async () => [])
    const run = createDocProposalsRunner({ canEdit: true, proposeDoc: propose, fetchStored: async () => [] })
    const doc = wall()
    await run.open(doc, 3)
    await run.open(doc, 3)
    await run.open(doc, 4)
    expect(propose).toHaveBeenCalledTimes(2)
    expect(propose).toHaveBeenNthCalledWith(1, doc, { rev: 3, signal: undefined })
    expect(propose).toHaveBeenNthCalledWith(2, doc, { rev: 4, signal: undefined })
  })

  it('proposals whose blocks are gone are dropped', () => {
    const doc = wall()
    const kept: DocProposal[] = [{ id: 'p1', blockIds: ['one'], mode: 'insert', markdown: '- a', label: 'x', why: 'y', by: 'Agent', at: 1, rev: 1 }]
    const gone: DocProposal[] = [{ id: 'p2', blockIds: ['t_gone'], mode: 'insert', markdown: '- a', label: 'x', why: 'y', by: 'Agent', at: 1, rev: 1 }]
    expect(proposalsInDoc(doc, [...kept, ...gone]).map((p) => p.id)).toEqual(['p1'])
  })
})
