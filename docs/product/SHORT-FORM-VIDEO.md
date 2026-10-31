# Short-form video (tool shorts)

Informational YouTube Shorts, TikToks, Reels and LinkedIn videos about slide craft: teach one thing and show it done in Occam; never pitch.

**Agents:** use the `create-shorts` skill (`.claude/skills/create-shorts/`, symlinked from `.cursor/skills/`). It runs the pipeline in `shorts/` with approval checkpoints.

## Product-led, not a pitch

Shorts bring reach, not buyers: Shorts viewers rarely click or follow into long-form, so "teach, get subscribers, sell later" is weak on its own. Each short teaches a complete tip, and the fix is visibly made in Occam (a `shot` of the editor, a `prompt` into Occam's chat, the finished Occam slide). No call to action: viewers who like the result ask what made it. Research and sources: `docs/temp/shorts-strategy-2026-10-31.md`.

- **Pick topics Occam is needed for.** Score each idea 0–3 (Ahrefs' business potential): 0 Occam is irrelevant, 3 Occam is how the fix gets done. Make mostly 2s and 3s.
- **Three series, roughly 40 / 30 / 30:** consulting craft (reach), boss feedback decoded (shares), watch it fix it (a messy slide or AI deck becomes an Occam slide in one prompt; intent).
- **Somewhere to go:** each short's related video points to a long-form Occam walkthrough; the pinned comment carries a UTM link (`?utm_source=<platform>&utm_medium=short&utm_content=<slug>`).
- **Post the same 9:16 file natively on the founder's personal LinkedIn** (one-paragraph takeaway; the link goes in the first comment, never the post), plus YouTube, TikTok and Reels.
- **Score on visits and sign-ups, not only views.** The ledger has a column for them.

## Pipeline (`shorts/`, run from that folder)

```
npm run new -- <slug>        episode folder: public/episodes/<slug>/short.json + notes.md
npm run lint -- <slug>       script checks before any spend
npm run audition -- <slug>   the hook and the turn in eight voices, to pick one
npm run voice -- <slug>      one continuous, directed ElevenLabs v4 take via OpenRouter, word timings via Whisper
npm run render -- <slug> --draft   half-size draft + out/<slug>/sheet.jpg contact sheet
npm run render -- <slug>     final out/<slug>/<slug>.mp4 (1080×1920, −14 LUFS) + cover.jpg
npm run check -- <slug>      QA of the final file
npm run studio -- <slug>     live preview in Remotion Studio
npm run serve                hands renders to YouTube Studio in the browser panel for upload (see the skill, step 5)
npm run youtube -- publish <slug>   API upload via Composio (its shared daily cap is often full)
```

Scenes are configured, not designed, in the Occam ink-and-gold look. Show the thing (slide with a live chart and retitle, deck read titles-only, screenshot zoom, terminal, prompt, stat); words-on-background scenes are the exception. Results go in `shorts/ledger.md` so the next ideas lean on what worked.

Always upload the 9:16 file: a 16:9 upload never reaches the Shorts feed. Title = hook ` | ` searchable topic; three hashtags at the end of the description; no `#Shorts`.

## Quick rules

- Hook on screen at frame 0, voice from the first frame, ≤ 3 s to the promise.
- One idea, a visual change every 2–4 s, captions always, 20–45 s.
- End on a recap or a line that loops to the hook; no "comment below", no "sign up". Occam is shown doing the fix, never sold.
- Real figures only. Disclose any paid relationship in the video itself ([FTC](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-social-media-influencers)). Occam appears by name, so the connection is obvious; posting from a personal profile, say you build it (profile line and post).
