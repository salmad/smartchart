# Product Input: Prompt-to-Report Builder

> Source: product owner input, 2026-09-26. This document records the product intent as stated. Open questions and brainstorm notes are in the last section and are not yet decisions.

## North star

**The Apple of presentations.** Beautiful slides, charts and reports, generated on demand from a prompt, assembled from a small set of carefully designed components that always stay consistent.

## Terminology

| Term | Meaning |
|---|---|
| **Block** | The unit of content. There are three kinds: **slide**, **chart** and **text block**. |
| **Report** | An ordered collection of blocks. |
| **Deck** | A report made only of slides. |
| **Template** | A pre-designed slide layout with named slots (title, chart area, comments, columns…). The agent fills the slots and never builds the layout itself. |
| **Theme** | A visual skin (type, colour, spacing) applied to every template. The first reference theme is `example_template/fintech_pitch_deck_example.html`. |

## Goal

Let a user create a **chart, a slide or a whole report on demand** by typing a prompt.

## User problem

- **General-purpose tools don't work well with agents.** Google Slides ships weak templates and is hard to drive from an LLM ("design a slide for me"). Integrating it with an agent is painful.
- **Designing from scratch is expensive and inconsistent.** When an agent writes PowerPoint or HTML slides from the ground up every time, it spends a lot of tokens and the design drifts from slide to slide.
- **What the user needs:** to produce slides and charts via prompt, **quickly and cheaply**, from **components that were designed once, designed well**, with pre-made templates that look good by default.

## Solution

1. The user types a prompt into chat.
2. The agent picks a **block type** (slide or chart) and a **template**.
3. The agent **configures** it without writing layout code: chart type, series colours, titles, and comments in predefined places.
4. The result renders instantly in the web app, and the user refines it by prompt or by hand.

## MVP scope

### 1. Charts
- Beautiful, **multi-series** charts: bar, line, and bar and line combined.
- Editing **by hand** and **by prompt** ("change X", "add this dataset"). This exists in the current app but on the old model, so it can be heavily rewritten.

### 2. Slide templates
The initial template set covers two communication styles:
- **Consulting** (McKinsey-like): text-dense, the argument is carried in the title, evidence is in the body.
- **Pitch** (YC/VC-like): minimal text, bold statements, big numbers.

Initial templates:

| Template | Layout |
|---|---|
| **Evidence + commentary** | ⅔ visual (chart / illustration / table) + ⅓ comments. The classic consulting slide. |
| **Columns** | 2–4 columns comparing options. Each column has an illustration or icon and a title on top, with bullets below. |
| **Table** | A beautifully typeset data table. |
| **Chart** | A single chart with an action title. |

- **Icons:** consulting-style slides may use a curated set of tasteful icons. The agent gets explicit guidance on when and how to pick them.

### 3. Agent
- A **system prompt** guides template selection and configuration. It uses **progressive disclosure**: the agent sees a short catalogue first and loads a template's full schema only when needed.
- **Tools** support multi-turn work: list templates, read a template schema, create/update/delete blocks, reorder the report.
- **Communication style** for slide copy: **MECE**, concise, **Barbara Minto's Pyramid Principle** (the answer first, then the supporting arguments; action titles that state the "so what").
- **Default model:** GLM 5.3 Flash via its coding API endpoint.
- **Structured output:** use JEV via OpenRouter where native JSON output helps (to be investigated, see open questions).

### 4. Themes (later)
- Several themes per report. The fintech pitch deck example is the reference for the first one.

## Design principles

### 1. The agent configures; it never designs
The agent outputs a small JSON document: a template id plus slot content (titles, data, bullets, icon names, comment markers). All layout, typography, colour and spacing live in code, designed once and reviewed by a human.
- **Cheap:** the agent writes kilobytes of JSON, not layout code.
- **Consistent:** every slide comes from the same components, so nothing drifts.
- **Beautiful:** taste is encoded once, by a designer, not improvised per prompt.
- **No escape hatch:** there is no "raw HTML" block. If a need recurs, we design a new component. We never let the agent improvise one.

### 2. Minimal reusable components
Templates are not bespoke pages. Each one is **one slide frame** (kicker, action title, body, takeaway, source) plus **one body layout** (full, split ⅔+⅓, 2–4 columns) filled with **slot kinds** (chart, table, column item, comment list, stat). A new template is a new combination of these, not new code.

### 3. Writing style is chosen by the user and shapes the agent prompt
The user picks the style per report: **Consulting** (MECE, Minto pyramid, full-sentence action titles, dense evidence) or **Pitch** (one bold claim per slide, big numbers, little text). The same templates serve both; only the agent's copy rules change.

**Beauty and taste are the product.** The templates go through design review and approval **before** the build starts:
1. Produce several visual variants of the template set.
2. The product owner reviews and confirms them.
3. Then plan the architecture and the build.

## Technical constraints

| Area | Decision |
|---|---|
| Architecture | Heavy re-architecture or rewrite is allowed. The old code may be mis-architected. |
| Framework | Open. We can switch if another fits better. |
| Hosting | Vercel. |
| Auth | None. API spend is capped at the key level. |
| Persistence | Browser only (local storage / IndexedDB). No backend database. |
| LLM | GLM 5.3 Flash by default. JEV via OpenRouter for native JSON output where useful. |

---

## Brainstorm notes & open questions

*Captured during product brainstorming. Nothing below is decided yet.*

### Core insight
The key idea is **"LLM as configurator, not designer."** The agent emits a small JSON document (template id + slot content). The design lives in code, so it costs zero tokens and never drifts. That is why this is cheap, consistent and beautiful. Every decision below should protect this idea.

### Open questions
1. **Slide canvas:** fixed 16:9 (1920×1080, scaled to fit) like the reference theme, or also 4:3 / A4 for reports?
2. **Export:** the MVP has browser-only persistence. How does a user take a deck out: PDF, PPTX, a share link, or nothing in the MVP? Without export, the output can't reach the meeting it was made for.
3. **Charts on slides:** is a chart block the *same* component as the chart inside a slide's ⅔ area (one chart engine, two containers)? Recommended: yes.
4. **Text block:** what is it exactly? A markdown section between slides in a "report" view, or a slide type?
5. **Jev (TypeSafe) — resolved:** Jev is a "System One" typed-decision model. It returns one value from a set you define, with probabilities, in ~70–500 ms and very cheaply. `typesafe/jev-router` on OpenRouter uses it to pick a model per request. **Proposed use:** Jev decides *which template/layout* (e.g. `split · 91%`) and optionally routes to a model; a strong model then fills the slot JSON. This makes template choice cheap and makes it impossible to pick a template that doesn't exist. Note: sending requests through TypeSafe shares a request summary with a third party.
6. **Model reliability** in multi-turn edits needs testing (GLM 5.3 Flash vs jev-router picks) before we commit to a default.
7. **Illustrations:** in the columns and ⅔ templates, "illustration" means icon only, or also images / generated art?
8. **Beyond the MVP: a sellable product on Next.js.** The goal after the MVP is a product other people sign up for and build their decks in. That needs server features the MVP skips: accounts and auth, decks stored per user, share links, billing, and a server-side agent with locked-down model endpoints. Proposed: move from Vite to Next.js at that point, so these have one home (API routes, middleware, server rendering for public and shared pages). The MVP stays on Vite. The engine (`src/engine`) is framework-free TypeScript and moves as is. Open: when to start, and which auth, database and billing providers.

### Design proposals
- `docs/design/proposals/slides-v4.html` (**chosen for the MVP**, "Ink"): v1 rebuilt with the vocabulary of the marketing-heavy example deck:
  - Archivo condensed display type: 900 uppercase for Pitch, 800 sentence case for Consulting
  - large body text
  - full slides with a pull-quote anchoring the bottom
  - semantic inline colour: `[[gold]]` the point, `[-red-]` the problem, `[+green+]` money
  - templates: cover, section, hero, split, columns, cases, table, chart, timeline, stats
  - two palettes on semantic tokens: **Ink** (dark, gold focus) and **Paper** (light, cobalt focus)
  - `?style=consulting&theme=paper&only=3&full=1` renders one slide at 1920×1080; `?stress=1` renders every template with every slot at its limit
  - agent contract: `src/engine/slides/schema.ts` (catalogue, per-template schemas, validator); prompt and tools: `src/engine/agent/agent-prompt.ts`
- `slides-v3.html` ("Colour-linked"), `slides-v2.html`, `slides-v1.html`: earlier passes, removed in v1 (see commit 788f4d7).

**Rendering note for the build:** Chrome misplaces SVG `<text>` inside CSS-scaled slide frames. Chart labels must be HTML positioned over the SVG, not SVG text.

### Decided (2026-09-26)
- Writing style (Consulting / Pitch) is a user choice per report and drives the agent prompt.
- Export is out of scope for now; reports live in the app.
- Canvas is 16:9 only for the MVP.
- Text blocks are deferred.
- **v4 "Ink" is the MVP slide system** (2026-09-26). Frame: kicker and title at the top; footnote and source bottom left; footer and page number bottom right (no "confidential" label). Cover is title + subtitle only. Every content slide may carry a one-line `takeaway`, a `footnote` and a `source`. Titles never exceed 2 lines; the takeaway is always 1 line.
- **Fit is guaranteed by two gates:** schema limits and budgets (checked before saving), then a render-time fit check whose messages go back to the agent. A slide ships only when both pass.
- **Architecture spec:** `docs/superpowers/specs/2026-09-26-slide-system-architecture-design.md` (2026-09-26). In short:
  - 1 frame + 3 layouts + ~6 blocks, and the agent picks from a closed menu of 7 (`chart`, `table`, `number`, `steps`, `cards`, `cover`, `section`); notes are an optional field of chart and table.
  - Deterministic fit arithmetic, and slides are a fixed format, not responsive.
  - Rule and Jev design checks are shown to the user.
  - Presentation mode works like Slidev.
- **Models:** GLM 5.3 Flash via its subscription endpoint is the main model and the first priority. OpenRouter is used only for Jev (later also image models). Jev picks the template and runs the cheap judgment checks.
- **Pitch frame:** the title is a 1-line topic ("Business model"), plus an optional 1–2 line subtitle carrying the claim. Pitch slides have no kicker.
- **Routing (M0 bake-off, 2026-09-26):** Jev picks the template when its probability is ≥ 0.7 (about 80% of requests). Below that, GLM 5.3 Flash with thinking picks. Jev scored 90% at 0.5 s; GLM with thinking scored 92% at 4.7 s. Results are in `docs/research/2026-09-26-routing-bakeoff/`.
- **Routing principle:** routing picks only the key component a slide is built around. Optional components (notes, takeaway, footnote, source, subtitle, card details) are decided while filling the template, never by the router.
