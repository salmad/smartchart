/* The app's stylesheet (122 kB) blocks the first paint, so on a visit with an empty cache nothing shows until it has
   arrived, though index.html carries the little CSS its static frame needs. This takes the stylesheet's <link> out of the
   page and hands its address to the inline script, which fetches it without blocking and exposes a promise for when it
   applies (`window.__css`); main.tsx starts React after that, so the app never draws unstyled. */
import type { Plugin } from 'vite'

const LINK = /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>\s*/

export function asyncCss(): Plugin {
  return {
    name: 'async-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const href = LINK.exec(html)?.[1]
        if (!href) return html
        return html.replace(LINK, '').replace('/*stylesheet*/null', `/*stylesheet*/${JSON.stringify(href)}`)
      },
    },
  }
}
