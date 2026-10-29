# Short-form video (tool shorts)

Informational YouTube Shorts, TikToks and Reels about tools and craft: teach one thing, never sell.

**Agents:** use the `create-shorts` skill (`.cursor/skills/create-shorts/`). It runs the pipeline in `shorts/` with approval checkpoints.

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
- End on a recap or a line that loops to the hook; no "comment below", no "sign up".
- Real figures only. Disclose any paid relationship in the video itself ([FTC](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-social-media-influencers)).
