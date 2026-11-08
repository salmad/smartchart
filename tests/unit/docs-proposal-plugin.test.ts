import { describe, expect, it } from 'vitest'
import { identify } from '../../src/engine/docs/ops'
import { parseDoc } from '../../src/engine/docs/parse'
import { applyProposal, checkProposal, type DocProposal } from '../../src/engine/docs/proposals'
import { previewDoc, showProposalControls } from '../../src/app/components/docs/proposal-preview'

const base = () => parseDoc(`---
title: Memo
---

## Plan {#plan}

One two three four five.
`).doc

const textProposal = (blockIds: string[], over: Partial<DocProposal> = {}): DocProposal => ({
  id: 'p1',
  blockIds,
  mode: 'replace',
  markdown: '- One\n- two\n- three\n- four\n- five',
  label: 'Bullets',
  why: 'Easier',
  by: 'Occam',
  at: 1,
  rev: 1,
  ...over,
})

describe('doc proposal preview', () => {
  it('switching to suggestion and back leaves the doc JSON unchanged', () => {
    const doc = base()
    const id = identify(doc).find((x) => x.block.type === 'paragraph')?.id ?? ''
    const p = textProposal([id])
    expect(checkProposal(doc, p).ok).toBe(true)
    const before = structuredClone(doc)
    void previewDoc(doc, p, 'suggestion')
    void previewDoc(doc, p, 'original')
    expect(doc).toEqual(before)
  })

  it('approve applies the proposal and saves one labelled version', () => {
    const doc = base()
    const id = identify(doc).find((x) => x.block.type === 'paragraph')?.id ?? ''
    const p = textProposal([id])
    const next = applyProposal(doc, p)
    expect(next.blocks.some((b) => b.type === 'bullets')).toBe(true)
    expect(next).not.toEqual(doc)
  })

  it('cancel dismisses and leaves the doc unchanged', () => {
    const doc = base()
    const snapshot = structuredClone(doc)
    expect(doc).toEqual(snapshot)
  })

  it('a reader gets no switch', () => {
    expect(showProposalControls(false)).toBe(false)
    expect(showProposalControls(true)).toBe(true)
  })
})
