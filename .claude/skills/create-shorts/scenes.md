# short.json

```json
{
  "voice": { "model": "elevenlabs/eleven-v4", "voice": "JBFqnCBsd6RMkjVDRZzb", "pace": 1.08, "instructions": "" },
  "pinHook": true,
  "music": { "src": "bed.mp3", "volume": 0.08 },
  "scenes": [ ... ]
}
```

- `voice.pace`: speed-up applied after synthesis (1.0–1.15). `instructions` only matters for models that take delivery notes (Gemini, OpenAI, Fish); ElevenLabs uses inline `[tags]` in `say`.
- `pinHook`: after the hook, its text stays as a small header so late joiners know the topic. Default on.
- `music`: optional, a file in the episode folder, kept low under the voice. Default none.

Every scene has `say` (narration with delivery `[tags]`; its length sets the scene's length). Optional on every scene: `captions` (true/false; default on, off for `hook` and `statement` because their text is the caption) and `cues`: when each beat lands, one entry per beat, either a **word** in `say` (`"answer"`, preferred) or seconds from the scene start. Default: when the beat's first meaningful word is spoken.

**Prefer the visual types** (`slide`, `deck`, `shot`, `terminal`, `prompt`, `stat`): the lint warns when most middle scenes are just words.

## Narration names it → the scene shows it

| The voice says… | Scene | What moves |
|---|---|---|
| "this slide", "this chart", a title | `slide` | bars grow; `retitle` strikes and rewrites on the turn word; `checks` tick title or chart |
| "read your deck", "top to bottom", a storyline | `deck` | titles light one by one |
| "this button", "this setting", a UI | `shot` | camera pushes into `focus`, gold ring |
| a command, a shortcut, "run…" | `terminal` | the command types, output lands |
| "ask it…", "type…", an AI request | `prompt` | the prompt types, the reply lands |
| one number that is the point | `stat` | counts up |
| the old way vs the new way, no artefact to show | `compare` | old struck, new lands |
| steps or tells with nothing to show | `list` | items land on their words |

If the voice names an artefact and the scene is `statement`, the script is wrong, not the scene.

Text fields take `*emphasis*` (gold serif italic): one emphasised word or number per text. `\n` breaks a line in `statement`.

| type | Fields | Use for | Limits |
|---|---|---|---|
| `hook` | `text`, `kicker?` | The first second. Fully visible on frame 0. | ≤ 9 words; kicker = series name |
| `slide` | `title`, `bars[{label,value}]`, `retitle?`, `focus?`, `unit?`, `label?`, `bullets?[]`, `pick?`, `checks?[{text, on: title\|chart}]` | A real white slide with a bar chart. `retitle` strikes the title and writes the new one at its cue, lighting the `focus` bar gold; `checks` tick the title or the chart one by one. `bullets` start it as a bullet slide that gives way to the chart at the turn (without a turn it stays bullets); `pick` (an index or a list) rings the bullets that hold the point, one cue each, and dims the rest. Beats: picks, retitle, then each check | 3–5 bars; 3–5 bullets ≤ 6 words; titles ≤ 10 words; real or clearly illustrative data |
| `deck` | `titles[]` | Slides seen titles-only; each lights in turn, reading as a story | 3–4 titles that form an argument |
| `statement` | `text` | One idea, said big | ≤ 14 words |
| `list` | `title?`, `items[]` | Steps, tells, mistakes; newest bright, earlier dim | 2–5 items, 2–6 words each |
| `stat` | `value`, `label`, `source?` | One number that counts up | Real figures only; give `source` |
| `terminal` | `title?`, `steps[{cmd?, out?}]` | Commands typed live | ≤ 4 steps, short commands |
| `prompt` | `text`, `reply?` | A prompt typed into a chat bar, then the answer | text ≤ 90 chars; `cues[1]` = reply time |
| `shot` | `src`, `focus?{x,y,w,h}`, `zoom?`, `caption?` | A real screenshot; camera pushes into `focus` and rings it | image in the episode folder; focus as fractions of the image; `cues[0]` = push time |
| `compare` | `before{label,text}`, `after{label,text}` | Old way struck through, better way lands | each text ≤ 10 words |
| `recap` | `title?`, `items[]`, `loop?` | The close: checks, then the loop line | 2–4 items; `loop` points back to the hook |

## Layout (fixed, for reference)

1080×1920 at 30 fps. Scene content sits between y 300 and 1290; captions at y 1340; the pinned hook at y 196. The bottom ~420 px and the top ~180 px are covered by platform UI, so nothing important goes there.

## Example: the turn on a slide

```json
{ "type": "slide", "title": "Revenue by region", "retitle": "APAC drove *70%* of this year's growth",
  "bars": [{ "label": "APAC", "value": 70 }, { "label": "EMEA", "value": 16 }, { "label": "Americas", "value": 9 }, { "label": "Other", "value": 5 }],
  "focus": "APAC", "unit": "%", "cues": ["answer"],
  "say": "[casual] Most decks title this slide... revenue by region. [beat] [emphatic] But partners? They write the answer. [confident] APAC drove 70% of this year's growth." }
```

The full episode is `shorts/public/episodes/action-titles/short.json`.
