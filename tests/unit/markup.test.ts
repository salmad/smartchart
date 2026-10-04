import { test, expect } from 'vitest'
import { applyText, hasMark, parse, plainOf, serialize, toggle } from '@/engine/slides/markup'
import { md } from '@/engine/slides/render'
import { STARTERS } from '@/engine/starters'
import type { Slide } from '@/engine/types'

test('plain text drops the marks', () => {
  expect(plainOf('Revenue grows [[86% a year]] with **no** churn')).toBe('Revenue grows 86% a year with no churn')
  expect(plainOf('a [-loss-] and a [+gain+]')).toBe('a loss and a gain')
  expect(plainOf('unpaired ** and [[ stay text')).toBe('unpaired ** and [[ stay text')
})

test('serialize(parse(x)) renders exactly like x', () => {
  for (const x of ['plain', '**bold** then [[focus]]', '**[[both]]**', 'a [-neg-] b [+pos+]', '[[a]] [[b]]', 'end **bold**']) {
    expect(md(serialize(parse(x)))).toBe(md(x))
  }
})

// Every markup string in the gallery survives a round trip with its marks.
const strings = (v: unknown): string[] => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []
test('every gallery string round-trips', () => {
  for (const st of STARTERS) for (const style of ['consulting', 'pitch'] as const) {
    for (const x of strings(st[style] as Slide)) expect(parse(serialize(parse(x)))).toEqual(parse(x))
  }
})

test('applyText: unchanged text returns the same string', () => {
  const x = 'Revenue [[doubles]]'
  expect(applyText(x, 'Revenue doubles')).toBe(x)
})

test('applyText: typing inside a mark extends it', () => {
  expect(applyText('Revenue [[doubles]]', 'Revenue [[doubless]]'.replace(/\[\[|\]\]/g, ''))).toBe('Revenue [[doubless]]')
  expect(applyText('a [[bc]] d', 'a bXc d')).toBe('a [[bXc]] d')
})

test('applyText: typing right after a mark extends it; before it, it does not', () => {
  expect(applyText('[[ab]] c', 'abX c')).toBe('[[abX]] c')
  expect(applyText('a [[bc]]', 'a XbcY'.replace('Y', ''))).toBe('a X[[bc]]')
})

test('applyText: deleting across a mark boundary keeps valid markup', () => {
  expect(applyText('one **two** three', 'one tree')).toBe('one **t**ree')
  // A prefix/suffix diff: the kept "t" was bold, so it stays bold; what matters is valid markup and the right text.
  const cut = applyText('one **two** three', 'one three')
  expect(plainOf(cut)).toBe('one three')
  expect(md(cut)).not.toMatch(/\*\*|\[\[/)
  expect(applyText('[[all]]', '')).toBe('')
})

test('applyText: replacing a selection that spans two marks', () => {
  const out = applyText('**ab**[[cd]]', 'aXd')
  expect(plainOf(out)).toBe('aXd')
  expect(out).not.toMatch(/\*\*\*\*|\[\[\]\]|\*\*\*\*/)
})

test('toggle: bold on, bold off, never overlapping', () => {
  expect(toggle('make it bold', 8, 12, 'b')).toBe('make it **bold**')
  expect(toggle('make it **bold**', 8, 12, 'b')).toBe('make it bold')
  expect(toggle('**ab**cd', 1, 3, 'b')).toBe('**abc**d')
  expect(toggle('[[ab]]cd', 1, 3, 'b')).toBe('[[a**b**]]**c**d')
  expect(md(toggle('[[ab]]cd', 1, 3, 'b'))).not.toMatch(/\*\*|\[\[/)
  expect(toggle('abc', 1, 1, 'f')).toBe('abc')
  expect(toggle('abc', 2, 0, 'f')).toBe('[[ab]]c')
})

test('hasMark is true only when every character has it', () => {
  expect(hasMark('a **bc** d', 2, 4, 'b')).toBe(true)
  expect(hasMark('a **bc** d', 1, 4, 'b')).toBe(false)
})

import { toggleSpans } from '@/engine/slides/markup'

test('toggleSpans: one mark over many fields, on unless every span already has it', () => {
  expect(toggleSpans([{ markup: 'one', from: 0, to: 3 }, { markup: 'two words', from: 0, to: 3 }], 'f')).toEqual(['[[one]]', '[[two]] words'])
  expect(toggleSpans([{ markup: '[[one]]', from: 0, to: 3 }, { markup: '[[two]] words', from: 0, to: 3 }], 'f')).toEqual(['one', 'two words'])
  // One span without it turns it on for all.
  expect(toggleSpans([{ markup: '[[one]]', from: 0, to: 3 }, { markup: 'two', from: 0, to: 3 }], 'f')).toEqual(['[[one]]', '[[two]]'])
  expect(toggleSpans([{ markup: 'a', from: 0, to: 0 }], 'b')).toEqual(['a'])
})

test('a link keeps its address through hand editing, and only its words count as text', () => {
  const m = 'ONS, [FCA report](https://fca.org.uk/r?a=1) 2026'
  expect(plainOf(m)).toBe('ONS, FCA report 2026')
  expect(serialize(parse(m))).toBe(m)
  expect(applyText(m, 'ONS, FCA reports 2026')).toBe('ONS, [FCA reports](https://fca.org.uk/r?a=1) 2026')
  expect(applyText(m, 'Source, FCA report 2026')).toBe('Source, [FCA report](https://fca.org.uk/r?a=1) 2026')
})
