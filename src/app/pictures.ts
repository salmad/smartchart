/* Pictures from the maker: a picture dropped on the chat or picked in edit mode goes to /api/images, which prepares and
   stores it (api/_lib/images-route.ts). A big photo is shrunk in the browser first, so it fits one request. */
import type { ImageKind } from '@/engine/slides/images'

export interface UploadReply { kinds: Partial<Record<ImageKind, { src: string; width: number; height: number }>>; refused: Partial<Record<ImageKind, string>> }

export const PICTURE = /\.(png|jpe?g|webp|gif|svg|avif)$/i
const SEND_MAX = 4_000_000, LONG = 2400

/** A raster picture over the request limit is redrawn at most 2400 px on its longer side, as WebP. */
async function fit(file: Blob): Promise<Blob> {
  if (file.size <= SEND_MAX || file.type === 'image/svg+xml') return file
  const bmp = await createImageBitmap(file), k = Math.min(1, LONG / Math.max(bmp.width, bmp.height))
  const canvas = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k))
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return canvas.convertToBlob({ type: 'image/webp', quality: 0.92 })
}

/** Sends a picture to be prepared as `kind` ("all": every kind it can be, for the agent to pick from). */
export async function uploadPicture(file: Blob, kind: ImageKind | 'all'): Promise<UploadReply> {
  const body = await fit(file)
  const r = await fetch(`/api/images?kind=${kind}`, { method: 'POST', body, credentials: 'same-origin', headers: { 'content-type': body.type || 'application/octet-stream' } })
  const json = await r.json().catch(() => null) as (UploadReply & { error?: string }) | null
  if (!r.ok || !json) throw new Error(json?.error ?? (r.status === 401 ? 'Sign in to add pictures.' : 'The picture could not be added. Try again.'))
  return json
}

const USE: Record<ImageKind, string> = { photo: 'as a photo (a team photo, or a photo on an image slide)', screenshot: 'as a screenshot (an image slide)', logo: 'as a logo (a logos slide, a table row or column, a card)' }

/** What the agent reads for a picture: its src for each use it can have, and why the others are refused. */
export function pictureText(name: string, up: UploadReply): string {
  const kinds = Object.entries(up.kinds) as [ImageKind, { src: string; width: number; height: number }][]
  return [`A picture the user added (${name}). On a slide it is { "src": "…" } with the src for how it is used:`,
    ...kinds.map(([k, v]) => `- ${USE[k]}: ${JSON.stringify({ src: v.src })}`),
    ...(Object.entries(up.refused) as [ImageKind, string][]).map(([k, why]) => `- not usable ${USE[k].replace(/ \(.*\)$/, '')}: ${why}`),
    'An image slide also needs "alt": say what the picture shows. Never write a src that is not listed here.'].join('\n')
}

/** Opens the file picker and uploads the picture as `kind`: its src, null when the maker cancels; throws why it cannot. */
export function pickPicture(kind: ImageKind): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml'
    input.addEventListener('cancel', () => resolve(null))
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      uploadPicture(file, kind).then((up) => {
        const v = up.kinds[kind]
        if (v) resolve(v.src); else reject(new Error(up.refused[kind] ?? 'That picture cannot be used here.'))
      }, reject)
    })
    input.click()
  })
}
