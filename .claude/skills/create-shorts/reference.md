# Short-form video reference

Research-backed playbook for **informational tool shorts** (edu-first, product-led: the fix is shown in Occam, never pitched). Sources linked for updates; treat performance claims as hypotheses to test on your channel.

## Structures

### Universal edu arc (15–60s)

1. **Hook (0–3s)** — payoff or stakes; **on-screen text** + voice  
2. **Promise (3–6s)** — what they’ll know or do by the end  
3. **Teach (10–35s)** — one idea, ordered steps, no backstory  
4. **Proof** — screen recording, before/after, terminal output  
5. **Close (2–5s)** — **recap** or one action (“try this on your next export”)

References: [Zella — educational viral content](https://zellahq.com/blog/how-to-make-educational-content-that-goes-viral/), [Shino — educational shorts 2026](https://shino.app/blog/educational-short-videos-guide)

### B2B / dev-tool 45s beats

| Beat | Time | Content |
|------|------|---------|
| Problem hook | 0–3s | Error, manual hack, recognizable frustration |
| Mechanism | 4–15s | Why it works (one config, one API call) |
| Execution | 16–35s | Real UI; slight speed-up; zoom on critical control |
| Takeaway | 36–45s | One principle; optional “full walkthrough on channel” |

References: [Pulse — B2B short-form](https://usepulse.ai/blog/short-form-video-strategy-for-b2b-tech), [Komet — dev tools shorts](https://www.kometmedia.com/blogs/short-form-video-for-developer-tools-and-api-companies), [VidNo — dev Shorts](https://vidno.ai/blog/youtube-shorts-developers)

### Narrative arc (15–90s)

Hook → stakes → insight (one sentence + micro example) → proof → action.  
Reference: [Influencers Time — narrative arcs](https://www.influencers-time.com/crafting-narrative-arcs-for-short-burst-educational-videos/)

## Formats

Rotate these; same demo can become multiple posts with different hooks.

| # | Format | When to use |
|---|--------|-------------|
| 1 | **15s feature demo** | One visible action → clear result; show result first |
| 2 | **Before/after workflow** | Same input, two processes (honest comparison) |
| 3 | **“Stop doing X”** | Correct a specific habit, not the viewer |
| 4 | **Editorial hot take** | Opinion tied to a real buyer/user problem |
| 5 | **Customer moment** | Real permission only; disclose if material connection |
| 6 | **Tutorial cutdown** | Self-contained slice; re-record hook if needed |

Reference: [Tinrovic — six SaaS Shorts formats](https://tinrovic.com/blog/youtube-shorts-for-saas)

### Hook patterns (tool / dev content)

- Resource burn: “You’re spending [X] on [Y]…”
- Misconception: “Most people do X; it causes Y”
- **Error + fix** — error message in frame 1
- Listicle: “3 settings that…”
- Did-you-know: one command, shortcut, or setting
- Role frame: “As a [role], …” (test; niche-dependent)

Reference: [Gen.pro — dev tool hooks](https://gen.pro/blog/top-10-hooks-developer-tools-creators/)

**Multipost from one demo:** extract mechanism → pain → draft 3 hook framings → assign format per hook → stagger posts → compare **saves ÷ views**.

## What data suggests (test, don’t worship)

From [Postdom — 1,272 shorts](https://postdom.com/research/what-makes-a-video-go-viral):

- On-screen hook text associated with higher views vs spoken-only in their sample
- List and story formats beat one uncut take in their sample
- **Recap/summary endings** associated with higher views vs “let me know below”
- Breakouts are spiky: many accounts had at least one **10×+** video vs median
- Software/apps niche showed wide best-vs-median spreads

From [SSRN — 300 educational Reels](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7600885): which **account** explains much of view variance; simple hook-length rules were weak predictors inside accounts. **Information density** and clear visual support correlate with quality ratings—not guaranteed views.

## Editing rhythm

- **Captions always** (muted viewing is common)
- Visual change roughly every **2.5–4s** (cut, zoom, highlight, B-roll)
- **Zoom** on the one control that matters
- Prefer edited pacing over single long take
- First frame: UI in context often beats logo/product macro (directional in Postdom)

## Anti-patterns

- Logo or “we built…” in first 3 seconds
- Withholding the answer to force a click
- “Sign up for free trial” as the ending
- Generic AI voice + stock B-roll with no real UI proof
- Vague engagement CTAs (“thoughts?”, “let me know below”)
- Product tour across many features in one short

## Disclosure

If there is a **material connection** (paid, employment, free/discounted access, affiliate): disclose **clearly and conspicuously** in the video (visual + spoken when possible), not buried in hashtags or “see bio.”

- [FTC — Disclosures 101 for influencers](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-social-media-influencers)
- [FTC — Endorsement Guides FAQ](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)

No disclosure needed when you bought a tool yourself and weren’t compensated to mention it.

## Tools and workflow

**Our pipeline** (`shorts/`, driven by SKILL.md) replaces the stack below for motion-graphics shorts: ElevenLabs v4 through OpenRouter for the voice, Whisper for word timings, Remotion for the picture, ffmpeg for loudness and QA. The tools below matter only for footage-based shorts (talking head, real screen recordings).

### Footage-based stack

| Stage | Tool | Role |
|-------|------|------|
| Record | OBS, QuickTime, Loom, phone | Screen + optional talking head |
| Rough cut | Descript | Edit by transcript; filler/silence; clip finder |
| Polish | CapCut | Dynamic captions, punch-ins, 9:16 |
| Long → many | Opus Clip, Descript Create Clips | Candidate moments + scores |
| Cards | Canva, Figma | Diagrams, before/after |
| Publish | Native upload per platform | Avoid watermarked re-uploads where algorithms penalize |

Workflow: Record → Descript → CapCut → clean export → upload per platform.  
References: [Reddit — Descript + CapCut workflow](https://www.reddit.com/r/ContentCreators/comments/1jxxkcs/best_workflow_for_getting_autocaptioned_videos_up/), [DoWithAI — repurposing pipeline](https://dowith-ai.com/ai-video-repurposing-workflow/), [Primal Video — Descript Shorts](https://primalvideo.com/guides/how-to-make-youtube-shorts-with-ai-step-by-step-2025/)

### AI-first (lower trust for technical demos)

Descript AI Video Maker, CapCut script-to-video—fine for faceless tips; **real screen + cursor** usually wins for tool credibility.

## Titles, descriptions, hashtags (YouTube)

From YouTube Help ([hashtags](https://support.google.com/youtube/answer/6390658), [Shorts discovery](https://support.google.com/youtube/answer/11914225)):

- Search ranks Shorts on how well the metadata matches the query *and* whether people click and watch; the feed ranks on performance and relevance per viewer. Metadata helps search and topic matching; the video itself drives the feed.
- Up to three description hashtags are shown above the title; tags in the title just spend title space. Over 60 hashtags and YouTube ignores all of them; unrelated hashtags count as misleading metadata.
- `#Shorts` is not needed; eligibility comes from the format (vertical, ≤ 3 min).
- Video tags barely matter for discovery (useful only for common misspellings).
- Custom thumbnails can't be set on Shorts through the API; frame 0 is the de facto cover, so the hook must read on it.

## Platform notes (YouTube Shorts)

- Shorts can run up to 3 minutes; **shorter edits that fully teach one thing** often fit the job better than filling time
- Description links may not be tappable—design funnel via **related video**, channel layout, and in-app discovery
- Since 2025, view counting changed; compare **engaged views** and your own cohort over time

Reference: [Tinrovic — YouTube Shorts for SaaS](https://tinrovic.com/blog/youtube-shorts-for-saas)

## Operations

### Weekly batch

1. Collect 10 pains from support, Reddit, your own workflow  
2. Batch-record micro-demos (same light, same caption template)  
3. Cut 3–5 standalone shorts  
4. Ship 2–3 **hook variants** on the best demo  
5. Review saves, completion, any **10× median** spikes  

**Cadence:** 3–5 shorts/week is a common target alongside long-form.

### Metrics (priority order)

1. Saves (intent to use later)  
2. Average watch / completion  
3. Spike rate vs your median  
4. Raw views (noisy, especially after YouTube view definition changes)

## Example beat sheet (error + fix)

| Time | On-screen | Spoken | Shot |
|------|-----------|--------|------|
| 0–3s | `401 on every webhook` | This error usually means one header is wrong. | Terminal error full screen |
| 3–8s | `Fix in one line` | You don’t need a new library—just add this signature. | Zoom code editor |
| 8–35s | Step 1 → 2 | Copy the secret, paste here, resend. | Screen recording |
| 35–42s | Recap: secret → header → 200 | That’s it—validate before you ship. | Success response |

## Central rule

Make each Short **useful on its own**. A deeper tutorial or doc is an optional next step—not a ransom for the answer.
