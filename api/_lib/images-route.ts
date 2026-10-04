// Pictures from the app: the maker drops or picks a picture, the browser sends its bytes, and it is prepared and stored
// like add_image's (images.ts). From the chat its use is not known yet, so it is prepared as every kind it can be and the
// agent picks by use; from edit mode the field's kind is known.
import { IMAGE_KINDS, type ImageKind } from '../../src/engine/slides/images.js'
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'
import { blobStore, DAILY_IMAGES, ImageError, prepare, type StoreFn } from './images.js'

/** A request body is at most 4.5 MB on Vercel; the app shrinks big photos before sending. */
export const MAX_UPLOAD = 4_400_000
export type Prepared = { src: string; width: number; height: number }
export interface UploadReply { kinds: Partial<Record<ImageKind, Prepared>>; refused: Partial<Record<ImageKind, string>> }

export function imagesHandler(deps: { userFrom: UserFrom; db: () => Db | null; store?: StoreFn | null; now?: () => number }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to add pictures.' }, { status: 401 })
    const db = deps.db(), store = deps.store === undefined ? blobStore() : deps.store
    if (!db || !store) return Response.json({ error: 'Pictures are not set up on this server.' }, { status: 503 })
    const asked = new URL(request.url).searchParams.get('kind') ?? 'all'
    const kinds = asked === 'all' ? [...IMAGE_KINDS] : (IMAGE_KINDS as readonly string[]).includes(asked) ? [asked as ImageKind] : null
    if (!kinds) return Response.json({ error: `kind: one of ${IMAGE_KINDS.join(', ')} or all.` }, { status: 400 })
    if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD) return Response.json({ error: 'The picture is over 4 MB.' }, { status: 413 })
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (!bytes.length) return Response.json({ error: 'No picture was sent.' }, { status: 400 })
    if (bytes.length > MAX_UPLOAD) return Response.json({ error: 'The picture is over 4 MB.' }, { status: 413 })
    const now = deps.now ?? Date.now
    if (await db.bumpRate(`img:${user.id}`, Math.floor(now() / 86_400_000)) > DAILY_IMAGES) return Response.json({ error: `At most ${DAILY_IMAGES} pictures a day.` }, { status: 429 })
    const reply: UploadReply = { kinds: {}, refused: {} }
    await Promise.all(kinds.map(async (kind) => {
      try {
        const p = await prepare(bytes, kind)
        reply.kinds[kind] = { src: await store(p.name, p.bytes, p.ext === 'png' ? 'image/png' : 'image/webp'), width: p.w, height: p.h }
      } catch (e) {
        if (!(e instanceof ImageError)) throw e
        reply.refused[kind] = `${e.message} ${e.fix}`
      }
    }))
    if (!Object.keys(reply.kinds).length) return Response.json({ error: Object.values(reply.refused)[0] ?? 'The picture could not be used.', refused: reply.refused }, { status: 422 })
    return Response.json(reply)
  }
}
