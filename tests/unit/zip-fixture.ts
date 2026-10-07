/** A minimal zip writer for tests: each file stored, or deflated when `deflate` is set. */
export async function makeZip(files: Record<string, string>, deflate = false): Promise<Uint8Array> {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], dir: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text), n = enc.encode(name)
    const body = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw
    const local = new Uint8Array(30 + n.length), lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, deflate ? 8 : 0, true); lv.setUint32(18, body.length, true); lv.setUint32(22, raw.length, true); lv.setUint16(26, n.length, true)
    local.set(n, 30)
    const central = new Uint8Array(46 + n.length), cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, deflate ? 8 : 0, true); cv.setUint32(20, body.length, true); cv.setUint32(24, raw.length, true); cv.setUint16(28, n.length, true); cv.setUint32(42, offset, true)
    central.set(n, 46)
    parts.push(local, body); dir.push(central); offset += local.length + body.length
  }
  const dirLen = dir.reduce((a, d) => a + d.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, dir.length, true); ev.setUint16(10, dir.length, true); ev.setUint32(12, dirLen, true); ev.setUint32(16, offset, true)
  const all = [...parts, ...dir, end], out = new Uint8Array(all.reduce((a, p) => a + p.length, 0))
  let at = 0
  for (const p of all) { out.set(p, at); at += p.length }
  return out
}

export const slideXml = (title: string, body: string[]) => `<?xml version="1.0"?><p:sld><p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:txBody>${body.map((b) => `<a:p><a:r><a:t>${b}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`
