# Images and logos in slides

Date: 2026-10-04. Status: agreed with the owner (scope, logo look, agent path, storage); details below are the design.
FUTURE.md #6. Pitch decks need pictures: the product, the team, who already uses it. Today a slide can hold none.

## Decisions (owner, 2026-10-04)

| # | Decision |
|---|---|
| I1 | Four places take a picture: a new **image** slide, a new **team** slide, a new **logos** slide (a wall), and **logos in tables and cards** (a row label or a column header in a table, a card's lead). |
| I2 | **Logos are drawn in one colour**, the slide's text colour, like a "Trusted by" strip. Works on Ink and Paper alike. A logo with a solid background has it removed when it is added. |
| I3 | Agents add a picture by **URL** (or base64 bytes) with a new `add_image` tool. SmartChart copies it into its own storage, measures and prepares it, and returns a reference the agent puts on a slide. (Added later the same night: upload in the app, below.) |
| I4 | Pictures live in **Vercel Blob** (public, unguessable URLs), so share links and PDFs work. |

## Principles carried over

- **Layout stays code's job.** Every picture sits in a fixed frame per template; code decides crop or fit, size and
  treatment. The agent never sets a size, a crop, a position or a filter.
- **A picture always has words.** Every image reference has `alt` (or the person's or company's `name`), so checks,
  storylines and agents that cannot see pixels still read the slide.
- **Thin harness.** Code does what is hard (fetching safely, decoding, background removal, trimming, optical sizing).
  Which picture goes where is the agent's call, guided by the cards.

## The image reference

One field type, `image`, used everywhere a picture goes:

```json
{ "src": "https://<store>.public.blob.vercel-storage.com/img/3f9a…-logo-640x160.png", "alt": "Northwind" }
```

- `src` is a SmartChart image: a Blob URL under `img/`, or a bundled starter image under `/starters/img/`. Anything else is
  an error whose fix says "add it with add_image first". (No hotlinking: a shared deck must not load third-party URLs, and a
  link must not break later.)
- The file name carries what the renderer needs, so a slide renders synchronously without loading the picture first:
  `<hash>-<kind>-<w>x<h>.<ext>`. `kind` is `photo`, `screenshot` or `logo`; `w × h` are the stored pixels.
  `imageMeta(src)` parses it; one function, used by render, validation and checks.
- `alt` is required where the picture carries meaning and no name sits next to it (image slide). Team members and logos
  use their `name` as the alt text.

## add_image (tool, account scope)

Input: `{ url?: string, data?: string (base64, at most 3 MB: a Vercel request body is 4.5 MB), kind: "photo" | "screenshot" | "logo",
alt?: string }`, exactly one of url or data. Output: `{ image: { src, alt }, kind, width, height, note? }` and a hint naming where each kind goes.

Server pipeline (`api/_lib/images.ts`, `sharp`):

1. **Fetch safely** (url): https only; the host's addresses resolved and refused when private, loopback or link-local;
   redirects followed by hand (at most 3, each re-checked); 10 s timeout; 10 MB cap read as a stream. data: 10 MB cap.
2. **Sniff** the bytes (PNG, JPEG, WebP, GIF first frame, SVG, AVIF). Anything else is refused with what was found.
   SVG is rasterised by sharp (librsvg runs no scripts), so a logo from a site's SVG works.
3. **Prepare by kind**:
   - `photo`: EXIF-rotated, fitted inside 2000 × 2000 (never enlarged), WebP q82.
   - `screenshot`: fitted inside 2400 × 2400, WebP q90 (text stays crisp).
   - `logo`: to RGBA; if the picture has no transparency, the background is keyed out from the border colour (flood fill
     from the edges with a tolerance, so white inside a letter stays); transparent margins trimmed; fitted inside
     1200 × 600; PNG. Refused when it does not read as a logo after keying (more than 85% of the box still opaque: a
     photo, a screenshot), with the fix "pass a logo with a plain or transparent background".
   - Refused when too small to stay sharp on a 1920 px slide: a photo or screenshot below 200 px on its shorter side, a
     logo below 120 px on its longer side once trimmed. Logos already transparent keep their alpha, but white details on a
     coloured mark become holes (a reversed, mostly white logo keeps its white).
4. **Store** at `img/<sha256 of the result, 16 hex>-<kind>-<w>x<h>.<ext>`: the same picture added twice is one file.
   Cache-Control one year (the name never changes).
5. **Limit**: images count against the existing per-minute rate and a daily cap (200 per user).

In-app: `add_image` is not offered to the in-app agent (no upload in this version, I3); the in-app router does not
pick the image or logos slides, and Add slide hides the starters with pictures (the maker would be left with Acme's).
The team slide works without photos (text over a rule), so it is offered everywhere.

## Templates

### image: a picture that makes the point
Title frame, an optional `caption`, the picture, optional `notes` beside it (the chart's split: ⅔ + ⅓).
- `image: { src, alt }` required; kind `screenshot` or `photo` (a logo goes on the logos slide).
- **Screenshot**: never cropped. Fitted inside the area, top-left on the grid like a chart, on the `--surface` colour with a
  hairline (`--line`) and a 16 px radius; no device frame, no shadow.
- **Photo**: fills the area (`object-fit: cover`, centred a little above the middle), 16 px radius.

### team: the people
Title frame and 2–6 people: `{ photo?: image(photo), name, role, text? }`.
- Up to 4 in one row; 5–6 as two rows of 3 with the photo beside the words. Square photos, 16 px radius, one look across
  the row: greyscale with a light contrast lift (colour photos from five sources never match; grey ones do). Photos for
  everyone or no one: without photos the row is text over a rule; a photo that fails to load shows initials.
- `name` (24), `role` (34, in the label voice), `text` one line of proof ("Ex-Stripe; built SME payments to £2bn").
- `focus` is not offered: a team slide is not about one person.

### logos: a wall of logos
Title frame, optional `caption`, 3–12 logos `{ logo: image(logo), name }`.
- Code picks the grid: 3–4 in one row; 5–6 in rows of 3; 7–8 in rows of 4; 9–10 in rows of 5; 11–12 in rows of 6.
  Equal cells, separated by hairlines (consulting) or by space alone (pitch).
- **Optical sizing**: logos of different shapes get the same visual weight. Each logo's area is held constant
  (`h = √(A / aspect)`), clamped to the cell; a wordmark comes out wide and short, a symbol square and taller.
- One colour: the logo's alpha drawn in `--fg` (`mask-image`), so every logo reads on both themes. The name is the
  accessible label.

### Logos in tables and cards
- Table: a cell may be `{ value, logo }` (label column), and a column may have `logo` instead of `icon` (header). One rule
  per table, as with icons: all rows (or columns) have one, or none.
  A wordmark (aspect ≥ 2.4) replaces the visible name (the name stays as hidden text, like a mark's character); a
  symbol sits before the name. Sized to the row's text: the logo's height follows the cap height, its area held as above.
- Cards: `logo` is a third lead next to `icon` and `value`: every card has one, or none. Drawn at the lead's height,
  optically sized, one colour (the focus card's logo in the focus colour).

## Checks

- Schema: `src` must be a SmartChart image; its kind must fit the field (`logo` for logos, `photo` for team, `photo` or
  `screenshot` for the image slide). The error names the kind found and the field's kind.
- Rule check (new R-number): an image slide whose `alt` repeats the title, or is a file name ("IMG_2041.jpg"), warns.
- Judgment checks and the storyline read the picture as its words: `[image: alt]`, `[logo: name]`, `[photo: name]`.

## What changes where

| Area | Change |
|---|---|
| `src/engine/images.ts` (new) | `imageMeta`, `isImageSrc`, optical size, `IMAGE_KINDS`. Pure; shared by render, schema, checks, api. |
| `schema.ts`, `types.ts` | `image` field type; `image`, `team`, `logos` entries; `logo` on cells, columns and cards; picking guide. |
| `render.ts`, `slides.css` | The three bodies, logo cells and card leads; masks; team grid; optical sizing. |
| `capabilities.ts`, `prompts.ts`, guide | Cards and capabilities for the new templates; examples from starters. |
| `api/_lib/images.ts`, `api/images.ts` | Pipeline above; `add_image` tool through the registry with an `images` port. |
| `starters.json`, `public/starters/img/` | Three starters (Acme product screenshot, Acme team, Acme customers) and logos in the competitor table; their pictures bundled. |
| Editor | Text fields of the new templates edit by hand like any other; a picture is not editable by hand yet (no upload, I3). |

## Not in this version

Upload in the app (chat drop, paste, replace in edit mode); logos fetched from a company domain; picture crops chosen by
the user; images in pair halves. Each is a FUTURE.md line.

## Pictures in the app (added 2026-10-04, after the first version)
- `POST /api/images?kind=photo|screenshot|logo|all` (signed-in makers; also an agent key): the body is the picture, at most
  4.4 MB (the app shrinks a bigger photo to 2400 px WebP first). `all` prepares every kind the picture can be and returns
  `{ kinds: { kind: { src, width, height } }, refused: { kind: why } }`; the daily cap is shared with add_image.
- **Chat:** a picture dropped, picked or pasted joins the message as text the agent reads: its src for each use, and why the
  other uses are refused. The in-app agent is offered every template again, with one rule: only those srcs, never invented;
  ask for a picture it does not have. Add slide shows the picture starters again.
- **Edit mode:** "Replace picture" over the picture under the pointer (same kind, alt kept); "Add after" on a list whose
  items carry a picture opens the picker first. Failures show their reason; signed out, it says to sign in.
