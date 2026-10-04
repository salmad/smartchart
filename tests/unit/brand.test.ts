import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { brandColours, isBrandColour, logoColour, pageColours, themeColour } from '../../api/_lib/brand'

const lookup = async () => [{ address: '93.184.216.34' }]

describe('a brand colour from a website', () => {
  it('greys, near-black and near-white are not brand colours', () => {
    expect(isBrandColour(255, 79, 64)).toBe(true)
    expect(isBrandColour(128, 128, 128)).toBe(false)
    expect(isBrandColour(10, 12, 20)).toBe(false)
    expect(isBrandColour(250, 248, 245)).toBe(false)
  })
  it('reads the declared colour, and the page’s most used colours with a clear lead', () => {
    expect(themeColour('<meta name="theme-color" content="#ff7a59">')).toBe('#FF7A59')
    expect(themeColour('<meta name="theme-color" content="#ffffff">')).toBeNull()
    const css = `${'.a{color:#635BFF}'.repeat(9)}${'.b{color:#0a2540}'.repeat(20)}${'.c{color:#00d924}'.repeat(5)}${'.d{color:#ff0000}'.repeat(2)}`
    expect(pageColours(css)).toEqual(['#635BFF', '#00D924'])
  })
  it('a logo’s colour is its largest coloured part; a black logo has none', async () => {
    const coloured = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: { create: { width: 120, height: 60, channels: 4, background: { r: 255, g: 79, b: 64, alpha: 1 } } }, left: 0, top: 0 },
        { input: { create: { width: 30, height: 30, channels: 4, background: { r: 20, g: 40, b: 200, alpha: 1 } } }, left: 150, top: 50 }]).png().toBuffer()
    expect(await logoColour(coloured)).toBe('#FF4F40')
    const black = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer()
    expect(await logoColour(black)).toBeNull()
  })
  it('offers the candidates best evidence first, close shades once, and says so when there are none', async () => {
    const page = `<html><head><meta name="theme-color" content="#FF4F40"></head><body>${'<a style="color:#FF5040">x</a>'.repeat(6)}${'<b style="color:#14B8A6">y</b>'.repeat(6)}</body></html>`
    const get = (async () => new Response(page)) as unknown as typeof fetch
    expect(await brandColours('acme.test', { fetch: get, lookup })).toEqual([{ hex: '#FF4F40', from: 'the colour acme.test declares' }, { hex: '#14B8A6', from: 'used across acme.test' }])
    const plain = (async () => new Response('<html><body>Hello</body></html>')) as unknown as typeof fetch
    await expect(brandColours('acme.test', { fetch: plain, lookup })).rejects.toThrow(/No brand colour could be found on acme.test/)
  })
})
