---
name: create-shorts
description: >-
  Runs the Occam shorts pipeline end to end: idea, hook, script, ElevenLabs voice through OpenRouter, Remotion
  motion render, QA and post copy, with approval checkpoints. Produces production-ready 9:16 informational shorts
  (YouTube Shorts, TikTok, Reels, LinkedIn) aimed at views, shares and site visits: product-led teaching that
  shows the fix done in Occam without pitching it, with directed voiceover (tone,
  inflection, the turn) and visuals that show what the narration names. Use when the user asks for a short, reel,
  TikTok, a batch of shorts, hook variants, to make/render/voice a short video, or says a voiceover sounds flat,
  choppy or wrong.
---

# Create shorts

The pipeline lives in `shorts/` (a standalone Remotion package; run every command from `shorts/`). You write one file per episode, `public/episodes/<slug>/short.json`; the scripts voice it, time it, render it and check it. Everything visual is code you configure, never design per episode.

Read before writing any script: [voice.md](voice.md) (how the narration is performed: register, the arc, the turn, tags) and [scenes.md](scenes.md) (scene types, and which one shows what the narration names). Editorial craft (hooks, formats, what the data says): [reference.md](reference.md).

## The goal

Views come from three things, in this order: **the first second** (hook on screen at frame 0, voice starts immediately), **retention** (one idea, a visual change every 2–4 s, captions always, 20–45 s), and **the end** (a recap or a line that loops back to the hook, so people rewatch). Teach one complete thing, and **show it done in Occam**: the fixed slide is Occam's, the tool is on screen (a `shot` of the editor, a `prompt` into Occam's chat), and the voice may name it once as the tool in use ("in Occam, one prompt"). Never pitch: no "sign up", no "link in bio", no feature tour. The tip must still work for a viewer who never opens Occam.

Shorts bring reach, not buyers, so every short also points somewhere: the related video (a long-form Occam walkthrough) and the short's own link (`occamslides.com/<platform>/<slug>`) in the pinned comment. Strategy and sources: `docs/product/SHORT-FORM-VIDEO.md`.

## Pipeline

Copy this checklist into the episode's `notes.md` and tick as you go. ⏸ marks a checkpoint: stop, show the user, wait for a yes. If the user says "autopilot", skip checkpoints 2–4 but never 1 and 5.

```
- [ ] 1 Angle and hook ⏸
- [ ] 2 Script ⏸
- [ ] 3 Voice ⏸
- [ ] 4 Draft ⏸
- [ ] 5 Final and post copy ⏸
- [ ] 6 Results logged
```

### 0. Before anything
Read `shorts/ledger.md`. Formats and hook styles that beat the channel median get more slots; ones that lost get one more try with a different hook, then drop.

### 1. Angle and hook ⏸
`npm run new -- <slug>`. In `notes.md`, fill the angle: who it's for, the one pain or payoff, the format (see reference.md, formats), who would send it to whom, the series (consulting craft, boss feedback decoded, watch it fix it), and its **business potential** 0–3 (0 Occam is irrelevant, 3 Occam is how the fix gets done; prefer 2–3) with where Occam shows on screen. Write **three hooks** of different kinds (problem, result, contrarian, error, number). Show the user the angle and the three hooks; recommend one.

### 2. Script ⏸
Write `short.json` (fields in [scenes.md](scenes.md)): hook → 2–4 beats → recap. Rules:
- **Show, don't caption.** When the narration names a thing (a slide, a chart, a command, a screen, a number), the scene must show that thing moving: `slide`, `deck`, `shot`, `terminal`, `prompt`, `stat`. Words-on-background scenes (`statement`, `list`, `compare`) are for the rare abstract beat; at most one in the middle. "Most decks title this slide 'Revenue by region'" is a `slide` with that title, not a sentence on screen.
- **Occam makes the fix.** At or after the turn, show the fix happening in Occam: a `shot` of the Occam editor (screenshot in the episode folder), a `prompt` typed into Occam's chat, or the finished slide. Name Occam at most once, as the tool in use, never as an offer.
- **Find the turn.** Every short has one moment where it flips from problem to answer ("But partners? They write the answer."). Put it on its own beat, make the visual change land on that word (`cues: ["answer"]`), and direct the voice to hit it hardest.
- **Direct the voice as you write.** Every `say` carries its delivery, following the arc in [voice.md](voice.md): a tone tag opening each scene, `[beat] [emphatic]` and a question→answer shape at the turn, `...` before a reveal. The voice says exactly what the screen shows.
- Hook `say` lands in ≤ 3 s; hook `text` ≤ 9 words with one *emphasised* word.
- One scene per beat; split any scene over ~7 s.
- Every figure the user gave, exactly; never invent a statistic. Opinions as opinions.
- End on `recap` with a `loop` line that points back to the hook.
- Write `say` for the ear: short sentences, contractions, numbers as people say them only when the script can't show them.

Run `npm run lint -- <slug>` and fix errors; weigh each warning (it flags text-heavy scripts and undirected voices). Show the user a table per scene: what's on screen (and what moves), the narration with its tags, and mark the turn. Then the estimated length.

### 3. Voice ⏸
New series, or the user didn't like the last voice: `npm run audition -- <slug> 0 <turn scene>` voices the hook and the turn in eight voices (`voice/audition/`); the user picks, judging on the turn. Default: **ElevenLabs v4**, Chris `iP95p4xoKVk53GoZ742B` (casual, down-to-earth), `pace` 1.04. Voices are ElevenLabs **ids**: a wrong id is a 400, a *name* silently falls back to a default voice.

Then `npm run voice -- <slug>`. Read its warnings (a tag spoken aloud, a skipped word) and fix the line before rendering. The whole script is voiced as **one take** so it flows like one speaker; scenes and captions are cut to its word timings. Never voice scenes separately and splice them: the intonation resets every line and it sounds chopped. Any edit re-voices the whole take (a few cents); an unchanged script reuses the cached take. Give the user the take path the command prints. When they say a line sounds wrong (flat, rushed, no inflection), change that line's direction per [voice.md](voice.md#fixing-a-take), not the voice.

### 4. Draft ⏸
`npm run render -- <slug> --draft` (half size, about a minute). Then **look at `out/<slug>/sheet.jpg` yourself** (first frame, then each scene) before showing the user. Check: frame 0 shows the hook in full; nothing clipped or overlapping the captions; nothing in the bottom ~420 px except captions; emphasis lands on the word that matters. Fix by editing `short.json` (shorter text, `cues`, `captions: false`), not by touching the components. For motion problems use `npm run studio -- <slug>`.

### 5. Final, post copy and upload ⏸
`npm run render -- <slug>` then `npm run check -- <slug>` (1080×1920, ≤ 60 s, −14 LUFS). Fill the **Post** section of `notes.md` (YouTube's own guidance, [support.google.com/youtube/answer/6390658](https://support.google.com/youtube/answer/6390658)):
- **Title** (≤ 100, aim ≤ 60): the hook, then ` | ` and the searchable topic: "Stop naming slides like folders | Action titles". No hashtags in the title.
- **Description**: two plain sentences: what it teaches, with the phrase people search ("how consultants write slide titles"), then the one-line takeaway. No keyword stuffing.
- **Hashtags**: exactly three, at the end of the description, topic first (`#consulting #powerpoint #presentationtips`). YouTube shows up to three above the title; more dilutes them, 60+ voids them all. No `#Shorts`: a vertical file under 3 minutes is a Short automatically.
- **Pinned comment**: a second tip that rewards the viewer (not "subscribe"), then one plain line with the short's own path: "Made in Occam: occamslides.com/yt/<slug>" (per-short paths are how visits are attributed; see `docs/product/SHORT-FORM-VIDEO.md`). Post and pin it in Studio after publishing.
- **Related video**: set it to the long-form Occam walkthrough once one exists.
- **LinkedIn**: the same 9:16 file uploaded natively to the founder's personal profile, with a one-paragraph takeaway and a line saying they build Occam. The link (`occamslides.com/li/<slug>`) goes in the first comment, never the post. TikTok and Reels get the same file with their own paths (`/tt/<slug>`, `/ig/<slug>`).

Show the user the post copy, then upload, always the 9:16 file:
- **Studio in the browser panel** (works today): YouTube Studio open and signed in to the channel. Start `npm run serve` in the background; in the page, open Create → Upload videos, then with `Runtime.evaluate` fetch `http://127.0.0.1:8765/<slug>/<slug>.mp4`, wrap it in a `File`, assign it to `input[type=file][name=Filedata]` through a `DataTransfer` and dispatch `change`. Fill `#title-textarea #textbox` and `#description-textarea #textbox` with `execCommand('insertText')`, choose `VIDEO_MADE_FOR_KIDS_NOT_MFK`, click `#next-button` three times, wait for "Checks complete", choose `PUBLIC`, click `#done-button`, read the link from the share dialog. To schedule instead: click `#second-container-expand-button`; the date defaults to tomorrow; for another day click `#datepicker-trigger` and then the day cell inside that month's block (typing a date does not register); for the time, click `#second-container input` and then the `tp-yt-paper-item` whose text matches `/^5:00\s*PM$/` (Studio uses a narrow no-break space; typing the time shows it but schedules midnight). Times are the browser's time zone. Confirm the date and time in the "Video scheduled" dialog text, not a screenshot (the panel's screenshots can be stale). The browser panel must stay visible: when it's hidden, the calendar renders empty and typing into the title stops registering. Stop the server afterwards. Write `out/<slug>/youtube.json` and the ledger row.
- **API** (`npm run youtube -- publish <slug>`, via Composio): one command, but Composio's shared upload cap is often exhausted; fall back to Studio.
- **Reels and TikTok** (browser panel, after Meta / TikTok login): `npm run social -- instagram <slug> --write` and `npm run social -- tiktok <slug> --write` build the caption (ending "Made in Occam · link in bio"), the pinned comment and the story link from `notes.md`, keeping an existing file's `publishAt` and `via` (else the YouTube `publishAt`). Links in captions and comments are not clickable on either app, so the clickable paths are the bio link and a story link sticker. Meta blocks the local-server fetch and CDP file inputs: pick the MP4s in the macOS file dialog (Business Suite bulk upload: `Add videos`, then per row caption, Publish now → Schedule, date, Update; bottom Publish once every row says Schedule). **After each goes live:** post and pin `pinnedComment` (names the short's own path, `occamslides.com/ig/<slug>` or `/tt/<slug>`), share the reel to Stories with a link sticker to `storyLink` titled "Make this slide", and add it to the "Make a slide" highlight. Record `url` and `"via": "studio"` in `out/<slug>/instagram.json` / `tiktok.json`. Profile setup and research: `docs/temp/instagram-traffic-2026-11-01.md`.

A/B variants: post them days apart when possible; same-night posts compete for the same first viewers.

### 6. Results
At 48 h and 7 d read the Short's analytics in Studio (Analytics → Content → Shorts, or the video's own analytics): views, **viewed vs swiped away** (the hook's score), average % viewed and rewatches (retention and the loop), shares and subscribers gained; then site visits for the short's paths (`/yt/<slug>`, `/ig/<slug>`, `/tt/<slug>`, `/x/<slug>`) in Vercel Web Analytics → Pages, and sign-ups. Views pick the hooks; visits and sign-ups pick the series and topics. Fill the episode's Results table and the ledger row, and one line on what to repeat or drop. Compare variants on viewed vs swiped away first.

## Batches and variants

- **Hook variants**: copy the episode folder (without `voice/`) to `<slug>-b`, change only scene 0, voice and render it. Post variants days apart, not the same day.
- **Series**: a recurring kicker ("Consulting craft", "Deck fixes") builds recognition faster than a logo.
- 3–5 posts a week beats one perfect post; breakouts are rare spikes, so volume and testing matter.

## When something breaks

- Studio upload: `Failed to fetch` on `127.0.0.1:8765` means the browser panel blocks a public page from reading localhost (seen 2026-11-01), and the panel opens popups in the same tab, so a relay page doesn't work either. Then use the API, or hand the user the files and schedule to upload in Studio themselves.
- `speech 4xx`: model or voice id wrong; check `https://openrouter.ai/api/v1/models?output_modalities=speech`.
- Captions or scene cuts drift: the take mispronounced or skipped a word; rephrase that `say` and re-voice.
- Render fails on a font or image: the file must be under `public/` (images in the episode folder, path relative to it).
- New scene types are code: add a component in `shorts/src/scenes/`, wire it in `Short.tsx`, document it in [scenes.md](scenes.md). Only when no existing type can carry the idea.
