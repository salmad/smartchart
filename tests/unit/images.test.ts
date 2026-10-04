import { test, expect } from 'vitest'
import { imageMeta, isImageSrc, imageName, logoSize, isWordmark } from '@/engine/slides/images'

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

test('logos of any shape get the same visual weight, inside their box', () => {
  const square = logoSize(1, { base: 100, maxW: 400, maxH: 200 }), word = logoSize(4, { base: 100, maxW: 400, maxH: 200 })
  expect(square).toEqual({ w: 100, h: 100 })
  expect(word.w * word.h).toBeCloseTo(square.w * square.h)
  // Too wide for the box: scaled down whole, keeping its shape.
  const long = logoSize(16, { base: 100, maxW: 300, maxH: 200 })
  expect(long.w).toBe(300); expect(long.h).toBeCloseTo(300 / 16)
  const tall = logoSize(0.25, { base: 100, maxW: 300, maxH: 120 })
  expect(tall.h).toBe(120); expect(tall.w).toBeCloseTo(30)
})

test('a wide logo is a wordmark: it is the name, so it can stand in for it', () => {
  expect(isWordmark(4)).toBe(true)
  expect(isWordmark(1.2)).toBe(false)
})
