/* Code, as written: mono on a quiet panel, wrapped rather than scrolled (a canvas is scaled, never scrolled). */
import { esc } from "./text.js";

export const codeHTML = (text: string, lang: string): string => `<pre class="code" data-lang="${esc(lang)}"><code>${esc(text)}</code></pre>`;
