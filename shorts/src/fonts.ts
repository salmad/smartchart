import { cancelRender, continueRender, delayRender, staticFile } from 'remotion'

// Bundled woff2s, so a render needs no network. Registered in a microtask: after Remotion has initialised its
// delay-render list, before the first frame is captured.
const faces: [family: string, file: string, desc: FontFaceDescriptors][] = [
  ['Archivo', 'archivo-latin-wdth-normal.woff2', { weight: '100 900', stretch: '62% 125%' }],
  ['Geist', 'geist-latin-wght-normal.woff2', { weight: '100 900' }],
  ['Geist Mono', 'geist-mono-latin-wght-normal.woff2', { weight: '100 900' }],
  ['Instrument Serif', 'instrument-serif-latin-400-normal.woff2', { weight: '400' }],
  ['Instrument Serif', 'instrument-serif-latin-400-italic.woff2', { weight: '400', style: 'italic' }],
]

let started = false
export function loadFonts() {
  if (started || typeof FontFace === 'undefined') return
  started = true
  queueMicrotask(() => {
    for (const [family, file, desc] of faces) {
      const handle = delayRender(`font ${file}`)
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, desc)
      face.load()
        .then(() => { document.fonts.add(face); continueRender(handle) })
        .catch((e) => cancelRender(new Error(`font ${file} failed: ${e}`)))
    }
  })
}
