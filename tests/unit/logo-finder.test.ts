import { describe, expect, it } from 'vitest'
import { candidates, findLogo, homeOf } from '../../api/_lib/logo-finder'

// Letter-like strokes: a real mark covers well under three quarters of its box.
const mark = (label: string, w = 400) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 100" aria-label="${label}">${Array.from({ length: Math.floor(w / 40) }, (_, i) => `<rect x="${i * 40}" y="0" width="18" height="100"/>`).join('')}${' '.repeat(300)}</svg>`
const page = `<html><body><header><a href="/" aria-label="Acme home">${mark('Acme logo')}</a></header>
  <section class="customers"><img class="customer-logo" alt="Northwind logo" src="/img/northwind-logo.svg"></section>
  <footer><a href="https://facebook.com/acme" aria-label="Acme on Facebook">${mark('Facebook logo', 100)}</a>
  <img alt="Acme logo" src="/img/team-offsite.jpg"></footer></body></html>`
const lookup = async () => [{ address: '93.184.216.34' }]

describe('a company’s logo from its own site', () => {
  it('reads the brand from the domain', () => {
    expect(homeOf('stripe.com')).toMatchObject({ brand: 'stripe' })
    expect(homeOf('https://www.monzo.co.uk/business')).toMatchObject({ brand: 'monzo' })
    expect(homeOf('linear.app').home.href).toBe('https://linear.app/')
    expect(() => homeOf('not a domain at all')).toThrow(/not a domain/)
  })
  it('the company’s own mark wins; social networks, customers and photos never count', async () => {
    const list = candidates(page, new URL('https://acme.test/'), 'acme', async () => new Uint8Array())
    expect(list[0].from).toBe('an inline SVG on the home page')
    expect(new TextDecoder().decode(await list[0].load())).toContain('aria-label="Acme logo"')
    expect(list.filter((c) => c.from.includes('svg') || c.from.includes('SVG'))).toHaveLength(1)
    expect(list.some((c) => /northwind|offsite/.test(c.from))).toBe(false)
  })
  it('finds and prepares the logo, and says where it was found', async () => {
    const get = (async () => new Response(page)) as unknown as typeof fetch
    const { prepared, from } = await findLogo('acme.test', { fetch: get, lookup })
    expect(prepared.kind).toBe('logo')
    expect(from).toBe('an inline SVG on the home page')
  })
  it('says what to do when the site cannot be read or has no mark', async () => {
    const blocked = (async () => new Response('no', { status: 403 })) as unknown as typeof fetch
    await expect(findLogo('acme.test', { fetch: blocked, lookup })).rejects.toThrow(/could not be read \(the server answered 403\.\)/)
    const empty = (async () => new Response('<html><body>Hello</body></html>')) as unknown as typeof fetch
    await expect(findLogo('acme.test', { fetch: empty, lookup })).rejects.toThrow(/no logo of acme could be found/)
  })
})
