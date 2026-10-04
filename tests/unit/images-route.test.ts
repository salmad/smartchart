import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { imagesHandler, type UploadReply } from '../../api/_lib/images-route'
import type { StoreFn } from '../../api/_lib/images'
import { fakeDb } from './fake-db'

const me = async () => ({ id: 'u1', email: 'u1@x.y', via: 'session' as const })
const store: StoreFn = async (name) => `https://store1.public.blob.vercel-storage.com/${name}`
const post = (body: BodyInit, kind = 'all') => new Request(`https://app.test/api/images?kind=${kind}`, { method: 'POST', body })
const logo = () => sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="100%" height="100%" fill="#fff"/><rect x="100" y="100" width="600" height="100" fill="#123"/></svg>')).png().toBuffer()
const photo = () => sharp({ create: { width: 900, height: 600, channels: 3, background: '#777', noise: { type: 'gaussian', mean: 120, sigma: 50 } } }).jpeg().toBuffer()

describe('pictures from the app', () => {
  it('from the chat, a picture is prepared as every kind it can be; the agent picks by use', async () => {
    const r = await imagesHandler({ userFrom: me, db: fakeDb, store })(post(await logo()))
    const body = await r.json() as UploadReply
    expect(r.status).toBe(200)
    expect(Object.keys(body.kinds).sort()).toEqual(['logo', 'photo', 'screenshot'])
    expect(body.kinds.logo?.src).toMatch(/-logo-600x100\.png$/)
    const small = await sharp({ create: { width: 150, height: 150, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><circle cx="75" cy="75" r="70"/></svg>') }]).png().toBuffer()
    const icon = await (await imagesHandler({ userFrom: me, db: fakeDb, store })(post(small))).json() as UploadReply
    expect(Object.keys(icon.kinds)).toEqual(['logo'])
    expect(icon.refused.photo).toMatch(/200 px/)
  })
  it('a photo is a photo and a screenshot, and refused as a logo with the reason', async () => {
    const body = await (await imagesHandler({ userFrom: me, db: fakeDb, store })(post(await photo()))).json() as UploadReply
    expect(Object.keys(body.kinds).sort()).toEqual(['photo', 'screenshot'])
    expect(body.refused.logo).toMatch(/plain or transparent background/)
  })
  it('from edit mode only the field\'s kind is made', async () => {
    const body = await (await imagesHandler({ userFrom: me, db: fakeDb, store })(post(await photo(), 'photo'))).json() as UploadReply
    expect(Object.keys(body.kinds)).toEqual(['photo'])
  })
  it('refuses the signed out, a picture nothing can use, and a bad kind', async () => {
    expect((await imagesHandler({ userFrom: async () => null, db: fakeDb, store })(post('x'))).status).toBe(401)
    const r = await imagesHandler({ userFrom: me, db: fakeDb, store })(post('<html>not a picture</html>'))
    expect(r.status).toBe(422)
    expect(((await r.json()) as { error: string }).error).toMatch(/not a picture/)
    expect((await imagesHandler({ userFrom: me, db: fakeDb, store })(post('x', 'gif'))).status).toBe(400)
    expect((await imagesHandler({ userFrom: me, db: fakeDb, store: null })(post('x'))).status).toBe(503)
  })
})
