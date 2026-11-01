# Short-form video (tool shorts)

Informational YouTube Shorts, TikToks, Reels and LinkedIn videos about slide craft: teach one thing and show it done in Occam; never pitch.

**Agents:** use the `create-shorts` skill (`.claude/skills/create-shorts/`, symlinked from `.cursor/skills/`). It runs the pipeline in `shorts/` with approval checkpoints.

## Product-led, not a pitch

Shorts bring reach, not buyers: Shorts viewers rarely click or follow into long-form, so "teach, get subscribers, sell later" is weak on its own. Each short teaches a complete tip, and the fix is visibly made in Occam (a `shot` of the editor, a `prompt` into Occam's chat, the finished Occam slide). No call to action: viewers who like the result ask what made it. Research and sources: `docs/temp/shorts-strategy-2026-10-31.md`.

- **Pick topics Occam is needed for.** Score each idea 0–3 (Ahrefs' business potential): 0 Occam is irrelevant, 3 Occam is how the fix gets done. Make mostly 2s and 3s.
- **Three series, roughly 40 / 30 / 30:** consulting craft (reach), boss feedback decoded (shares), watch it fix it (a messy slide or AI deck becomes an Occam slide in one prompt; intent).
- **Somewhere to go:** each short's related video points to a long-form Occam walkthrough; every short has its own path per platform, `occamslides.com/<yt|ig|tt|x>/<slug>`: the site serves the home page there and keeps the path, so Vercel Web Analytics' Pages panel shows visits per short and platform (UTM parameters need a paid Vercel plan). YouTube's pinned comment links it; Instagram and TikTok captions and comments are not clickable, so the caption ends "Made in Occam · occamslides.com/ig/<slug> (link in bio)", the first comment repeats it, and each reel is shared to Stories with a link sticker to the same path. Bio links are `/ig` and `/tt`; bio taps can't be split per reel, so read them against the posting dates. `npm run postproxy -- update-copy` pushes regenerated copy to scheduled posts. **TikTok (@occamstudio):** same caption as Reels; schedule via PostProxy (`npm run social -- tiktok <slug> --write`, `npm run postproxy -- schedule-tiktok-all` — publishes `one-color` now, rest on IG dates). PostProxy has no TikTok first-comment API: after each video goes live, pin `pinnedComment` from `tiktok.json` manually. **X (@occamstudio):** hook + takeaway tweet, link in a reply thread; `npm run postproxy -- publish-twitter` / `schedule-twitter-all`. Profile setup: `docs/temp/x-account-2026-11-01.md`. The video itself stays free of calls to action.
- **Post the same 9:16 file natively on the founder's personal LinkedIn** (one-paragraph takeaway; the link goes in the first comment, never the post), plus YouTube, TikTok and Reels.
- **Score on visits and sign-ups, not only views.** The ledger has a column for them.

## Cadence (how accounts grow)

No platform publishes a frequency rule; the best data is correlational, so treat these as defaults to test against the ledger.

- **Steady, not bursts: Sun, Tue and Thu at 5 PM Gulf** on every platform (~3 per week, Sunday included). Buffer's 2M-post Instagram study found the biggest growth step is going from 1–2 to 3–5 posts a week; Shorts guides converge on 3–5 a week; several sources warn that bursts on a new account read as spam. Never post two on the same day.
- **Same file everywhere, uploaded natively**: YouTube Shorts, TikTok, Reels and the founder's LinkedIn. No watermarks from another app, no cross-links in the post.
- **One long-form a fortnight on YouTube** on a searchable topic ("how to write consulting slide titles"), with the shorts linking to it. AIR Media-Tech's 18,000-channel analysis recommends new channels lead with searchable long-form and run Shorts beside it; long-form is also where buying happens.
- **Series over one-offs**: the same kicker and look every time, so a viewer recognises the next one.
- **The first hour**: reply to every comment; pin the second tip.
- **Change the mix on data**: at 48 h and 7 d fill the ledger; after every 6 posts, drop the weakest series or hook style and give its slots to the strongest.

Sources: [AIR Media-Tech](https://air.io/en/youtube-hacks/should-you-chase-shorts-views-or-double-down-on-long-form-for-channel-growth), [Metricool](https://metricool.com/instagram-vs-tiktok/), [Social Insider](https://www.socialinsider.io/reports/tiktok-engagement-benchmarks), [Shortzly](https://shortzly.com/blog/youtube-shorts-channel-growth-strategy).

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
