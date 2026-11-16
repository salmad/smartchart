/** Find an issue by its name the way people type it: words in any order, cut short, or with a slip of the keys.
    Every word of the query has to land on some word of the title; nothing is ranked, so the tree keeps its order. */

/** Lower case, accents dropped, split at anything that is not a letter or a digit. */
export function searchWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/** Edits apart, counting a swap of two neighbours as one (optimal string alignment). */
function editDistance(a: string, b: string): number {
  const rows: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    rows.push([i])
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) { rows[0].push(j); continue }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1)
      rows[i].push(d)
    }
  }
  return rows[a.length][b.length]
}

/** Its letters appear in order inside the word (`mktg` in `marketing`), starting at the word's first letter. */
function inOrder(token: string, word: string): boolean {
  if (token[0] !== word[0]) return false
  let at = 0
  for (const ch of word) if (ch === token[at] && ++at === token.length) return true
  return false
}

/** How many slips a word of this length may carry: none below four letters, then one, then two from eight. */
function slack(token: string): number {
  return token.length < 4 ? 0 : token.length < 8 ? 1 : 2
}

function wordMatches(token: string, word: string): boolean {
  if (word.includes(token)) return true
  if (token.length < 3) return false
  if (inOrder(token, word)) return true
  const k = slack(token)
  if (!k) return false
  // A typo in a word cut short: compare with the word's start at about the token's length.
  for (let n = token.length - k; n <= token.length + k; n++) {
    if (n < 1 || n > word.length) continue
    if (editDistance(token, word.slice(0, n)) <= k) return true
  }
  return false
}

/** A query ready to test titles against; an empty or blank query is null and keeps everything. */
export interface NameQuery { tokens: string[] }

export function nameQuery(query: string): NameQuery | null {
  const tokens = searchWords(query)
  return tokens.length ? { tokens } : null
}

/** True when every word of the query lands on a word of the title. */
export function nameMatches(q: NameQuery, title: string): boolean {
  const words = searchWords(title)
  // `roadmap` still finds "Road map".
  const joined = words.join('')
  return q.tokens.every((t) => (t.length >= 4 && joined.includes(t)) || words.some((w) => wordMatches(t, w)))
}
