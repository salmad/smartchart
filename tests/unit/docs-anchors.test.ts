import { describe, expect, it } from 'vitest'
import { parseDoc } from '../../src/engine/docs/parse'
import { anchorsOf, WHOLE_DOC } from '../../src/app/components/docs/anchors'

describe('doc comment anchors', () => {
  it('names the doc, each heading and each figure, under the section they sit in', () => {
    const { doc } = parseDoc(['---', 'title: T', '---', '', '## One {#one}', '', 'Text.', '', '### Part {#part}', '', '```occam:number {#n1}', '{"number":{"value":"4","caption":"Churn fell"}}', '```', '', '## Two {#two}', ''].join('\n'))
    expect(anchorsOf(doc).map((a) => [a.id, a.section])).toEqual([[WHOLE_DOC, WHOLE_DOC], ['one', 'one'], ['part', 'one'], ['n1', 'one'], ['two', 'two']])
    expect(anchorsOf(doc)[2].label).toBe('Part')
  })
})
