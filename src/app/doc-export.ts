/* Export a doc the visitor is reading: markdown from source, HTML from the mounted page, PDF via print. */
import { esc } from '@/engine/components/text'
import { downloadText, fileName } from './download'

const STYLES = () => [...document.querySelectorAll('link[rel="stylesheet"]')]
  .map((el) => `<link rel="stylesheet" href="${esc((el as HTMLLinkElement).href)}">`)
  .join('\n')

/** The doc file as saved (front matter and occam blocks). */
export function exportDocMarkdown(displayName: string, source: string) {
  downloadText(`${fileName(displayName)}.md`, source, 'text/markdown;charset=utf-8')
}

/** A standalone HTML file: the mounted article and styles from this page (figures stay as drawn SVG). */
export function exportDocHtml(displayName: string, root: HTMLElement) {
  const article = root.querySelector('article.doc')
  if (!article) return
  const title = esc(displayName)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
${STYLES()}
<style>
  body { margin: 0; }
  .doc-toc, .doc-toc-mini, .fold, .fig-expand, .fig-checks { display: none !important; }
  .doc-sec.folded > .sec-body { display: block; }
</style>
</head>
<body>
${article.outerHTML}
</body>
</html>`
  downloadText(`${fileName(displayName)}.html`, html, 'text/html;charset=utf-8')
}
