import { test, expect } from 'vitest'
import { imageMeta, isImageSrc, imageName, isWordmark, pictureAsWords } from '@/engine/slides/images'
import { ruleChecks } from '@/engine/agent/checks'
import type { Slide } from '@/engine/types'

const BLOB = 'https://i22hzrcpnvzinqep.public.blob.vercel-storage.com/img/3f9a0c1d2e4b5a6f-logo-640x160.png'

test('a stored picture carries its kind and size in its name', () => {
  expect(imageMeta(BLOB)).toEqual({ kind: 'logo', w: 640, h: 160, aspect: 4 })
  expect(imageMeta('/starters/img/acme-app-screenshot-2400x1500.webp')).toEqual({ kind: 'screenshot', w: 2400, h: 1500, aspect: 1.6 })
  expect(imageMeta('/starters/img/maya-photo-800x800.webp')?.kind).toBe('photo')
})

test('only SmartChart pictures are pictures: no hotlinks, no other paths, no tricks', () => {
  expect(isImageSrc(BLOB)).toBe(true)
  expect(isImageSrc('/starters/img/acme-app-screenshot-2400x1500.webp')).toBe(true)
  for (const bad of [
    'https://example.com/img/3f9a0c1d2e4b5a6f-logo-640x160.png',
    'http://i22hzrcpnvzinqep.public.blob.vercel-storage.com/img/3f9a0c1d2e4b5a6f-logo-640x160.png',
    'https://i22hzrcpnvzinqep.public.blob.vercel-storage.com/film/occam-poster.jpg',
    'https://evil.com/x.public.blob.vercel-storage.com/img/3f9a0c1d2e4b5a6f-logo-640x160.png',
    '/starters/img/../secret-logo-640x160.png',
    '/starters/img/acme-logo-640x160.svg',
    'javascript:alert(1)//-logo-1x1.png',
    'data:image/png;base64,AAAA',
    '/starters/img/acme-logo-0x160.png',
  ]) expect(isImageSrc(bad), bad).toBe(false)
  expect(imageMeta('https://example.com/a.png')).toBeNull()
})

test('the stored name is built from the content hash, kind and size', () => {
  expect(imageName('3f9a0c1d2e4b5a6f9999', 'logo', 640, 160, 'png')).toBe('img/3f9a0c1d2e4b5a6f-logo-640x160.png')
})

test('a wide logo is a wordmark: it is the name, so it can stand in for it', () => {
  expect(isWordmark(4)).toBe(true)
  expect(isWordmark(1.2)).toBe(false)
})

test('checks read a picture as words, never its file name', () => {
  expect(JSON.stringify({ logo: { src: BLOB }, name: 'Northwind' }, pictureAsWords)).toBe('{"logo":"[logo]","name":"Northwind"}')
  expect(pictureAsWords('image', { src: '/starters/img/acme-app-screenshot-2400x1500.webp', alt: 'The cash screen' })).toBe('[screenshot: The cash screen]')
  // The file name's size (2400x1500) is not a figure on the slide.
  const s: Slide = { template: 'image', title: 'Owners see 2400 days of cash ahead', image: { src: '/starters/img/acme-app-screenshot-2400x1500.webp', alt: 'The Acme cash flow screen' } }
  expect(ruleChecks(s, 'consulting', 1).find((c) => c.id === 'R11')?.ok).toBe(false)
})

test('R15: the alt text says what the picture shows, not the title again', () => {
  const s = (alt: string): Slide => ({ template: 'image', title: 'Owners see their lowest cash point weeks ahead', image: { src: '/starters/img/acme-app-screenshot-2400x1500.webp', alt } })
  expect(ruleChecks(s('Owners see their lowest cash point weeks ahead'), 'consulting', 1).find((c) => c.id === 'R15')?.ok).toBe(false)
  expect(ruleChecks(s('The Acme cash flow screen: a 90-day forecast with a VAT dip'), 'consulting', 1).find((c) => c.id === 'R15')?.ok).toBe(true)
})
