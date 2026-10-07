/* Files dropped on the chat: read to text in the browser, then handed to the agent with the message. Only the text
   leaves the browser, inside the message. Each parser loads the first time a file of its kind arrives. A picture is the
   exception: it is uploaded (pictures.ts) and the agent reads the srcs it can use. */
import { PICTURE, pictureText, uploadPicture } from './pictures'

/** A file read to text: `about` says what was read ("4 pages", "2 sheets", "1,240 words") for its chip. */
export interface Attached { name: string; text: string; about: string; cut: boolean }

export const ACCEPT = '.pdf,.docx,.xlsx,.csv,.tsv,.md,.markdown,.txt,.json,.png,.jpg,.jpeg,.webp,.gif,.svg,.avif'
const MAX_BYTES = 20_000_000
/** Per file and in all: a long report is read in full; a data dump is cut, and the agent is told it was. */
export const MAX_CHARS = 40_000, MAX_TOTAL = 60_000

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
const words = (t: string) => `${(t.match(/\S+/g)?.length ?? 0).toLocaleString('en-GB')} words`
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** Reads one file to text. Throws with a sentence the chat can show when it can't. */
export async function readFile(file: File): Promise<Attached> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 20 MB.`)
  if (PICTURE.test(file.name)) {
    try { return { name: file.name, text: pictureText(file.name, await uploadPicture(file, 'all')), about: 'picture', cut: false } }
    catch (e) { throw new Error(`${file.name}: ${e instanceof Error ? e.message : String(e)}`) }
  }
  const kind = ext(file.name)
  let text: string, about: string
  try {
    if (kind === 'pdf') ({ text, about } = await readPdf(file))
    else if (kind === 'docx') { text = await readDocx(file); about = words(text) }
    else if (kind === 'xlsx') ({ text, about } = await readXlsx(file))
    else if (['csv', 'tsv', 'md', 'markdown', 'txt', 'json'].includes(kind)) { text = await file.text(); about = kind === 'csv' || kind === 'tsv' ? plural(text.split(/\r?\n/).filter((l) => l.trim()).length, 'row') : words(text) }
    else throw new Error(`${file.name}: Occam reads PDF, Word, Excel, CSV, Markdown and text files, and pictures.`)
  } catch (e) {
    if (e instanceof Error && e.message.startsWith(file.name)) throw e
    throw new Error(`${file.name} couldn’t be read. Is it open in another app, or protected with a password?`)
  }
  text = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!text) throw new Error(`${file.name} has no text Occam can read${kind === 'pdf' ? ' (a scanned PDF is a picture of text)' : ''}.`)
  const cut = text.length > MAX_CHARS
  return { name: file.name, text: cut ? text.slice(0, MAX_CHARS) : text, about, cut }
}

async function readPdf(file: File): Promise<{ text: string; about: string }> {
  const [pdfjs, { default: worker }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }), doc = await task.promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    pages.push(content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join(''))
  }
  void task.destroy()
  return { text: pages.join('\n\n'), about: plural(doc.numPages, 'page') }
}

async function readDocx(file: File): Promise<string> {
  const mammoth = (await import('mammoth')).default
  return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
}

/** Every sheet as tab-separated rows under its name: a table the agent reads like a pasted one. */
async function readXlsx(file: File): Promise<{ text: string; about: string }> {
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  const sheets = await readXlsxFile(file)
  const cell = (v: unknown) => v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? '' : String(v)
  const text = sheets.map((s) => `Sheet: ${s.sheet}\n${s.data.map((row) => row.map(cell).join('\t').replace(/\t+$/, '')).filter((r) => r.trim()).join('\n')}`).join('\n\n')
  return { text, about: plural(sheets.length, 'sheet') }
}

/** The message the agent reads: what the user typed, then each file between markers, cut to the total budget. */
export function withFiles(text: string, files: Attached[]): string {
  if (!files.length) return text
  let left = MAX_TOTAL
  const parts = files.map((f) => {
    const body = f.text.slice(0, Math.max(0, left)), cut = f.cut || body.length < f.text.length
    left -= body.length
    return `<file name="${f.name.replace(/"/g, "'")}"${cut ? ' cut="true"' : ''}>\n${body}\n</file>`
  })
  const ask = text.trim() || 'Make the slides this material argues for.'
  return `${ask}\n\nAttached (${files.map((f) => f.name).join(', ')}):\n\n${parts.join('\n\n')}`
}

/** What routing reads: the ask and the start of each file. The whole files go to the writer only. */
export function briefOf(text: string, files: Attached[]): string {
  if (!files.length) return text
  const ask = text.trim() || 'Make the slides this material argues for.'
  return `${ask}\n\n${files.map((f) => `Attached ${f.name} (${f.about}), starting:\n${f.text.slice(0, 1200)}`).join('\n\n')}`
}
