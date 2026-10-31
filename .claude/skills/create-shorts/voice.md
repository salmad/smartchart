# Directing the voice

The narration is a performance, not a reading. A flat, even read is the most common way a good script loses the viewer. You direct it in `say`, while writing the script, with three tools: **tags**, **punctuation**, and **shape**.

## Who is talking

An expert explaining something to a peer they respect: casual, sure, a little amused at the common mistake, generous with the fix. Think senior consultant at a whiteboard, not announcer, not hype, not teacher-to-child. Never "Hey guys", never "In this video".

## The arc

Every short has the same energy curve. Plan it before writing a word of `say`:

| Beat | Energy | Tone tags | Shape |
|---|---|---|---|
| Hook | medium, intriguing | `[knowing]`, `[knowing, slightly amused]`, `[curious]` | `...` before the payoff word: "Your slide titles... are wasting your best line." |
| Setup (the common way) | low, casual, a little dry | `[casual]`, `[flat]`, `[dry]` | Name the thing being shown, then a pause: "Most decks title this slide... revenue by region." |
| **The turn** | **highest: the video flips here** | `[beat] [emphatic]` | Question, then answer: "But partners? They write the answer." Short words, its own sentence. |
| Proof | confident, steady | `[confident]` | State the result plainly: "APAC drove 70% of this year's growth." |
| Steps / test | conversational, building | `[conversational]` …last item `[pointed]` | Parallel questions or commands; the last one gets "And … actually …" |
| Reflection | warm, slower | `[thoughtful]`, `[warm]` | One breath of `...` before the reassurance: "...you've nailed it." |
| Close | upbeat, then playful | `[upbeat]` … `[playful]` | Recap fast, then the loop line as a challenge: "Now go check your last slide title." |

**The turn is the most important line in the script.** If you can't point to it, the script has no turn; rewrite before voicing. It gets the strongest tag, its own beat, and the visual change lands on its key word (`cues: ["answer"]`).

## Tags (ElevenLabs v4)

Square brackets anywhere in `say`; they steer the next phrase and are neither spoken nor captioned. Free text works; these are reliable:

- tone: `[casual]` `[conversational]` `[confident]` `[knowing]` `[warm]` `[thoughtful]` `[dry]` `[flat]` `[curious]` `[upbeat]` `[playful]` `[pointed]` `[serious]`
- force: `[emphatic]` `[firmly]` `[softly]`
- time: `[beat]` (short pause) `[pause]` (longer)
- combine: `[knowing, slightly amused]`

One tag at the start of each scene, plus one at the turn. More than two per sentence and the read gets theatrical.

## Punctuation is direction

- `...` a held breath before a reveal. One or two per script, never in every line.
- `?` lifts the pitch; use it to set up the turn ("But partners?").
- `.` a full stop is a clean beat; short sentences sound sure.
- `,` keeps momentum; use it in lists you want rattled off.
- `:` a small setup pause before a payoff ("Here's the test:").
- No CAPS for emphasis (they show up in the captions); use `[emphatic]` and sentence shape instead.

## Words for the ear

- Contractions always ("here's", "you've", "don't").
- Say what the screen shows, exactly: if the slide reads "Revenue by region", the voice says "revenue by region". The match is what makes the visual land.
- Numbers as written on screen ("70%"); the captions use the script's spelling.
- No hedging ("kind of", "basically", "just"), no filler openers ("So,", "Okay,").

## Before and after (from real feedback)

| Flat (rejected) | Directed |
|---|---|
| "Your slide titles are wasting your best line." | "[knowing, slightly amused] Your slide titles... are wasting your best line." |
| "Most decks say: revenue by region." (said, not shown) | "[casual] Most decks title this slide... revenue by region." over a `slide` titled "Revenue by region" |
| "Partners write the answer: APAC drove 70% of this year's growth." (the turn buried mid-sentence) | "[beat] [emphatic] But partners? They write the answer. [confident] APAC drove 70% of this year's growth." with the retitle on "answer" |
| "Test every title. Is it a full sentence? …" | "[conversational] Here's the test. Is it a full sentence? Does it make one claim? [pointed] And does the chart actually prove it?" |
| "Now check your last slide title." | "[upbeat] … [playful] Now go check your last slide title." |

## Choosing the voice

New series, or the user dislikes the voice: `npm run audition -- <slug> 0 <turn scene>` renders the hook and the turn in eight voices; the user picks. Judge on the turn, not the hook: the voice that makes "But partners? They write the answer." land is the one. Default: Chris (`iP95p4xoKVk53GoZ742B`), casual, down-to-earth American, `pace` 1.04 (above 1.08 starts to sound processed).

## Fixing a take

`npm run voice` prints warnings when the transcript doesn't match the script (a tag read aloud, a word skipped). When the user says a line sounds wrong, change the direction of that line, not the voice:

- Too flat → add or strengthen the tag, shorten the sentence, add the `?`→answer shape.
- Rushed → split into two sentences or add `[beat]`; lower `pace`.
- Overacted → remove tags from that line, keep only the scene's opening tag.
- Choppy between scenes → never splice takes; the script is voiced as one take, check that each scene ends on a full stop, not `...`.
