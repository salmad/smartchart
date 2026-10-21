import { readFileSync } from 'node:fs'
import { test, expect } from 'vitest'
import { icons } from 'lucide'
import { ICON_NODES, iconNode } from '@/engine/components/icons'
import { ICONS } from '@/engine/slides/schema'

const pascal = (name: string) => name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')

test('every curated icon, and the three the engine draws itself, is in the table', () => {
  for (const name of [...ICONS, 'chevron-down', 'maximize-2', 'x']) expect(iconNode(name), name).toBeDefined()
})

test('each one is exactly the icon lucide’s full set gives, so a slide draws the same', () => {
  for (const name of Object.keys(ICON_NODES)) expect(ICON_NODES[name], name).toEqual(icons[pascal(name) as keyof typeof icons])
})

test('names read in kebab, snake and spaced forms; an unknown name draws nothing', () => {
  expect(iconNode('credit-card')).toBe(iconNode('credit_card'))
  expect(iconNode('Credit Card')).toBe(iconNode('credit-card'))
  expect(iconNode('not-an-icon')).toBeUndefined()
})

test('every icon the shipped starters and docs name is in the table', () => {
  const text = readFileSync('src/engine/starters/starters.json', 'utf8')
  const named = [...text.matchAll(/"icon"\s*:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]).filter((n) => n !== 'auto')
  expect(named.length).toBeGreaterThan(0)
  for (const name of named) expect(iconNode(name), name).toBeDefined()
})
