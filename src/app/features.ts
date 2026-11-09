/* Product feature toggles (Vite env, default on). Off with VITE_*=0 or false; force on with 1 or true. */

const envFlag = (raw: string | undefined): boolean | null => {
  if (raw === '0' || raw === 'false') return false
  if (raw === '1' || raw === 'true') return true
  return null
}

/** Occam's ready-made block rewrites: auto-suggest on open, margin marks, and the Suggestions list from the model.
    Code checks, Dismiss, Ask Occam to fix, and agent propose_block suggestions stay on when this is off. */
export function docBlockSuggestionsEnabled(): boolean {
  const fromEnv = envFlag(import.meta.env.VITE_DOC_BLOCK_SUGGESTIONS as string | undefined)
  if (fromEnv !== null) return fromEnv
  return true
}
