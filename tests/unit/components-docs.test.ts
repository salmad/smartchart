/* The components docs need, in the shared library: number, callout and code. */
import { test, expect } from 'vitest'
import { calloutHTML } from '@/engine/components/callout'
import { codeHTML } from '@/engine/components/code'
import { numberHTML } from '@/engine/components/number'

test('a callout carries its tone, label and markup', () => {
  const html = calloutHTML({ tone: 'risk', text: 'FCA **approval**' }, '')
  expect(html).toContain('class="callout t-risk"')
  expect(html).toContain('>Risk<')
  expect(html).toContain('<strong>approval</strong>')
  expect(calloutHTML({ tone: 'note', label: 'Scope', text: 'x' }, 'blocks[1]')).toContain('data-path="blocks[1].text"')
})

test('code is escaped', () => {
  expect(codeHTML('a < b', 'ts')).toContain('a &lt; b')
})

test('a number builds its paths under its base', () => {
  expect(numberHTML({ value: '£2.5bn', caption: 'x' }, 'halves[1]')).toContain('data-path="halves[1].number.value"')
})
