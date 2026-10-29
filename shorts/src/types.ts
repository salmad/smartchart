// The episode spec (public/episodes/<slug>/short.json) as the agent writes it, and the props render.mjs builds from it.
// Text fields take *emphasis*: the words between asterisks set in gold serif italic.

export type Word = { text: string; start: number; end: number }

type Base = {
  /** Narration for this scene, spoken by the voice model. */
  say: string
  /** Word captions under the scene. Default: on, except hook and statement (their text is the caption). */
  captions?: boolean
  /** When each item/step/beat lands: seconds from scene start, or a word in `say` to land on.
   *  Default: when the item's first word is spoken. */
  cues?: (number | string)[]
}

export type Bar = { label: string; value: number }

export type Scene = Base & (
  | { type: 'hook'; text: string; kicker?: string }
  | { type: 'statement'; text: string }
  | { type: 'list'; title?: string; items: string[] }
  | { type: 'stat'; value: string; label: string; source?: string }
  | { type: 'terminal'; title?: string; steps: { cmd?: string; out?: string }[] }
  | { type: 'prompt'; text: string; reply?: string }
  | { type: 'shot'; src: string; focus?: { x: number; y: number; w: number; h: number }; zoom?: number; caption?: string }
  | { type: 'compare'; before: { label: string; text: string }; after: { label: string; text: string } }
  | { type: 'recap'; title?: string; items: string[]; loop?: string }
  /** A real-looking slide with a bar chart. The turn (first cue) happens when there is a `retitle` or the bars start
   *  `rainbow`: the title is rewritten and/or every bar goes grey while the `focus` bar lights. `checks` pin ticks to the
   *  title or the chart, one cue each after the turn. `label` is the tag above the slide, or [before, after] the turn. */
  | { type: 'slide'; title: string; retitle?: string; bars: Bar[]; focus?: string; unit?: string; label?: string | [string, string];
      before?: 'rainbow'; checks?: { text: string; on: 'title' | 'chart' }[] }
  /** A deck seen titles-only. Without `reorder`, each title lights in turn, reading as a story. With `reorder` (the
   *  title indices in their new order), at the first cue the slides move into that order and the new first one lights. */
  | { type: 'deck'; titles: string[]; reorder?: number[] }
)

export type Spec = {
  voice: { model: string; voice: string; pace?: number; instructions?: string }
  /** Keep the hook as a small header after the hook scene. Default true. */
  pinHook?: boolean
  /** Optional bed under the voice, a file in the episode folder. */
  music?: { src: string; volume?: number }
  scenes: Scene[]
}

/** A scene placed on the timeline: seconds from the start of the video. */
export type Placed = Scene & { from: number; dur: number; words: Word[] }

export type ShortProps = {
  scenes: Placed[]
  /** The single voice take, under the whole video. */
  voice?: string
  pinned?: string
  music?: { src: string; volume: number }
  /** Folder under public/ holding the episode's media. */
  base: string
}
